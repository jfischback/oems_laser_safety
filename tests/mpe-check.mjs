import { mpe, multiPulseMPE, skinMPE } from "../assessment/mpe.js";
const res = [];
const ok = (name, cond, got) => res.push([cond ? "PASS" : "FAIL", name, got]);
const rel = (a, b, tol = 0.01) => Math.abs(a - b) / b <= tol;
// The UNL guide's worked examples.
let m = mpe(693, 0.25);
ok("693 nm, 0.25 s → 2.55 mW/cm² (UNL p.5)", rel(m.E, 2.55e-3, 0.005), [m.E, m.row]);
m = mpe(500, 8e-10);
ok("500 nm, 800 ps → 2×10⁻⁷ J/cm² (UNL p.6)", rel(m.H, 2e-7, 1e-9), [m.H, m.row]);
// Continuity across row boundaries: the standard's rows meet (nearly) end to end,
// so a misread exponent or coefficient shows up as a jump.
const cont = (l, t, label, tol = 0.02) => {
  const a = mpe(l, t * (1 - 1e-9)), b = mpe(l, t);
  ok(`continuous at ${label}`, rel(a.H, b.H, tol), [a.H, b.H]);
};
cont(550, 10, "visible 10 s (1.8t^0.75 mJ → 1 mW/cm²)", 0.02);
cont(420, 10, "400–450 nm 10 s (→ 10 mJ/cm²)", 0.02);
cont(550, 5e-6, "visible 5 µs (table has a 5% step here)", 0.06);
cont(350, 10, "UV-A 10 s (0.56t^0.25 → 1.0)", 0.01);
cont(1450, 4, "1400–1500 nm 4 s", 0.01);
cont(1450, 10, "1400–1500 nm 10 s (1.0 J → 0.1 W)", 0.01);
cont(2000, 1e-3, "1800–2600 nm 1 ms", 0.01);
cont(2000, 10, "1800–2600 nm 10 s", 0.01);
cont(10600, 1e-7, "CO₂ 100 ns", 0.01);
cont(10600, 10, "CO₂ 10 s", 0.01);
cont(1600, 10, "1500–1800 nm 10 s", 0.01);
// Across wavelength: 302.5–315 photochemical meets 315–400 at 315 nm (1.0 J/cm²) and 260–302.5 at 302.5.
ok("UV photochemical meets at 315 nm (10 s+)", rel(mpe(314.9999, 100).H, mpe(315, 100).H, 0.01), [mpe(314.9999, 100).H, mpe(315, 100).H]);
ok("UV photochemical near 302.5 nm (3×10⁻³)", rel(mpe(302.5, 100).H, 3e-3, 0.06), mpe(302.5, 100).H);
// Spot values.
ok("CO₂ 10.6 µm, 10 s → 0.1 W/cm²", rel(mpe(10600, 10).E, 0.1), mpe(10600, 10).E);
ok("UV-C 254 nm, 100 s → photochemical 4.73 mJ/cm²", rel(mpe(254, 100).H, 0.003 * 10 ** (0.033 * 6)), mpe(254, 100).H);
ok("Dual limit picks the lower (308 nm, 1 µs)", mpe(308, 1e-6).H === Math.min(0.56 * 1e-6 ** 0.25, 10 ** (0.2 * 13) * 1e-4), mpe(308, 1e-6).H);
// Not covered yet: must ask, never guess.
ok("1064 nm needs Table 8a", !!mpe(1064, 10).needs, mpe(1064, 10));
ok("455 nm, 600 s needs Table 8a", !!mpe(455, 600).needs, mpe(455, 600));
ok("420 nm, 600 s needs Table 8a", !!mpe(420, 600).needs, mpe(420, 600));
ok("420 nm, 0.25 s is covered", mpe(420, 0.25).H > 0, mpe(420, 0.25).row);
ok("Out of range is refused", !!mpe(150, 1).outOfRange && !!mpe(550, 1e5).outOfRange, "");
// Multiple pulses (Section 8.2.3).
let mp = multiPulseMPE(500, 8e-10, 10, 0.25);
ok("UNL dye laser 500 nm, 10 Hz: Rule 1 governs, 2×10⁻⁷ J/cm²", mp.governing === "Rule 1" && rel(mp.H, 2e-7, 1e-9), [mp.H, mp.governing]);
mp = multiPulseMPE(532, 1e-8, 1e5, 0.25);
ok("532 nm 100 kHz: Rule 2 per pulse × PRF ≈ CW MPE 2.55 mW/cm²", mp.governing === "Rule 2" && rel(mp.H * 1e5, mpe(532, 0.25).E, 0.01), [mp.H * 1e5]);
mp = multiPulseMPE(10600, 1e-4, 1000, 10);
ok("CO₂ 1 kHz: Rule 2 per pulse × PRF ≈ 0.1 W/cm²", rel(mp.H * 1000, 0.1, 0.01), [mp.H * 1000]);
ok("1064 nm pulsed needs Table 8a", !!multiPulseMPE(1064, 1e-8, 1e5, 10).needs, "");
ok("Overlapping pulses are refused", !!multiPulseMPE(532, 1e-6, 2e6, 0.25).outOfRange, "");
// Skin (Tables 9a and 9c), checked against the photographed pages.
let sk = skinMPE(355, 1e-8);
ok("skin 355 nm, 10 ns: 0.56·t^0.25", rel(sk.H, 0.56 * 1e-8 ** 0.25, 1e-9), sk);
sk = skinMPE(355, 100);
ok("skin 355 nm, 100 s: 1.0 J/cm²", rel(sk.H, 1.0, 1e-9), sk);
sk = skinMPE(355, 5000);
ok("skin 355 nm, 5000 s: 1 mW/cm² (Table 9a, differs from eye)", rel(sk.E, 1e-3, 1e-9), sk);
ok("skin UV-A continuous at 1000 s (1 J/cm² → 1 mW/cm²)", rel(skinMPE(355, 999.999).H, skinMPE(355, 1000).H, 0.01), "");
sk = skinMPE(10600, 10);
ok("skin CO₂ 10 s: 0.1 W/cm²", rel(sk.E, 0.1, 1e-9), sk);
ok("skin CO₂ aperture 3.5 mm", skinMPE(10600, 10).aperture === 3.5, "");
ok("skin 200 µm aperture 11 mm", skinMPE(200000, 10).aperture === 11, "");
ok("skin 1064 nm needs Table 8a", !!skinMPE(1064, 10).needs, "");
for (const r of res) console.log(r[0], "|", r[1], "|", JSON.stringify(r[2]));
console.log(res.every(r => r[0] === "PASS") ? "ALL PASS" : "SOME FAILED");
