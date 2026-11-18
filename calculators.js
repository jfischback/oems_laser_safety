// Laser calculator definitions (copied from oems_radiation).
// Each calculator lists its variables, a closed-form solution for each variable
// where one exists, and a "residual" (left side minus right side of the equation)
// used to solve any variable that has no closed form.
// Equations follow the laser rows of the RAD tabs of the IH Calculator Equations Google Sheet.

const PHYSICS = "Standard radiation physics";
const exp = Math.exp, ln = Math.log, log10 = Math.log10, sqrt = Math.sqrt, PI = Math.PI;
const RAD = Math.PI / 180;
const ANSI = "ANSI Z136.1";
const RF = "Standard RF physics";

// Half-value layers per tenfold reduction, 1 / log₁₀(2) = 3.3219... (the equation sheet rounds it to 3.32).
const HVLS_PER_DECADE = 1 / Math.log10(2);

export const CALCULATORS = [
  {
    slug: "laser-nhz-direct-beam", name: "Laser NHZ, Direct Beam", group: "Laser calculators", source: ANSI,
    equation: "r_NHZ = (1/φ) × (4Φ / (π × EL) − a²)^½",
    vars: [
      { k: "phi", label: "φ, beam divergence", unit: "radians" },
      { k: "PHI", label: "Φ, laser power", unit: "W" },
      { k: "EL", label: "EL, exposure limit", unit: "W/cm²" },
      { k: "a", label: "a, beam diameter at the laser aperture", unit: "cm" },
      { k: "rNHZ", label: "r_NHZ, nominal hazard zone distance", unit: "cm" },
    ],
    solve: {
      phi: v => sqrt(4 * v.PHI / (PI * v.EL) - v.a ** 2) / v.rNHZ,
      PHI: v => PI * v.EL * ((v.rNHZ * v.phi) ** 2 + v.a ** 2) / 4,
      EL: v => 4 * v.PHI / (PI * ((v.rNHZ * v.phi) ** 2 + v.a ** 2)),
      a: v => sqrt(4 * v.PHI / (PI * v.EL) - (v.rNHZ * v.phi) ** 2),
      rNHZ: v => sqrt(4 * v.PHI / (PI * v.EL) - v.a ** 2) / v.phi,
    },
    residual: v => (v.rNHZ * v.phi) ** 2 + v.a ** 2 - 4 * v.PHI / (PI * v.EL),
    primary: "rNHZ", example: { phi: 0.001, PHI: 1, EL: 0.0025, a: 0.2 },
  },
  {
    slug: "laser-nhz-lens", name: "Laser NHZ, Lens on Laser", group: "Laser calculators", source: ANSI,
    equation: "r_NHZ = (f₀ / b₀) × (4Φ / (π × EL))^½",
    vars: [
      { k: "f0", label: "f₀, lens focal length", unit: "cm" },
      { k: "b0", label: "b₀, beam diameter at the lens", unit: "cm" },
      { k: "PHI", label: "Φ, laser power", unit: "W" },
      { k: "EL", label: "EL, exposure limit", unit: "W/cm²" },
      { k: "rNHZ", label: "r_NHZ, nominal hazard zone distance", unit: "cm" },
    ],
    solve: {
      f0: v => v.rNHZ * v.b0 / sqrt(4 * v.PHI / (PI * v.EL)),
      b0: v => v.f0 * sqrt(4 * v.PHI / (PI * v.EL)) / v.rNHZ,
      PHI: v => PI * v.EL * (v.rNHZ * v.b0 / v.f0) ** 2 / 4,
      EL: v => 4 * v.PHI / (PI * (v.rNHZ * v.b0 / v.f0) ** 2),
      rNHZ: v => v.f0 / v.b0 * sqrt(4 * v.PHI / (PI * v.EL)),
    },
    residual: v => v.rNHZ - v.f0 / v.b0 * sqrt(4 * v.PHI / (PI * v.EL)),
    primary: "rNHZ", example: { f0: 10, b0: 0.2, PHI: 1, EL: 0.0025 },
  },
  {
    slug: "laser-nhz-diffuse", name: "Laser NHZ, Diffuse Reflection", group: "Laser calculators", source: ANSI,
    equation: "r_NHZ = (ρΦ cosθ / (π × EL))^½",
    vars: [
      { k: "rho", label: "ρ, reflectance", unit: "fraction" },
      { k: "PHI", label: "Φ, laser power", unit: "W" },
      { k: "theta", label: "θ, viewing angle from the normal", unit: "degrees" },
      { k: "EL", label: "EL, exposure limit", unit: "W/cm²" },
      { k: "rNHZ", label: "r_NHZ, nominal hazard zone distance", unit: "cm" },
    ],
    solve: {
      rho: v => PI * v.EL * v.rNHZ ** 2 / (v.PHI * Math.cos(v.theta * RAD)),
      PHI: v => PI * v.EL * v.rNHZ ** 2 / (v.rho * Math.cos(v.theta * RAD)),
      theta: v => Math.acos(PI * v.EL * v.rNHZ ** 2 / (v.rho * v.PHI)) / RAD,
      EL: v => v.rho * v.PHI * Math.cos(v.theta * RAD) / (PI * v.rNHZ ** 2),
      rNHZ: v => sqrt(v.rho * v.PHI * Math.cos(v.theta * RAD) / (PI * v.EL)),
    },
    residual: v => v.rNHZ ** 2 - v.rho * v.PHI * Math.cos(v.theta * RAD) / (PI * v.EL),
    primary: "rNHZ", example: { rho: 0.9, PHI: 1, theta: 30, EL: 0.0025 },
  },
  {
    slug: "ds-tl", name: "Ds (TL Form)", group: "Laser calculators", source: `Same form as the ${ANSI} NHZ equation`,
    equation: "Ds = (1/φ) × (4Φ / (π × TL) − a²)^½",
    vars: [
      { k: "phi", label: "φ, beam divergence", unit: "radians" },
      { k: "PHI", label: "Φ, laser power", unit: "W" },
      { k: "TL", label: "TL, as written on the equation sheet (in place of EL)", unit: "W/cm²" },
      { k: "a", label: "a, beam diameter at the aperture", unit: "cm" },
      { k: "Ds", label: "Ds, distance", unit: "cm" },
    ],
    solve: {
      phi: v => sqrt(4 * v.PHI / (PI * v.TL) - v.a ** 2) / v.Ds,
      PHI: v => PI * v.TL * ((v.Ds * v.phi) ** 2 + v.a ** 2) / 4,
      TL: v => 4 * v.PHI / (PI * ((v.Ds * v.phi) ** 2 + v.a ** 2)),
      a: v => sqrt(4 * v.PHI / (PI * v.TL) - (v.Ds * v.phi) ** 2),
      Ds: v => sqrt(4 * v.PHI / (PI * v.TL) - v.a ** 2) / v.phi,
    },
    residual: v => (v.Ds * v.phi) ** 2 + v.a ** 2 - 4 * v.PHI / (PI * v.TL),
    primary: "Ds", example: { phi: 0.001, PHI: 1, TL: 0.0025, a: 0.2 },
  },
  {
    slug: "laser-beam-diameter", name: "Laser Beam Diameter at Distance", group: "Laser calculators", source: ANSI,
    equation: "D_L = √(a² + φ²r²)",
    vars: [
      { k: "a", label: "a, beam diameter at the aperture", unit: "cm" },
      { k: "phi", label: "φ, beam divergence", unit: "radians" },
      { k: "r", label: "r, distance from the aperture", unit: "cm" },
      { k: "DL", label: "D_L, beam diameter at distance r", unit: "cm" },
    ],
    solve: {
      a: v => sqrt(v.DL ** 2 - (v.phi * v.r) ** 2),
      phi: v => sqrt(v.DL ** 2 - v.a ** 2) / v.r,
      r: v => sqrt(v.DL ** 2 - v.a ** 2) / v.phi,
      DL: v => sqrt(v.a ** 2 + (v.phi * v.r) ** 2),
    },
    residual: v => v.DL ** 2 - v.a ** 2 - (v.phi * v.r) ** 2,
    primary: "DL", example: { a: 0.2, phi: 0.001, r: 10000 },
  },
  {
    slug: "optical-density", name: "Laser Eyewear Optical Density", group: "Laser calculators", source: ANSI,
    equation: "O.D. = log(I₀ / I)",
    vars: [
      { k: "I0", label: "I₀, incident beam irradiance", unit: "W/cm² (same as I)" },
      { k: "I", label: "I, irradiance allowed through the eyewear, usually the exposure limit", unit: "same as I₀" },
      { k: "OD", label: "O.D., optical density", unit: "unitless" },
    ],
    solve: { I0: v => v.I * 10 ** v.OD, I: v => v.I0 / 10 ** v.OD, OD: v => log10(v.I0 / v.I) },
    residual: v => v.OD - log10(v.I0 / v.I),
    primary: "OD", example: { I0: 10, I: 0.0025 },
  },
];

export const GROUPS = ["Laser calculators"];
