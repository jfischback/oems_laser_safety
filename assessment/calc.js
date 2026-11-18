// Laser hazard evaluation: the math behind the page.
// Formulas, default exposure times, limiting apertures and the OD rounding rule
// come from the UNL EHS Laser Safety Calculation Guide (7/24), which follows
// ANSI Z136.1-2022. All lengths are in cm, power in W, energy in J.
//
// The MPE is entered by the user for now. Automatic MPE from ANSI Z136.1
// Tables 7a–7f will replace that input.

// Gaussian beams: the 1/e² diameter is √2 times the 1/e diameter.
// Safety calculations use 1/e (guide, page 3), so 1/e² inputs are converted.
export const toOneOverE = (d, basis) => (basis === "1/e2" ? d / Math.SQRT2 : d);

// Maximum anticipated exposure durations, seconds (guide Table 1, from ANSI Table 3).
export function defaultExposure(nm, viewing) {
  if (!(nm >= 180)) return null;
  const intrabeam = viewing === "intrabeam";
  if (nm < 400) return intrabeam ? 100 : 30000;
  if (nm < 700) return intrabeam ? 0.25 : 600;
  if (nm < 1400) return intrabeam ? 10 : 600;
  if (nm <= 1e6) return 10;
  return null;
}

// Limiting aperture for the eye, mm (guide Table 3, from ANSI Table 10a).
// Returns null where the guide's excerpt has no value (0.3 to 10 s outside
// 400–1400 nm); the user enters it in that case.
export function defaultAperture(nm, t) {
  if (!(nm >= 180) || !(t > 0)) return null;
  const shortOrLong = (a, b) => (t <= 0.3 ? a : t >= 10 ? b : null);
  if (nm < 400) return shortOrLong(1.0, 3.5);
  if (nm <= 1400) return 7.0;                 // retina, 400–1400 nm
  if (nm <= 1e5) return shortOrLong(1.0, 3.5); // 1400 nm – 100 µm
  if (nm <= 1e6) return 11.0;                 // 100 – 1000 µm
  return null;
}

// "The OD is unit-less and rounded up from 0.05 to the next whole integral" (guide, page 9).
export function roundOD(od) {
  if (!(od > 0)) return 0;
  const whole = Math.floor(od);
  return od - whole >= 0.05 - 1e-9 ? whole + 1 : whole; // tolerance for floating-point rounding
}

// q is the emitted quantity: power Φ (W) for CW, energy per pulse Q (J) for pulsed.
// mpe is in W/cm² for CW, J/cm² per pulse for pulsed. Same formulas either way.
export function evaluate(i) {
  const out = {};
  const { q, mpe } = i;
  if (!(q > 0) || !(mpe > 0)) return out;
  const a = i.a > 0 ? i.a : 0;          // beam diameter at aperture, cm (1/e)
  const phi = i.phi > 0 ? i.phi : null; // divergence, rad (1/e)

  // Exposure at the eye, averaged over the limiting aperture (guide, page 10).
  // When the beam is wider than the aperture, the beam diameter is used instead.
  if (i.Df > 0) {
    const d = Math.max(i.Df, a);
    out.exposure = q / (Math.PI * (d / 2) ** 2);
    out.exposureDiameter = d;
    out.odExact = Math.log10(out.exposure / mpe);
    out.od = roundOD(out.odExact);
  }

  // NOHD of an unaltered beam (guide, page 7).
  if (phi) {
    const inside = (4 * q) / (Math.PI * mpe) - a * a;
    out.nohd = inside > 0 ? Math.sqrt(inside) / phi : 0;
  }
  // NOHD with a lens on the laser.
  if (i.f0 > 0 && i.b0 > 0) out.nohdLens = (i.f0 / i.b0) * Math.sqrt((4 * q) / (Math.PI * mpe));
  // NOHD for fibers: multimode uses NA, single-mode uses spot size ω₀ and wavelength.
  if (i.fiber === "multimode" && i.NA > 0) out.nohdFiber = (1.7 / i.NA) * Math.sqrt(q / (Math.PI * mpe));
  if (i.fiber === "singlemode" && i.w0 > 0 && i.nm > 0) {
    const lambdaCm = i.nm * 1e-7;
    out.nohdFiber = (i.w0 / lambdaCm) * Math.sqrt((Math.PI * q) / (2 * mpe));
  }
  // Reflections (guide, page 8).
  if (i.rho > 0) {
    const cos = Math.cos(((i.theta || 0) * Math.PI) / 180);
    out.nhzDiffuse = cos > 0 ? Math.sqrt((i.rho * q * cos) / (Math.PI * mpe)) : 0;
    if (phi) out.nhzSpecular = (1 / phi) * Math.sqrt((1.27 * i.rho * q) / mpe);
  }
  return out;
}
