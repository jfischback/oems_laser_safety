// Validation record: the tool's own calculation code run against values published by independent sources.
// Used by the Validation page (validation/app.js) and by tests/validation-check.mjs, so the page always
// shows what the current code produces.
//
// Sources:
//   OSHA  = OSHA Technical Manual, Section III, Chapter 6, Laser Hazards (Tables III:6-6, III:6-7, III:6-8
//           and Equation III:6-1). https://www.osha.gov/otm/section-3-health-hazards/chapter-6
//   UNL   = University of Nebraska-Lincoln EHS, Laser Safety Calculation Guide (7/24).
// A case passes when the tool's result is within 2% of the published value (3% for the diffuse distances and
// the MPE values, which are published to two digits), or, for optical density, within 0.05 before rounding up.
import { evaluate, roundOD } from "../assessment/calc.js";
import { mpe, multiPulseMPE } from "../assessment/mpe.js";

const sig = (x, n = 4) => String(Number(x.toPrecision(n)));
const close = (got, ref, tol = 0.02) => Math.abs(got - ref) <= tol * Math.abs(ref);

// ---- 1. Hazard distances: OSHA Table III:6-7, with the MPE values OSHA used (Table III:6-6) ----
const LASERS = {
  "Nd:YAG, 100 W, 1064 nm": { q: 100, phi: 2e-3, a: 0.2, b0: 0.63, f0: 2.54, in: "divergence 2.0 mrad, aperture 2.0 mm, beam at lens 6.3 mm, focal length 25.4 mm" },
  "CO₂, 500 W, 10.6 µm": { q: 500, phi: 2e-3, a: 2, b0: 3, f0: 20, in: "divergence 2.0 mrad, aperture 20 mm, beam at lens 30 mm, focal length 200 mm" },
  "Argon, 5 W, 488 nm": { q: 5, phi: 1e-3, a: 0.2, b0: 0.3, f0: 20, in: "divergence 1.0 mrad, aperture 2.0 mm, beam at lens 3.0 mm, focal length 200 mm" },
};
const NHZ = [ // [laser, exposure criterion, MPE W/cm², published diffuse m, lens-on-laser m, direct m]
  ["Nd:YAG, 100 W, 1064 nm", "8 hours", 1.6e-3, 1.4, 11.3, 1410],
  ["Nd:YAG, 100 W, 1064 nm", "10 seconds", 5.1e-3, 0.8, 6.3, 792],
  ["CO₂, 500 W, 10.6 µm", "8 hours", 0.1, 0.4, 5.3, 309],
  ["CO₂, 500 W, 10.6 µm", "10 seconds", 0.1, 0.4, 5.3, 390],
  ["Argon, 5 W, 488 nm", "8 hours", 1e-6, 12.6, 1700, 25200],
  ["Argon, 5 W, 488 nm", "0.25 second", 2.5e-3, 0.25, 33.3, 240],
];
// The three published values the tool does not reproduce, and why.
const KNOWN = {
  "CO₂, 500 W, 10.6 µm|8 hours|direct": "OSHA prints 309 m here and 390 m for 10 seconds, with the same MPE for both, and its own text says the CO₂ distances do not vary. The formula gives 399 m from OSHA's inputs.",
  "CO₂, 500 W, 10.6 µm|10 seconds|direct": "2.2% apart, just outside the 2% limit. OSHA prints two different values (309 m and 390 m) for the same inputs; the formula gives 399 m for both.",
  "Argon, 5 W, 488 nm|0.25 second|direct": "OSHA's own inputs give 505 m by the same formula that reproduces its other five direct-beam values, and its diffuse and lens values on this row agree with the tool. The printed 240 m does not follow from the inputs.",
};

// ---- 2. Automatic MPE: OSHA Table III:6-6 (values unchanged in ANSI Z136.1-2022) and the UNL guide ----
const MPES = [ // [laser, nm, seconds, published W/cm², source]
  ["CO₂", 10600, 10, 100e-3, "OSHA Table III:6-6"], ["CO₂", 10600, 30000, 100e-3, "OSHA Table III:6-6"],
  ["HeNe", 633, 0.25, 2.5e-3, "OSHA Table III:6-6"], ["Krypton", 647, 0.25, 2.5e-3, "OSHA Table III:6-6"],
  ["Argon", 514, 0.25, 2.5e-3, "OSHA Table III:6-6"],
  ["XeF excimer", 351, 30000, 33.3e-6, "OSHA Table III:6-6"], ["XeCl excimer", 308, 30000, 1.3e-6, "OSHA Table III:6-6"],
  ["Ruby", 693, 0.25, 2.55e-3, "UNL guide, page 5"],
];

// ---- 3. Eyewear optical density: OSHA Table III:6-8 (intrabeam; 7 mm aperture visible, 1 mm ultraviolet) ----
const ODS = [ // [laser, nm, W, seconds, aperture mm, published OD]
  ["XeCl excimer, 50 W", 308, 50, 10, 1, 6.2], ["XeCl excimer, 50 W", 308, 50, 600, 1, 8.0], ["XeCl excimer, 50 W", 308, 50, 30000, 1, 9.7],
  ["XeF excimer, 50 W", 351, 50, 10, 1, 4.8], ["XeF excimer, 50 W", 351, 50, 600, 1, 6.6], ["XeF excimer, 50 W", 351, 50, 30000, 1, 8.3],
  ["Argon, 1 W", 514, 1, 0.25, 7, 3.0], ["Krypton, 1 W", 530, 1, 0.25, 7, 3.0], ["Krypton, 1 W", 568, 1, 0.25, 7, 3.0],
  ["HeNe, 5 mW", 633, 0.005, 0.25, 7, 0.7], ["Krypton, 1 W", 647, 1, 0.25, 7, 3.0],
];

export function run() {
  const rows = [];
  const add = (group, source, what, inputs, ref, got, ok, note = "") => rows.push({ group, source, what, inputs, ref, got, ok, note });

  for (const [name, crit, m, diffuse, lens, direct] of NHZ) {
    const L = LASERS[name], r = evaluate({ ...L, mpe: m, rho: 1, theta: 0 });
    const inputs = `${L.in}; MPE ${sig(m, 3)} W/cm² (${crit})`;
    for (const [kind, ref, got] of [["diffuse reflection (100% reflectance, 0°)", diffuse, r.nhzDiffuse / 100], ["lens on laser", lens, r.nohdLens / 100], ["direct", direct, r.nohd / 100]]) {
      const known = KNOWN[`${name}|${crit}|${kind}`];
      add("Hazard distances", "OSHA Table III:6-7", `${name}: ${kind} beam hazard distance`.replace("reflection (100% reflectance, 0°) beam", "reflection (100% reflectance, 0°)").replace("lens on laser beam", "lens-on-laser"), inputs,
        `${ref} m`, `${sig(got)} m`, close(got, ref, kind.startsWith("diffuse") ? 0.03 : 0.02), known || "");
    }
  }

  for (const [name, nm, t, ref, source] of MPES) {
    const m = mpe(nm, t);
    add("Maximum permissible exposure (looked up by the tool)", source, `${name}, ${nm} nm, ${t} s`, "wavelength and exposure time only",
      `${sig(ref * 1000, 3)} mW/cm²`, m.E > 0 ? `${sig(m.E * 1000)} mW/cm²` : "not calculated", m.E > 0 && close(m.E, ref, 0.03), m.row || "");
  }
  const mp = multiPulseMPE(500, 8e-10, 10, 0.25);
  add("Maximum permissible exposure (looked up by the tool)", "UNL guide, page 6", "Dye laser, 500 nm, 800 ps pulses at 10 Hz, 0.25 s", "wavelength, pulse duration, repetition rate, exposure time",
    "2×10⁻⁷ J/cm² per pulse (single-pulse limit governs)", `${sig(mp.H)} J/cm² per pulse (${mp.governing} governs)`, close(mp.H, 2e-7, 1e-6) && mp.governing === "Rule 1");

  for (const [name, nm, w, t, ap, ref] of ODS) {
    const m = mpe(nm, t), r = m.E > 0 ? evaluate({ q: w, mpe: m.E, Df: ap / 10 }) : {};
    add("Eyewear optical density (MPE looked up, then OD calculated)", "OSHA Table III:6-8", `${name}, ${nm} nm, ${t} s`, `${ap} mm limiting aperture, as OSHA states`,
      `OD ${ref.toFixed(1)}`, r.odExact !== undefined ? `OD ${r.odExact.toFixed(2)}` : "not calculated", r.odExact !== undefined && Math.abs(r.odExact - ref) <= 0.05);
  }
  let r = evaluate({ q: 5, mpe: 16.7e-6, Df: 0.7 });
  add("Eyewear optical density (MPE looked up, then OD calculated)", "OSHA Equation III:6-1 example", "Argon, 5 W, 514 nm, 600 s", "MPE 16.7 µW/cm² as OSHA gives it; 7 mm aperture",
    "exposure 12.99 W/cm², OD 5.9", `exposure ${sig(r.exposure)} W/cm², OD ${r.odExact.toFixed(2)}`, close(r.exposure, 12.99, 0.001) && Math.abs(r.odExact - 5.9) <= 0.05);
  const ruby = mpe(693, 0.25); r = evaluate({ q: 0.25, mpe: ruby.E, Df: 0.7 });
  add("Eyewear optical density (MPE looked up, then OD calculated)", "UNL guide, page 10", "Ruby, 250 mW, 693 nm, 0.25 s", "7 mm aperture",
    "OD 3 (rounded up)", `OD ${roundOD(r.odExact)} (${r.odExact.toFixed(2)} before rounding up)`, roundOD(r.odExact) === 3);
  return rows;
}
