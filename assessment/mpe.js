// Point-source ocular MPE from ANSI Z136.1-2022, transcribed from the owner's copy.
// Covered now: Table 7a (180–400 nm), Table 7b (400–700 nm, except the rows that
// use C_B and T₁) and Table 7d (1400 nm – 1000 µm). Table 7c (700–1400 nm), the
// C_B/T₁ rows of Table 7b and the extended-source Tables 7e/7f need Table 8a/8b
// correction factors, which are not transcribed yet; for those, mpe() returns
// { needs } and the page asks the user to enter the MPE.
//
// Ranges follow the table notes: λ₁ to λ₂ means λ₁ ≤ λ < λ₂, and t₁ to t₂ means
// t₁ ≤ t < t₂ (the last row also includes 30,000 s).
//
// Each row returns radiant exposure H (J/cm²) for exposure duration t. Rows that
// the table gives in W/cm² are returned as H = E × t, so every row can be compared
// in the same units (Table 7a Note 2).

const J = f => ({ unit: "J", f });       // table value in J/cm²
const W = f => ({ unit: "W", f });       // table value in W/cm²
const NEED_8A = "Table 8a (C_A, C_B, C_C, T₁, K_λ)";

// [λ from, λ to, [[t from, t to, thermal, photochemical, text], ...]]
// thermal/photochemical are row values or null; where both exist (dual limit) the lower one applies.
const TABLE_7A = [
  [180, 260, [
    [1e-13, 1e-11, J(() => 3.0e-4), null, "3.0 × 10⁻⁴ J/cm²"],
    [1e-11, 1e-9, J(() => 1.0e-3), null, "1.0 × 10⁻³ J/cm²"],
    [1e-9, 10, J(t => 0.56 * t ** 0.25), J((t, l) => 0.003 * 10 ** (0.033 * (260 - l))), "thermal 0.56·t^0.25 or photochemical 0.003 × 10^0.033(260−λ) J/cm², the lower"],
    [10, 30000, null, J((t, l) => 0.003 * 10 ** (0.033 * (260 - l))), "photochemical 0.003 × 10^0.033(260−λ) J/cm²"],
  ]],
  [260, 302.5, [
    [1e-13, 1e-11, J(() => 3.0e-4), null, "3.0 × 10⁻⁴ J/cm²"],
    [1e-11, 1e-9, J(() => 1.0e-3), null, "1.0 × 10⁻³ J/cm²"],
    [1e-9, 10, J(t => 0.56 * t ** 0.25), J(() => 3e-3), "thermal 0.56·t^0.25 or photochemical 3 × 10⁻³ J/cm², the lower"],
    [10, 30000, null, J(() => 3e-3), "photochemical 3 × 10⁻³ J/cm²"],
  ]],
  [302.5, 315, [
    [1e-13, 1e-11, J(() => 3.0e-4), null, "3.0 × 10⁻⁴ J/cm²"],
    [1e-11, 1e-9, J(() => 1.0e-3), null, "1.0 × 10⁻³ J/cm²"],
    [1e-9, 10, J(t => 0.56 * t ** 0.25), J((t, l) => 10 ** (0.2 * (l - 295)) * 1e-4), "thermal 0.56·t^0.25 or photochemical 10^0.2(λ−295) × 10⁻⁴ J/cm², the lower"],
    [10, 30000, null, J((t, l) => 10 ** (0.2 * (l - 295)) * 1e-4), "photochemical 10^0.2(λ−295) × 10⁻⁴ J/cm²"],
  ]],
  [315, 400, [
    [1e-13, 1e-11, J(() => 3.0e-4), null, "3.0 × 10⁻⁴ J/cm²"],
    [1e-11, 1e-9, J(() => 1.0e-3), null, "1.0 × 10⁻³ J/cm²"],
    [1e-9, 10, J(t => 0.56 * t ** 0.25), null, "0.56·t^0.25 J/cm²"],
    [10, 30000, null, J(() => 1.0), "photochemical 1.0 J/cm²"],
  ]],
];

const VIS_SHORT = [
  [1e-13, 1e-11, J(() => 1.0e-7), null, "1.0 × 10⁻⁷ J/cm²"],
  [1e-11, 5e-6, J(() => 2.0e-7), null, "2.0 × 10⁻⁷ J/cm²"],
  [5e-6, 10, J(t => 1.8 * t ** 0.75 * 1e-3), null, "1.8·t^0.75 × 10⁻³ J/cm²"],
];
const TABLE_7B = [
  [400, 450, [...VIS_SHORT,
    [10, 100, J(() => 1.0e-2), null, "1.0 × 10⁻² J/cm²"],
    [100, 30000, "needs", null, "C_B × 10⁻⁴ W/cm²"],
  ]],
  [450, 500, [...VIS_SHORT,
    [10, 30000, "needs", null, "1.0 × 10⁻³ W/cm² up to T₁, then C_B values"],
  ]],
  [500, 700, [...VIS_SHORT,
    [10, 30000, W(() => 1.0e-3), null, "1.0 × 10⁻³ W/cm²"],
  ]],
];

const TABLE_7D = [
  [1400, 1500, [
    [1e-13, 1e-11, J(() => 0.03), null, "0.03 J/cm²"],
    [1e-11, 1e-9, J(() => 0.1), null, "0.1 J/cm²"],
    [1e-9, 1e-3, J(() => 0.3), null, "0.3 J/cm²"],
    [1e-3, 4, J(t => 0.56 * t ** 0.25 + 0.2), null, "0.56·t^0.25 + 0.2 J/cm²"],
    [4, 10, J(() => 1.0), null, "1.0 J/cm²"],
    [10, 30000, W(() => 0.1), null, "0.1 W/cm²"],
  ]],
  [1500, 1800, [
    [1e-13, 1e-11, J(() => 0.1), null, "0.1 J/cm²"],
    [1e-11, 1e-9, J(() => 0.3), null, "0.3 J/cm²"],
    [1e-9, 10, J(() => 1.0), null, "1.0 J/cm²"],
    [10, 30000, W(() => 0.1), null, "0.1 W/cm²"],
  ]],
  [1800, 2600, [
    [1e-13, 1e-11, J(() => 0.01), null, "0.01 J/cm²"],
    [1e-11, 1e-9, J(() => 0.03), null, "0.03 J/cm²"],
    [1e-9, 1e-3, J(() => 0.1), null, "0.1 J/cm²"],
    [1e-3, 10, J(t => 0.56 * t ** 0.25), null, "0.56·t^0.25 J/cm²"],
    [10, 30000, W(() => 0.1), null, "0.1 W/cm²"],
  ]],
  [2600, 1e6, [
    [1e-13, 1e-11, J(() => 1e-3), null, "1 × 10⁻³ J/cm²"],
    [1e-11, 1e-9, J(() => 3e-3), null, "3 × 10⁻³ J/cm²"],
    [1e-9, 1e-7, J(() => 1e-2), null, "1 × 10⁻² J/cm²"],
    [1e-7, 10, J(t => 0.56 * t ** 0.25), null, "0.56·t^0.25 J/cm²"],
    [10, 30000, W(() => 0.1), null, "0.1 W/cm²"],
  ]],
];

const TABLES = [["7a", TABLE_7A], ["7b", TABLE_7B], ["7d", TABLE_7D]];
const toH = (v, t, l) => (v.unit === "J" ? v.f(t, l) : v.f(t, l) * t);

const fmtNm = l => (l >= 1e4 ? `${l / 1000} µm` : `${l} nm`);
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const fmtT = t => {
  if (t >= 1e-3 && t < 1e5) return t.toLocaleString("en-US");
  const [m, e] = t.toExponential(0).split("e");
  return (m === "1" ? "" : m + " × ") + "10" + String(Number(e)).replace(/./g, c => SUP[c]);
};

// Point-source ocular MPE for wavelength l (nm) and exposure duration t (s).
// Returns { H (J/cm²), E (W/cm²), table, row } or { needs, table } or { outOfRange }.
export function mpe(l, t) {
  if (!(l > 0) || !(t > 0)) return { outOfRange: "Enter the wavelength and exposure duration." };
  if (l < 180 || l > 1e6) return { outOfRange: "The MPE tables cover 180 nm to 1000 µm." };
  if (t < 1e-13) return { outOfRange: "Pulses shorter than 100 fs have no MPE in the standard; it recommends limiting the peak irradiance to the MPE for a 100 fs pulse (Section 8.2.2)." };
  if (t > 30000) return { outOfRange: "The MPE tables cover up to 30,000 s." };
  if (l >= 700 && l < 1400) return { needs: NEED_8A, table: "7c" };
  for (const [name, table] of TABLES) {
    for (const [l1, l2, rows] of table) {
      const lastBand = l2 === 1e6;
      if (!(l >= l1 && (l < l2 || (lastBand && l <= l2)))) continue;
      for (const [t1, t2, thermal, photo, text] of rows) {
        if (!(t >= t1 && (t < t2 || (t2 === 30000 && t <= t2)))) continue;
        if (thermal === "needs") return { needs: NEED_8A, table: name, row: text };
        const values = [thermal, photo].filter(Boolean).map(v => toH(v, t, l));
        const H = Math.min(...values);
        return {
          H, E: H / t, table: name,
          row: `Table ${name}, ${fmtNm(l1)} to ${fmtNm(l2)}, ${fmtT(t1)} to ${fmtT(t2)} s: ${text}`,
        };
      }
    }
  }
  return { outOfRange: "No MPE row matches these values." };
}

// Multiple-pulse (repetitive-pulse) MPE per pulse, ANSI Z136.1-2022 Section 8.2.3.
//   Rule 1: any single pulse ≤ the MPE for the pulse duration.
//   Rule 2: the total radiant exposure of all pulses within any time T ≤ the MPE for T.
//           For a regular pulse train, the shortest window holding k pulses is
//           (k − 1)/PRF + pulse duration, so each k from 1 to the number of pulses in
//           T_max is checked and the per-pulse limit is MPE(window)/k.
//   Rule 3: applies only when the source subtends more than 5 mrad (condition d), and
//           Table 8c gives C_P = 1.0 for α ≤ 5 mrad. This page treats the laser as a
//           point source, so Rule 3 does not change the result.
// The most restrictive (lowest) per-pulse MPE is the MPE for the exposure.
// tp: pulse duration (s); prf: pulses per second; Tmax: exposure duration (s).
export function multiPulseMPE(l, tp, prf, Tmax) {
  if (!(tp > 0) || !(prf > 0) || !(Tmax > 0)) return { outOfRange: "Enter the pulse duration, repetition frequency and exposure duration." };
  if (tp * prf >= 1) return { outOfRange: "The pulses overlap (pulse duration × frequency ≥ 1). Treat the laser as continuous wave." };
  const r1 = mpe(l, tp);
  if (!(r1.H > 0)) return r1;
  // Pulses that fit in T_max: one at the start plus one every 1/PRF, while the window stays ≤ T_max.
  const nIn = Math.max(1, Math.floor((Tmax - tp) * prf * (1 + 1e-12)) + 1);
  const ks = new Set([1, nIn]);
  if (nIn <= 4000) for (let k = 2; k < nIn; k++) ks.add(k);
  else for (let i = 0; i <= 3000; i++) ks.add(Math.round(Math.exp(Math.log(nIn) * i / 3000)));
  let best = null;
  for (const k of ks) {
    if (k < 2) continue;
    const window = (k - 1) / prf + tp;
    const m = mpe(l, window);
    if (m.needs) return { needs: m.needs, rule1: { H: r1.H, row: r1.row, t: tp } };
    if (!(m.H > 0)) continue;
    const perPulse = m.H / k;
    if (!best || perPulse < best.H) best = { H: perPulse, k, t: window, total: m.H, row: m.row };
  }
  const rule1 = { H: r1.H, t: tp, row: r1.row };
  const rule2 = best;
  const governing = rule2 && rule2.H < rule1.H ? "Rule 2" : "Rule 1";
  return { H: Math.min(rule1.H, rule2 ? rule2.H : Infinity), rule1, rule2, pulsesInTmax: nIn, governing };
}
