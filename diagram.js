// Visual references for the laser and radiation calculators, drawn as 3D model views and charts.
// Each entry takes the full set of values (inputs plus the solved one) and the
// on-screen width, and returns SVG markup (or null when the values can't be drawn).

const fmt = x => {
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e7) return String(Number(x.toPrecision(4)));
  return x.toExponential(3);
};
const pts = list => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const poly = (p, attrs) => `<polygon points="${pts(p)}" ${attrs}/>`;
const line = (p, q, attrs) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" ${attrs}/>`;
const text = (p, s, cls, anchor = "start") => `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="${anchor}" class="m-lbl ${cls}">${s}</text>`;

const KX = 0.42, KY = 0.28; // how depth (z) shows on screen
// Oblique 3D projection: x along the scene, y up, z depth (away from the viewer). All in px.
const projector = (ox, oy) => (x, y, z) => [ox + x + KX * z, oy - y - KY * z];

const sizeOf = widthPx => {
  const W = Math.max(320, Math.min(700, Math.round(widthPx)));
  return { W, narrow: W < 500 };
};

const DEFS = `
  <defs>
    <linearGradient id="m-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>
    <linearGradient id="m-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fca5a5"/><stop offset="0.45" stop-color="#ef4444"/><stop offset="1" stop-color="#991b1b"/></linearGradient>
    <linearGradient id="m-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="m-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>
    <radialGradient id="m-src" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#fef3c7"/><stop offset="0.5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></radialGradient>
    <linearGradient id="m-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="0.45" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient>
    <linearGradient id="m-rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="0.45" stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b21b6"/></linearGradient>
    <linearGradient id="m-lead" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#94a3b8"/><stop offset="1" stop-color="#475569"/></linearGradient>
    <linearGradient id="m-person" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#64748b"/><stop offset="0.5" stop-color="#94a3b8"/><stop offset="1" stop-color="#475569"/></linearGradient>
    <marker id="m-arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#f59e0b"/></marker>
    <linearGradient id="m-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
    <filter id="m-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="m-glow" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

const open = (W, H, label) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${DEFS}
  <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="url(#m-bg)"/>`;
const NOTE = `<p class="dg-note">Beam width is exaggerated so it can be seen. Distances along the beam are to scale.</p>`;

// Circle of radius R in the y-z plane at x (a beam cross-section).
const ring = (P, x, R, cy = 0) => {
  const p = [];
  for (let i = 0; i <= 48; i++) { const t = (i / 48) * 2 * Math.PI; p.push(P(x, cy + R * Math.sin(t), R * Math.cos(t))); }
  return p;
};
const topOf = p => p.reduce((m, q) => (q[1] < m[1] ? q : m), p[0]);
// Outline of a beam whose radius at x is Rf(x), between x1 and x2.
const cone = (P, Rf, x1, x2, n = 40) => {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const rg = ring(P, x1 + (x2 - x1) * i / n, Rf(x1 + (x2 - x1) * i / n));
    let hi = rg[0], lo = rg[0];
    for (const q of rg) { if (q[1] < hi[1]) hi = q; if (q[1] > lo[1]) lo = q; }
    top.push(hi); bot.push(lo);
  }
  return top.concat(bot.reverse());
};

// Laser housing: a shaded box whose front (aperture) face is at x1.
const housing = (P, x0, x1, bh = 20, bz = 20, narrow = false) => {
  const front = [P(x0, -bh, -bz), P(x1, -bh, -bz), P(x1, bh, -bz), P(x0, bh, -bz)];
  const top = [P(x0, bh, -bz), P(x1, bh, -bz), P(x1, bh, bz), P(x0, bh, bz)];
  const end = [P(x1, -bh, -bz), P(x1, -bh, bz), P(x1, bh, bz), P(x1, bh, -bz)];
  const ap = P(x1, 0, 0);
  const mid = [(front[0][0] + front[1][0]) / 2, (front[0][1] + front[2][1]) / 2 + 4];
  return poly(top, `fill="#94a3b8"`) + poly(front, `fill="url(#m-front)"`) + poly(end, `fill="#334155"`)
    + `<circle cx="${ap[0]}" cy="${ap[1]}" r="4" fill="#fecaca" stroke="#ef4444" stroke-width="1.5"/>`
    + text(mid, "LASER", `m-white m-bold${narrow ? " m-xs" : ""}`, "middle");
};

// Floor grid from xa to xb at height y, with optional tinted bands [{x1, x2, fill}].
const floorGrid = (P, xa, xb, y, zN, zF, bands = []) => {
  let s = poly([P(xa, y, zN), P(xb, y, zN), P(xb, y, zF), P(xa, y, zF)], `fill="#ffffff" fill-opacity="0.7"`);
  for (const b of bands) s += poly([P(b.x1, y, zN), P(b.x2, y, zN), P(b.x2, y, zF), P(b.x1, y, zF)], `fill="${b.fill}"`);
  let g = "";
  for (let i = 0; i <= 10; i++) { const x = xa + (xb - xa) * i / 10; g += line(P(x, y, zN), P(x, y, zF), ""); }
  for (let j = 0; j <= 6; j++) { const z = zN + (zF - zN) * j / 6; g += line(P(xa, y, z), P(xb, y, z), ""); }
  return s + `<g stroke="#cbd5e1" stroke-width="0.8">${g}</g>`;
};

// Dimension between two screen points, with end ticks and a label under the start.
const dim = (p, q, label, labelAt = null, anchor = "start") =>
  line(p, q, `stroke="#15171c" stroke-width="1.5"`)
  + line([p[0], p[1] - 6], [p[0], p[1] + 6], `stroke="#15171c" stroke-width="1.5"`)
  + line([q[0], q[1] - 6], [q[0], q[1] + 6], `stroke="#15171c" stroke-width="1.5"`)
  + text(labelAt || [p[0], p[1] + 22], label, "m-bold", anchor);

const callout = (from, to, label, anchor = "start") =>
  line(from, [to[0], to[1] + (to[1] > from[1] ? -12 : 4)], `stroke="#334155" stroke-width="1"`)
  + text([to[0] + (anchor === "end" ? -4 : 0), to[1]], label, "", anchor);

// ---------------------------------------------------------------------------
// Straight diverging beam from an aperture: used by the direct-beam NHZ, the
// Ds (TL form) and the beam-diameter calculators.
function divergingBeam({ widthPx, a, phi, r, rName, dName, limit, zone, edge }) {
  if (!(r > 0) || !(a >= 0) || !(phi > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 330 : 360;
  const xA = narrow ? 92 : 132, xFar = W - (narrow ? 48 : 70), axisY = narrow ? 150 : 160;
  const P = projector(0, axisY);
  const rMax = r * (narrow ? 1.5 : 1.3);
  const sx = d => xA + (d / rMax) * (xFar - xA);
  const dia = d => Math.sqrt(a * a + (phi * d) ** 2);
  const maxR = narrow ? 46 : 58;
  const R = x => Math.max(3, (dia(((x - xA) / (xFar - xA)) * rMax) / dia(rMax)) * maxR);

  const xR = sx(r), boxPx = narrow ? 54 : 64;
  const floorY = -(maxR + 34), zN = -70, zF = 110;
  const hazard = !!limit;
  const bands = hazard ? [{ x1: xA, x2: xR, fill: "#fde8e6" }, { x1: xR, x2: xFar, fill: "#e6f2ea" }] : [];
  const pH = maxR + 22, pZ = 80;
  const plane = [P(xR, -pH, -pZ), P(xR, -pH, pZ), P(xR, pH, pZ), P(xR, pH, -pZ)];
  const planeColor = hazard ? "#b42318" : "#1d4ed8";
  const ringR = ring(P, xR, R(xR));
  const rt = topOf(ringR), ap = P(xA, 0, 0), planeTop = P(xR, pH, pZ);

  let s = open(W, H, `3D view of the laser beam: ${dName} = ${fmt(dia(r))} cm at ${rName} = ${fmt(r)} cm.`);
  s += floorGrid(P, xA - boxPx, xFar, floorY, zN, zF, bands);
  if (hazard) s += line(P(xR, floorY, zN), P(xR, floorY, zF), `stroke="#b42318" stroke-width="2"`);
  s += poly(cone(P, R, xR, xFar), `fill="url(#m-beam)" fill-opacity="${hazard ? 0.28 : 0.7}"`);
  s += poly(cone(P, R, xA, xR), `fill="url(#m-beam)" fill-opacity="0.85" filter="url(#m-glow)"`);
  s += poly(plane, `fill="${planeColor}" fill-opacity="0.10" stroke="${planeColor}" stroke-width="1.4"`);
  s += poly(ringR, `fill="${hazard ? "#fecaca" : "#dbeafe"}" fill-opacity="0.65" stroke="${planeColor}" stroke-width="1.6"`);
  s += text([planeTop[0] - 4, planeTop[1] - 8], hazard ? edge : `At ${rName}`, `m-bold ${hazard ? "m-red" : "m-blue"}`, "end");
  s += housing(P, xA - boxPx, xA, 20, 20, narrow);
  if (hazard) {
    s += text([xA, 30], `${zone}: above ${limit}`, "m-red m-bold");
    s += text([W - 12, 30], `Below ${limit}`, "m-green m-bold", "end");
  }
  s += callout(rt, [rt[0] - 10, rt[1] - 34], `${dName} = ${fmt(dia(r))} cm`, "end");
  s += callout([ap[0], ap[1] + 4], [ap[0] + 6, ap[1] + 44], `a = ${fmt(a)} cm`);
  s += dim(P(xA, floorY, zN + 6), P(xR, floorY, zN + 6), `${rName} = ${fmt(r)} cm (${fmt(r / 100)} m)`);
  return s + `</svg>` + NOTE;
}

// ---------------------------------------------------------------------------
// Lens on the laser: the beam focuses at f0, then spreads out to the NHZ.
function lensBeam({ widthPx, f0, b0, r }) {
  if (!(r > 0) || !(f0 > 0) || !(b0 > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 318 : 340;
  const xL = narrow ? 104 : 148, xFar = W - (narrow ? 48 : 70), axisY = narrow ? 150 : 160;
  const P = projector(0, axisY);
  const rMax = Math.max(r * (narrow ? 1.5 : 1.3), f0 * 1.5);
  const span = xFar - xL;
  // The focus is usually very close to the lens; it is moved out to at least 12% of the drawing so it can be seen.
  const fFrac = Math.max(f0 / rMax, 0.12);
  const enlarged = f0 / rMax < 0.12;
  const sx = d => d <= f0 ? xL + (d / f0) * fFrac * span : xL + (fFrac + (d - f0) / (rMax - f0) * (1 - fFrac)) * span;
  const xF = sx(f0), xR = sx(r);
  const maxR = narrow ? 46 : 58, lensR = maxR * 0.45;
  // Converges from the lens to the focus, then grows in proportion to the true diameter.
  const trueD = d => b0 * Math.abs(d - f0) / f0;
  const after = x => {
    const d = f0 + ((x - xF) / (xFar - xF)) * (rMax - f0);
    return Math.max(2, (trueD(d) / trueD(rMax)) * maxR);
  };
  const Rf = x => x <= xF ? Math.max(1.5, lensR * (xF - x) / (xF - xL)) : after(x);

  const boxPx = narrow ? 54 : 64, gap = narrow ? 8 : 12;
  const floorY = -(maxR + 34), zN = -70, zF = 110;
  const pH = maxR + 22, pZ = 80;
  const plane = [P(xR, -pH, -pZ), P(xR, -pH, pZ), P(xR, pH, pZ), P(xR, pH, -pZ)];
  const ringR = ring(P, xR, Rf(xR)), rt = topOf(ringR), planeTop = P(xR, pH, pZ);
  const lensTop = P(xL, lensR + 6, 0), focus = P(xF, 0, 0);

  let s = open(W, H, `3D view of a laser with a lens: focus at ${fmt(f0)} cm, NHZ at ${fmt(r)} cm from the lens.`);
  s += floorGrid(P, xL - gap - boxPx, xFar, floorY, zN, zF, [{ x1: xL, x2: xR, fill: "#fde8e6" }, { x1: xR, x2: xFar, fill: "#e6f2ea" }]);
  s += line(P(xR, floorY, zN), P(xR, floorY, zF), `stroke="#b42318" stroke-width="2"`);
  s += poly(cone(P, Rf, xR, xFar), `fill="url(#m-beam)" fill-opacity="0.28"`);
  s += poly(cone(P, Rf, xL, xR, 80), `fill="url(#m-beam)" fill-opacity="0.85" filter="url(#m-glow)"`);
  // Short collimated beam from the aperture to the lens.
  s += poly(cone(P, () => lensR, xL - gap, xL, 4), `fill="url(#m-beam)" fill-opacity="0.85"`);
  s += poly(plane, `fill="#b42318" fill-opacity="0.10" stroke="#b42318" stroke-width="1.4"`);
  s += poly(ringR, `fill="#fecaca" fill-opacity="0.65" stroke="#b42318" stroke-width="1.6"`);
  s += text([planeTop[0] - 4, planeTop[1] - 8], "NHZ boundary", "m-red m-bold", "end");
  s += housing(P, xL - gap - boxPx, xL - gap, lensR + 8, lensR + 8, narrow);
  // Lens: a glass disk.
  s += poly(ring(P, xL + 2, lensR + 6), `fill="#0369a1" fill-opacity="0.5"`);
  s += poly(ring(P, xL - 2, lensR + 6), `fill="url(#m-glass)" fill-opacity="0.9" stroke="#0369a1" stroke-width="1.2"`);
  s += `<circle cx="${focus[0]}" cy="${focus[1]}" r="3.5" fill="#fff" stroke="#b42318" stroke-width="1.5"/>`;
  s += text([xL, 30], "Inside NHZ: above EL", "m-red m-bold");
  s += text([W - 12, 30], "Below EL", "m-green m-bold", "end");
  s += callout(lensTop, [lensTop[0] + 4, lensTop[1] - 26], `b₀ = ${fmt(b0)} cm`);
  s += callout([focus[0], focus[1] + 4], [focus[0] + 6, focus[1] + 50], "focal point");
  s += callout(rt, [rt[0] - 10, rt[1] - 34], `D = ${fmt(trueD(r))} cm`, "end");
  const yF = floorY, z = zN + 6;
  s += dim(P(xL, yF, z), P(xR, yF, z), `r_NHZ = ${fmt(r)} cm (${fmt(r / 100)} m)${narrow ? "" : ", from the lens"}`);
  // f0 dimension just above the floor dimension.
  const f1 = P(xL, yF + 16, z), f2 = P(xF, yF + 16, z);
  s += line(f1, f2, `stroke="#0369a1" stroke-width="1.5"`) + line([f2[0], f2[1] - 5], [f2[0], f2[1] + 5], `stroke="#0369a1" stroke-width="1.5"`);
  s += text([f2[0] + 6, f2[1] + 4], `f₀ = ${fmt(f0)} cm`, "m-blue m-bold");
  return s + `</svg><p class="dg-note">Beam width is exaggerated so it can be seen.${enlarged ? " r_NHZ is measured from the lens. The lens-to-focus distance is enlarged so the focus can be seen; other distances along the beam are to scale." : " r_NHZ is measured from the lens. Distances along the beam are to scale."}</p>`;
}

// ---------------------------------------------------------------------------
// Diffuse reflection: the hazard zone is a lobe over the spot, r(θ) = r₀√cosθ.
function diffuse({ widthPx, rho, PHI, theta, EL, r }) {
  const th = theta * Math.PI / 180;
  if (!(r > 0) || !(Math.cos(th) > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 340 : 370;
  const cx = narrow ? W * 0.5 : W * 0.48, groundY = narrow ? 262 : 286;
  const P = projector(cx, groundY);
  const r0 = r / Math.sqrt(Math.cos(th));               // reach straight out along the normal
  const Lpx = narrow ? 128 : 200;                       // r₀ on screen
  const k = Lpx / r0;
  const rpx = t => r0 * Math.sqrt(Math.cos(t)) * k;

  // Lobe: rings at heights r(t)cos t with radius r(t)sin t, outlined by their convex hull.
  const lobePts = [];
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * (Math.PI / 2 - 0.001), rr = rpx(t);
    const rad = rr * Math.sin(t), h = rr * Math.cos(t);
    for (let j = 0; j < 36; j++) { const u = (j / 36) * 2 * Math.PI; lobePts.push(P(rad * Math.cos(u), h, rad * Math.sin(u))); }
  }
  const hull = convexHull(lobePts);
  const midRings = [0.35, 0.7, 1.0].map(f => {
    const t = Math.acos(Math.min(1, f)), rr = rpx(t); // rings at several heights
    const rad = rr * Math.sin(t), h = rr * Math.cos(t), p = [];
    for (let j = 0; j <= 48; j++) { const u = (j / 48) * 2 * Math.PI; p.push(P(rad * Math.cos(u), h, rad * Math.sin(u))); }
    return p;
  });

  const half = narrow ? 140 : 230;
  const surf = [P(-half, 0, -90), P(half, 0, -90), P(half, 0, 140), P(-half, 0, 140)];
  let g = "";
  for (let i = 0; i <= 10; i++) { const x = -half + 2 * half * i / 10; g += line(P(x, 0, -90), P(x, 0, 140), ""); }
  for (let j = 0; j <= 6; j++) { const z = -90 + 230 * j / 6; g += line(P(-half, 0, z), P(half, 0, z), ""); }

  // Incident beam from the upper left onto the spot.
  const inc = -0.6, len = narrow ? 230 : 260;
  const src = P(-Math.sin(-inc) * len, Math.cos(inc) * len, 0);
  const spot = P(0, 0, 0);
  // Viewing direction at θ from the normal, toward the right.
  const vEnd = P(rpx(th) * Math.sin(th), rpx(th) * Math.cos(th), 0);
  const normalTop = P(0, Lpx + 26, 0);
  const arcR = 34, arc = [];
  for (let i = 0; i <= 20; i++) { const t = th * i / 20; arc.push(P(arcR * Math.sin(t), arcR * Math.cos(t), 0)); }
  const thLbl = P((arcR + 14) * Math.sin(th / 2 || 0.15), (arcR + 14) * Math.cos(th / 2 || 0.15), 0);

  let s = open(W, H, `3D view of the diffuse reflection hazard zone: ${fmt(r)} cm at ${fmt(theta)} degrees from the normal.`);
  s += poly(surf, `fill="#e2e8f0"`) + `<g stroke="#cbd5e1" stroke-width="0.8">${g}</g>`;
  s += text([12, 30], "Inside lobe: above EL", "m-red m-bold");
  s += poly(hull, `fill="#ef4444" fill-opacity="0.16" stroke="#b42318" stroke-width="1.4"`);
  for (const rg of midRings) s += poly(rg, `fill="none" stroke="#b42318" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="4 3"`);
  s += line(src, spot, `stroke="#ef4444" stroke-width="5" stroke-linecap="round" filter="url(#m-glow)"`);
  s += `<circle cx="${spot[0]}" cy="${spot[1]}" r="5" fill="#fecaca" stroke="#ef4444" stroke-width="2"/>`;
  s += text([12, 50], `Incident beam, Φ = ${fmt(PHI)} W`, "m-red");
  s += line(spot, normalTop, `stroke="#64748b" stroke-width="1" stroke-dasharray="5 4"`);
  s += text([normalTop[0] - 6, normalTop[1] + 8], "normal", "m-muted", "end");
  if (th > 0.02) s += `<polyline points="${pts(arc)}" fill="none" stroke="#1d4ed8" stroke-width="1.4"/>` + text([thLbl[0] + 2, thLbl[1] + 4], `θ = ${fmt(theta)}°`, "m-blue m-bold");
  s += line(spot, vEnd, `stroke="#15171c" stroke-width="1.8"`);
  s += `<circle cx="${vEnd[0]}" cy="${vEnd[1]}" r="3.5" fill="#15171c"/>`;
  // Distance shown in the top-right corner so it stays readable at any angle.
  s += text([W - 12, 30], `r_NHZ = ${fmt(r)} cm`, "m-bold", "end");
  s += text([W - 12, 48], `(${fmt(r / 100)} m) at θ`, "m-bold", "end");
  s += text([12, H - 14], `reflecting surface, ρ = ${fmt(rho)}`, "m-muted");
  return s + `</svg><p class="dg-note">The hazard zone is shaped like a lobe: it reaches farthest straight out from the surface and shrinks toward grazing angles. The dashed rings show its shape at different heights. Drawn to scale.</p>`;
}

function convexHull(p) {
  const q = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const x of q) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], x) <= 0) lo.pop(); lo.push(x); }
  for (const x of q.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], x) <= 0) up.pop(); up.push(x); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ---------------------------------------------------------------------------
// Eyewear optical density: the beam passes through a filter and comes out weaker.
function eyewear({ widthPx, I0, I, OD, unit = "W/cm²" }) {
  if (!(I0 > 0) || !(I > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 300 : 320;
  const axisY = narrow ? 140 : 150;
  const P = projector(0, axisY);
  const x0 = narrow ? 86 : 120, xLens = W * (narrow ? 0.56 : 0.58), xEnd = W - (narrow ? 40 : 60);
  const Rb = narrow ? 30 : 36, boxPx = narrow ? 54 : 64;
  const factor = I0 / I;
  // The beam after the filter is drawn fainter; its brightness steps down with OD so the change is visible.
  const outOpacity = Math.max(0.08, 0.85 / (1 + Math.max(0, OD)));
  const floorY = -(Rb + 44), zN = -70, zF = 110;
  const lensR = Rb + 18;
  const lens = ring(P, xLens, lensR), lensBack = ring(P, xLens + 7, lensR);
  const lt = topOf(lens);
  const pin = P((x0 + xLens) / 2, Rb, 0), pout = P((xLens + xEnd) / 2, Rb, 0);

  let s = open(W, H, `3D view of laser eyewear: optical density ${fmt(OD)} reduces irradiance ${fmt(factor)} times.`);
  s += floorGrid(P, x0 - boxPx, xEnd, floorY, zN, zF);
  s += poly(cone(P, () => Rb, xLens, xEnd, 4), `fill="url(#m-beam)" fill-opacity="${outOpacity.toFixed(2)}"`);
  s += poly(lensBack, `fill="#0f766e" fill-opacity="0.55"`);
  s += poly(cone(P, () => Rb, x0, xLens, 4), `fill="url(#m-beam)" fill-opacity="0.85" filter="url(#m-glow)"`);
  s += poly(lens, `fill="#14b8a6" fill-opacity="0.45" stroke="#0f766e" stroke-width="1.6"`);
  s += housing(P, x0 - boxPx, x0, Rb + 4, Rb + 4, narrow);
  const lb = lens.reduce((m, q) => (q[1] > m[1] ? q : m), lens[0]);
  s += text([lb[0], lb[1] + 18], "eyewear filter", "m-teal m-bold", "middle");
  s += callout(pin, [pin[0] - 6, pin[1] - 40], `I₀ = ${fmt(I0)} ${unit}`, "end");
  s += narrow ? callout(pout, [W - 12, pout[1] - 40], `I = ${fmt(I)} ${unit}`, "end") : callout(pout, [pout[0] + 6, pout[1] - 40], `I = ${fmt(I)} ${unit}`);
  s += text([W - 12, H - 40], "toward the eye →", "m-muted", "end");
  s += text([12, H - 34], `O.D. ${fmt(OD)}`, "m-teal m-bold m-big");
  s += text([12, H - 14], `cuts irradiance by ${fmt(factor)}×`, "m-bold");
  return s + `</svg><p class="dg-note">Each 1.0 of optical density cuts the beam by 10×. The beam's brightness after the filter is shown for illustration, not to scale.</p>`;
}

// ===========================================================================
// Ionizing radiation and RF
// ===========================================================================

// Glowing radioactive source at screen point c.
const source = (c, r = 11) =>
  `<circle cx="${c[0]}" cy="${c[1]}" r="${r + 9}" fill="#fbbf24" fill-opacity="0.25" filter="url(#m-glow)"/>`
  + `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="url(#m-src)" stroke="#b45309" stroke-width="1.2"/>`;

// Simple 3D-ish person standing on the floor at screen point foot, height h px.
const person = (foot, h) => {
  const w = h * 0.26, head = h * 0.12;
  const [x, y] = foot;
  return `<g>
    <rect x="${x - w / 2}" y="${y - h * 0.78}" width="${w}" height="${h * 0.78}" rx="${w * 0.45}" fill="url(#m-person)"/>
    <circle cx="${x}" cy="${y - h * 0.78 - head - 2}" r="${head}" fill="url(#m-person)"/>
  </g>`;
};

// ---------------------------------------------------------------------------
// Shield slab between a source and the far side. layers = number of HVLs or
// TVLs in the slab (null for the buildup calculator), f = 0.5 or 0.1.
function shield({ widthPx, I0, I, layers, f, layerName, xLabel, layerLabel, buildup }) {
  if (!(I0 > 0) || !(I >= 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 330 : 350;
  const axisY = narrow ? 170 : 175;
  const P = projector(0, axisY);
  const xS = narrow ? 34 : 50, x1 = W * (narrow ? 0.36 : 0.36), x2 = W * (narrow ? 0.62 : 0.62), xEnd = W - (narrow ? 26 : 50);
  const Rb = narrow ? 16 : 20, sH = narrow ? 62 : 70, sZ = narrow ? 44 : 54;
  const floorY = -(sH + 4), zN = -70, zF = 110;

  // Beam after the shield: fainter as more is removed (log scale, for illustration).
  const ratio = I > 0 ? I / I0 : 0;
  const outOp = ratio > 0 ? Math.max(0.1, 0.85 * (1 + Math.log10(Math.min(1, ratio)) / 4)) : 0.06;

  const front = [P(x1, -sH, -sZ), P(x2, -sH, -sZ), P(x2, sH, -sZ), P(x1, sH, -sZ)];
  const top = [P(x1, sH, -sZ), P(x2, sH, -sZ), P(x2, sH, sZ), P(x1, sH, sZ)];
  const side = [P(x2, -sH, -sZ), P(x2, -sH, sZ), P(x2, sH, sZ), P(x2, sH, -sZ)];

  let s = open(W, H, `3D view of radiation passing through a shield: ${fmt(I0)} going in, ${fmt(I)} coming out.`);
  s += floorGrid(P, xS - 20, xEnd, floorY, zN, zF);
  s += poly(cone(P, () => Rb, x2, xEnd, 4), `fill="url(#m-ray)" fill-opacity="${outOp.toFixed(2)}"`);
  s += poly(cone(P, () => Rb, xS, x1, 4), `fill="url(#m-ray)" fill-opacity="0.85" filter="url(#m-glow)"`);
  s += source(P(xS, 0, 0));

  // The slab, sliced into its HVL/TVL layers when there are few enough to draw.
  s += poly(top, `fill="#cbd5e1"`) + poly(front, `fill="url(#m-lead)"`) + poly(side, `fill="#64748b"`);
  const n = layers;
  if (n && n > 0 && n <= 12) {
    for (let k = 1; k < n; k++) {
      const xk = x1 + (x2 - x1) * k / n;
      s += line(P(xk, -sH, -sZ), P(xk, sH, -sZ), `stroke="#f8fafc" stroke-opacity="0.55" stroke-width="1.2"`);
      s += line(P(xk, sH, -sZ), P(xk, sH, sZ), `stroke="#64748b" stroke-width="1"`);
    }
    // Intensity after each whole layer, when there is room to print them.
    const maxLbl = narrow ? 3 : 6;
    if (n <= maxLbl && Number.isInteger(Math.round(n * 1e6) / 1e6)) {
      for (let k = 1; k <= Math.round(n); k++) {
        const xm = x1 + (x2 - x1) * (k - 0.5) / n;
        const p = P(xm, sH, 0);
        s += text([p[0], p[1] - 8], fmt(I0 * f ** k), "m-xs m-bold", "middle");
      }
      s += text([P(x1, sH, sZ)[0], P(x1, sH, sZ)[1] - 24], `after each ${layerName}:`, "m-muted", "start");
    }
  }
  if (buildup) {
    // Scattered rays leaving the back of the shield, which is what B accounts for.
    for (const [dy, dz, len] of [[30, -10, 50], [-34, 6, 46], [16, 40, 40], [-14, -36, 44], [44, 20, 36]]) {
      const a = P(x2, dy * 0.8, dz), b = P(x2 + len, dy * 1.6, dz * 1.3);
      s += line(a, b, `stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="4 3" marker-end="url(#m-arw)"`);
    }
  }

  // Labels.
  if (narrow) {
    // Below the beam on phones, so they don't run into the layer values on top of the shield.
    const pin = P((xS + x1) / 2, -Rb, 0), pout = P((x2 + xEnd) / 2, -Rb, 0);
    s += callout(pin, [pin[0] - 10, pin[1] + 34], `I₀ = ${fmt(I0)}`, "end");
    s += callout(pout, [W - 12, pout[1] + 34], `I = ${fmt(I)}`, "end");
  } else {
    const pin = P((xS + x1) / 2, Rb, 0), pout = P((x2 + xEnd) / 2, Rb, 0);
    s += callout(pin, [pin[0] - 4, pin[1] - 50], `I₀ = ${fmt(I0)}`);
    s += callout(pout, [Math.min(pout[0] + 6, W - 12), pout[1] - 50], `I = ${fmt(I)}`, pout[0] + 70 > W ? "end" : "start");
  }
  const d1 = P(x1, floorY, zN + 6), d2 = P(x2, floorY, zN + 6);
  s += dim(d1, d2, xLabel, [d1[0], d1[1] + 22]);
  if (layerLabel && n && n > 1 && n <= 12) {
    const e = P(x1 + (x2 - x1) / n, floorY, zN + 6);
    s += line([e[0], e[1] - 6], [e[0], e[1] + 6], `stroke="#1d4ed8" stroke-width="1.5"`);
    s += text([d1[0], d1[1] + 40], layerLabel, "m-blue m-bold");
  }
  s += text([W - 12, H - 14], "radiation →", "m-muted", "end");
  const note = buildup
    ? `The dashed rays are scattered radiation that still gets through the shield. The buildup factor B adds it back in: I = I₀ × B × e^(−μx).`
    : `Each ${layerName} cuts the intensity ${f === 0.5 ? "in half" : "to one tenth"}. The shield is drawn to show its layers, not to scale.`;
  return s + `</svg><p class="dg-note">${note}</p>`;
}

// ---------------------------------------------------------------------------
// Inverse square law: the same radiation spreads over spheres of radius d₁ and d₂.
function inverseSquare({ widthPx, I1, d1, I2, d2 }) {
  if (!(d1 > 0) || !(d2 > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 320 : 340;
  const cx = narrow ? W * 0.46 : W * 0.4, cy = H * 0.5 + 10;
  const dMax = Math.max(d1, d2);
  const Rmax = Math.min(cx - 12, W - cx - (narrow ? 34 : 60), H * 0.4);
  const k = Rmax / dMax;
  const sphere = (R, color, op) => {
    const eq = [];
    for (let i = 0; i <= 64; i++) { const t = (i / 64) * 2 * Math.PI; eq.push([cx + R * Math.cos(t), cy + R * 0.28 * Math.sin(t)]); }
    return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}" fill-opacity="${op}" stroke="${color}" stroke-opacity="0.7" stroke-width="1.3"/>`
      + `<polyline points="${pts(eq)}" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="4 3"/>`;
  };
  const near = d1 <= d2 ? { d: d1, I: I1, n: "1" } : { d: d2, I: I2, n: "2" };
  const far = d1 <= d2 ? { d: d2, I: I2, n: "2" } : { d: d1, I: I1, n: "1" };
  const pN = [cx + near.d * k, cy], pF = [cx + far.d * k, cy];

  let s = open(W, H, `Inverse square law: ${fmt(I1)} at distance ${fmt(d1)}, ${fmt(I2)} at distance ${fmt(d2)}.`);
  s += sphere(far.d * k, "#2563eb", 0.06) + sphere(near.d * k, "#f59e0b", 0.12);
  s += line([cx, cy], pF, `stroke="#334155" stroke-width="1" stroke-dasharray="3 3"`);
  s += source([cx, cy], 9);
  s += `<circle cx="${pN[0]}" cy="${pN[1]}" r="5" fill="#b45309"/><circle cx="${pF[0]}" cy="${pF[1]}" r="5" fill="#1d4ed8"/>`;
  const ln = narrow ? 18 : 22;
  s += text([pN[0], pN[1] - ln], `I${near.n === "1" ? "₁" : "₂"} = ${fmt(near.I)}`, "m-bold m-amber", "middle");
  s += text([pN[0], pN[1] + ln + 8], `d${near.n === "1" ? "₁" : "₂"} = ${fmt(near.d)}`, "", "middle");
  s += text([Math.min(pF[0], W - 12), pF[1] - ln], `I${far.n === "1" ? "₁" : "₂"} = ${fmt(far.I)}`, "m-bold m-blue", pF[0] + 40 > W ? "end" : "middle");
  s += text([Math.min(pF[0], W - 12), pF[1] + ln + 8], `d${far.n === "1" ? "₁" : "₂"} = ${fmt(far.d)}`, "", pF[0] + 40 > W ? "end" : "middle");
  const ratio = (far.d / near.d) ** 2;
  s += text([12, 26], `${fmt(far.d / near.d)}× the distance → ${fmt(ratio)}× the area → 1/${fmt(ratio)} the intensity`, `m-bold${narrow ? " m-xs" : ""}`);
  return s + `</svg><p class="dg-note">The same radiation passes through both spheres. The bigger sphere has more surface area, so each spot on it gets less. Drawn to scale.</p>`;
}

// ---------------------------------------------------------------------------
// Gamma dose rate at a person standing d from a point source.
function gammaDose({ widthPx, Gamma, A, d, D }) {
  if (!(d > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 310 : 330;
  const floorY = -60, zN = -60, zF = 120;
  const P = projector(0, narrow ? 190 : 200);
  const xS = narrow ? 60 : 90, xP = W - (narrow ? 70 : 110);
  const src = P(xS, 0, 0), foot = P(xP, floorY, 0);
  const dh = narrow ? 120 : 130;

  let s = open(W, H, `Gamma dose rate: ${fmt(D)} R/hr at ${fmt(d)} m from a ${fmt(A)} Ci source.`);
  s += floorGrid(P, xS - 40, W - 20, floorY, zN, zF);
  s += line(P(xS, floorY, 0), src, `stroke="#94a3b8" stroke-width="3"`);
  s += line(src, [foot[0] - 14, foot[1] - dh * 0.6], `stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 4"`);
  s += source(src);
  s += person(foot, dh);
  s += text([src[0], src[1] - 26], `A = ${fmt(A)} Ci`, "m-bold m-amber", "middle");
  s += text([src[0], src[1] - 42], `Γ = ${fmt(Gamma)}`, "m-muted", "middle");
  s += text([foot[0], foot[1] - dh - 14], `D = ${fmt(D)} R/hr`, "m-bold m-red", "middle");
  const a = P(xS, floorY, zN + 6), b = P(xP, floorY, zN + 6);
  s += dim(a, b, `d = ${fmt(d)} m`, [(a[0] + b[0]) / 2, a[1] + 22], "middle");
  return s + `</svg><p class="dg-note">Dose rate drops with the square of distance: at half the distance it would be 4× higher.</p>`;
}

// ---------------------------------------------------------------------------
// RF antenna: main beam out to the distance where power density falls to the EL.
function rfDistance({ widthPx, P: Pw, G, EL, r }) {
  if (!(r > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 330 : 360;
  const xA = narrow ? 80 : 120, xFar = W - (narrow ? 40 : 60), axisY = narrow ? 150 : 158;
  const P = projector(0, axisY);
  const rMax = r * (narrow ? 1.5 : 1.3);
  const sx = d => xA + (d / rMax) * (xFar - xA);
  const xR = sx(r);
  const maxR = narrow ? 52 : 64;
  const Rf = x => 10 + (x - xA) / (xFar - xA) * (maxR - 10);
  const floorY = -(maxR + 40), zN = -70, zF = 110;

  // Antenna panel on a mast.
  const pw = 10, ph = 30, pz = 18;
  const face = [P(xA, -ph, -pz), P(xA, ph, -pz), P(xA, ph, pz), P(xA, -ph, pz)];
  const back = [P(xA - pw, -ph, -pz), P(xA, -ph, -pz), P(xA, ph, -pz), P(xA - pw, ph, -pz)];
  const topF = [P(xA - pw, ph, -pz), P(xA, ph, -pz), P(xA, ph, pz), P(xA - pw, ph, pz)];

  // Wavefront arcs inside the beam.
  let waves = "";
  for (let i = 1; i <= 7; i++) {
    const x = xA + (xFar - xA) * i / 8, R = Rf(x), arc = [];
    for (let j = 0; j <= 24; j++) { const t = -Math.PI / 2 + Math.PI * j / 24; arc.push(P(x, R * Math.sin(t) * 0.92, R * Math.cos(t) * 0.92 - R * 0.0)); }
    waves += `<polyline points="${pts(arc)}" fill="none" stroke="#fff" stroke-opacity="${x < xR ? 0.7 : 0.4}" stroke-width="1.4"/>`;
  }
  const pH = maxR + 22, pZ = 80;
  const plane = [P(xR, -pH, -pZ), P(xR, -pH, pZ), P(xR, pH, pZ), P(xR, pH, -pZ)];
  const planeTop = P(xR, pH, pZ);

  let s = open(W, H, `RF exposure: power density is above the exposure limit out to ${fmt(r)} cm from the antenna.`);
  s += floorGrid(P, xA - 40, xFar, floorY, zN, zF, [{ x1: xA, x2: xR, fill: "#fde8e6" }, { x1: xR, x2: xFar, fill: "#e6f2ea" }]);
  s += line(P(xR, floorY, zN), P(xR, floorY, zF), `stroke="#b42318" stroke-width="2"`);
  s += line(P(xA - pw / 2, floorY, 0), P(xA - pw / 2, -ph, 0), `stroke="#94a3b8" stroke-width="5"`);
  s += poly(cone(P, Rf, xR, xFar), `fill="url(#m-rf)" fill-opacity="0.3"`);
  s += poly(cone(P, Rf, xA, xR), `fill="url(#m-rf)" fill-opacity="0.8" filter="url(#m-glow)"`);
  s += waves;
  s += poly(plane, `fill="#b42318" fill-opacity="0.10" stroke="#b42318" stroke-width="1.4"`);
  s += text([planeTop[0] - 4, planeTop[1] - 8], "EL boundary", "m-red m-bold", "end");
  s += poly(topF, `fill="#cbd5e1"`) + poly(back, `fill="url(#m-front)"`) + poly(face, `fill="#e2e8f0" stroke="#475569" stroke-width="1"`);
  s += text([12, 26], "Inside r: above EL", "m-red m-bold");
  s += text([W - 12, 26], "Below EL", "m-green m-bold", "end");
  s += text([12, 44], `P = ${fmt(Pw)} mW, G = ${fmt(G)}`, "m-muted");
  const a = P(xA, floorY, zN + 6), b = P(xR, floorY, zN + 6);
  s += dim(a, b, `r = ${fmt(r)} cm (${fmt(r / 100)} m)`);
  return s + `</svg><p class="dg-note">r is measured along the antenna's main beam, the direction its gain applies to. Beam width is for illustration; distances along the beam are to scale.</p>`;
}

// ---------------------------------------------------------------------------
// Charts for decay.
function chartFrame(W, H, m, xMax, yLabel, xLabel) {
  const x = v => m.l + (v / xMax) * (W - m.l - m.r);
  const y = v => m.t + (1 - v) * (H - m.t - m.b);
  let s = `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="#fff" fill-opacity="0.75" rx="4"/>`;
  for (const f of [0.25, 0.5, 0.75, 1]) {
    s += line([m.l, y(f)], [W - m.r, y(f)], `stroke="#e2e8f0" stroke-width="1"`);
    s += text([m.l - 6, y(f) + 4], `${f * 100}%`, "m-xs m-muted", "end");
  }
  s += line([m.l, y(0)], [W - m.r, y(0)], `stroke="#94a3b8" stroke-width="1.2"`) + line([m.l, y(0)], [m.l, m.t], `stroke="#94a3b8" stroke-width="1.2"`);
  s += text([(m.l + W - m.r) / 2, H - 8], xLabel, "m-xs m-muted", "middle");
  s += `<text x="14" y="${(m.t + H - m.b) / 2}" transform="rotate(-90 14 ${(m.t + H - m.b) / 2})" text-anchor="middle" class="m-lbl m-xs m-muted">${yLabel}</text>`;
  return { s, x, y };
}
const curve = (x, y, xMax, T, attrs) => {
  const p = [];
  for (let i = 0; i <= 120; i++) { const t = xMax * i / 120; p.push([x(t), y(0.5 ** (t / T))]); }
  return `<polyline points="${pts(p)}" fill="none" ${attrs}/>`;
};

function decayChart({ widthPx, A0, A, t, Thalf }) {
  if (!(Thalf > 0) || !(t >= 0) || !(A0 > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 280 : 300;
  const xMax = Math.max(t * 1.25, Thalf * 4);
  const { s: frame, x, y } = chartFrame(W, H, { l: 46, r: 16, t: 34, b: 40 }, xMax, "activity left", "time (same unit as T½)");
  let s = open(W, H, `Radioactive decay: ${fmt(A)} of ${fmt(A0)} left after ${fmt(t)}.`) + frame;
  const nT = Math.floor(xMax / Thalf);
  for (let k = 1; k <= nT && k <= 12; k++) {
    s += line([x(k * Thalf), y(0)], [x(k * Thalf), y(0.5 ** k)], `stroke="#cbd5e1" stroke-dasharray="3 3"`);
    if (k <= (narrow ? 4 : 6)) s += text([x(k * Thalf), y(0) + 14], `${k} T½`, "m-xs m-muted", "middle");
  }
  s += curve(x, y, xMax, Thalf, `stroke="#f59e0b" stroke-width="3"`);
  const f = A / A0, px = x(t), py = y(f);
  s += line([px, y(0)], [px, py], `stroke="#b45309" stroke-dasharray="4 3"`) + line([x(0), py], [px, py], `stroke="#b45309" stroke-dasharray="4 3"`);
  s += `<circle cx="${px}" cy="${py}" r="5.5" fill="#b45309" stroke="#fff" stroke-width="2"/>`;
  s += `<circle cx="${x(0)}" cy="${y(1)}" r="4.5" fill="#f59e0b"/>`;
  s += text([x(0) + 8, y(1) - 8], `A₀ = ${fmt(A0)}`, "m-bold");
  const right = px > W * 0.6;
  s += text([px + (right ? -10 : 10), py - 10], `A = ${fmt(A)} at t = ${fmt(t)}`, "m-bold m-amber", right ? "end" : "start");
  s += text([W - 16, 24], `T½ = ${fmt(Thalf)}`, "m-bold", "end");
  return s + `</svg><p class="dg-note">Each half-life (dashed lines) cuts the activity in half. Drawn to scale.</p>`;
}

function effectiveChart({ widthPx, Trad, Tbio, Teff }) {
  if (!(Trad > 0) || !(Tbio > 0) || !(Teff > 0)) return null;
  const { W, narrow } = sizeOf(widthPx);
  const H = narrow ? 300 : 310;
  const xMax = Math.min(Math.max(Trad, Tbio) * 1.5, Teff * 6);
  const { s: frame, x, y } = chartFrame(W, H, { l: 46, r: 16, t: narrow ? 64 : 44, b: 40 }, xMax, "amount left in the body", "time (same unit as the half-lives)");
  let s = open(W, H, `Effective half-life ${fmt(Teff)}, from radiological ${fmt(Trad)} and biological ${fmt(Tbio)}.`) + frame;
  s += line([x(0), y(0.5)], [W - 16, y(0.5)], `stroke="#94a3b8" stroke-dasharray="4 3"`);
  const series = [[Trad, "#f59e0b", "radiological", "T½rad"], [Tbio, "#2563eb", "biological", "T½bio"], [Teff, "#b42318", "effective", "T½eff"]];
  for (const [T, c, , ] of series) s += curve(x, y, xMax, T, `stroke="${c}" stroke-width="${c === "#b42318" ? 3.5 : 2.2}"`);
  for (const [T, c] of series) if (T <= xMax) s += `<circle cx="${x(T)}" cy="${y(0.5)}" r="5" fill="${c}" stroke="#fff" stroke-width="2"/>`;
  // Legend across the top.
  let lx = 46, ly = 22;
  for (const [T, c, name, sym] of series) {
    const label = `${sym} = ${fmt(T)}`;
    const wLbl = label.length * 7 + 26;
    if (lx + wLbl > W - 10) { lx = 46; ly += 20; }
    s += line([lx, ly - 4], [lx + 16, ly - 4], `stroke="${c}" stroke-width="3"`) + text([lx + 22, ly], label, "m-xs m-bold");
    lx += wLbl + 8;
  }
  return s + `</svg><p class="dg-note">The effective curve drops fastest because the body loses the material two ways at once: decay and biological removal. The dots mark each half-life on the 50% line.</p>`;
}

// ---------------------------------------------------------------------------
// Shielding (HVL / TVL) page: radiation as a bundle of rays passing through a
// see-through shield made of HVL or TVL blocks, with the intensity labelled before
// the shield, at each block boundary, and after the shield.
// blank: no values yet, so draw a single block with no numbers.
function glassShield({ widthPx, I0, I, layers, f, layerName, totalLabel, layerLabel, blank }) {
  if (!blank && (!(I0 > 0) || !(I >= 0))) return null;
  const { W, narrow } = sizeOf(widthPx);
  const axisY = narrow ? 168 : 190;
  const P = projector(0, axisY);
  const xS = narrow ? 26 : 46, x1 = W * 0.31, x2 = W * 0.69, xEnd = W - (narrow ? 8 : 16);
  const sH = narrow ? 50 : 62, sZ = narrow ? 40 : 50, Rb = narrow ? 20 : 28;
  const numY = narrow ? 32 : 40, capY = numY + (narrow ? 15 : 17); // value row, then its caption
  const bottom = axisY + sH + KY * sZ; // screen y of the shield's front bottom edge

  const n = blank ? null : layers;
  const drawLayers = n > 0 && n <= 12;
  const whole = drawLayers && Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : 0;
  const named = whole >= 1 && whole <= (narrow ? 3 : 5); // few enough blocks to name and label each one
  const perLayer = named && whole > 1;
  const bounds = [x1];
  if (drawLayers) for (let k = 1; k < n - 1e-6; k++) bounds.push(x1 + (x2 - x1) * k / n);
  bounds.push(x2);

  // Rays: a tight bundle of parallel lines through the middle of the shield.
  const N = narrow ? 8 : 10;
  const rays = [];
  for (let i = 0; i < N; i++) rays.push((i / (N - 1) * 2 - 1) * Rb);
  // Lines drop out from the top down: the top lines stop in the first block,
  // the next ones in the second, and the bottom lines go furthest.
  // rays[0] is the bottom line (y increases upward).
  const keep = rays.map((_, i) => i);
  // How strong the beam looks at a fraction r of I₀, for illustration only:
  // 1 at I₀, falling on a log scale to 0 at I₀/1000.
  const vis = r => (r > 0 ? Math.max(0, 1 + Math.log10(Math.min(1, r)) / 3) : 0);
  // The share of lines left matches the share of intensity left (I / I₀),
  // with one line kept while anything gets through. Lines also get thinner and dimmer.
  const count = r => (r > 0 ? Math.max(1, Math.min(N, Math.round(N * r))) : 0);
  const ratio = blank ? 0.1 : I / I0;
  const segR = k => (blank || !drawLayers ? 1 : f ** k); // intensity entering stretch k, as a fraction of I₀
  const bundle = (xa, xb, r, fromSource = false) => {
    const v = vis(r), h = Rb + 3, h0 = fromSource ? Rb * 0.3 : h;
    // A soft glow behind the incoming beam only.
    let t = fromSource ? poly([P(xa, h0, 0), P(xb, h, 0), P(xb, -h, 0), P(xa, -h0, 0)],
      `fill="url(#m-ray)" fill-opacity="0.2" filter="url(#m-glow)"`) : "";
    for (const i of keep.slice(0, count(r))) {
      const y = rays[i], a = P(xa, fromSource ? y * 0.3 : y, 0), b = P(xb, y, 0);
      t += line(a, b, `stroke="#fdba74" stroke-width="${(2.5 + 2 * v).toFixed(1)}" stroke-opacity="${(0.12 + 0.25 * v).toFixed(2)}" stroke-linecap="round"`)
        + line(a, b, `stroke="#f97316" stroke-width="${(0.7 + 1.1 * v).toFixed(2)}" stroke-opacity="${(0.35 + 0.6 * v).toFixed(2)}" stroke-linecap="round"`);
    }
    return t;
  };

  const box = (xa, xb) => ({
    front: [P(xa, -sH, -sZ), P(xb, -sH, -sZ), P(xb, sH, -sZ), P(xa, sH, -sZ)],
    back: [P(xa, -sH, sZ), P(xb, -sH, sZ), P(xb, sH, sZ), P(xa, sH, sZ)],
    top: [P(xa, sH, -sZ), P(xb, sH, -sZ), P(xb, sH, sZ), P(xa, sH, sZ)],
    bottom: [P(xa, -sH, -sZ), P(xb, -sH, -sZ), P(xb, -sH, sZ), P(xa, -sH, sZ)],
  });
  const plane = x => [P(x, -sH, -sZ), P(x, -sH, sZ), P(x, sH, sZ), P(x, sH, -sZ)];
  const all = box(x1, x2);
  const EDGE = `stroke="#64748b" stroke-width="1" stroke-linejoin="round"`;

  let s = open(W, H(), blank
    ? "3D view of radiation passing through a shield."
    : `3D view of radiation passing through a shield: ${fmt(I0)} going in, ${fmt(I)} coming out.`);
  // Soft shadow under the shield.
  s += poly([P(x1 - 6, -sH, -sZ - 4), P(x2 + 14, -sH, -sZ - 4), P(x2 + 14, -sH, sZ + 24), P(x1 - 6, -sH, sZ + 24)],
    `fill="#0f172a" fill-opacity="0.12" filter="url(#m-soft)"`);
  // Far faces of the glass first, so everything else shows through.
  s += poly(all.back, `fill="#cbd5e1" fill-opacity="0.35" stroke="#94a3b8" stroke-width="0.8"`);
  s += poly(all.bottom, `fill="#cbd5e1" fill-opacity="0.3" stroke="#94a3b8" stroke-width="0.8"`);
  s += poly(plane(x1), `fill="#e2e8f0" fill-opacity="0.35" stroke="#94a3b8" stroke-width="0.8"`);

  // Incident beam: the full bundle leaving the source.
  s += bundle(xS + 6, x1, 1, true);
  // Inside the shield: one stretch per layer, with fewer lines in each.
  for (let k = 0; k < bounds.length - 1; k++) {
    s += bundle(bounds[k], bounds[k + 1], segR(k));
    if (k > 0) s += poly(plane(bounds[k]), `fill="#f1f5f9" fill-opacity="0.15" stroke="#94a3b8" stroke-width="0.9"`);
  }
  // Near faces of the glass.
  s += poly(all.front, `fill="url(#m-steel)" fill-opacity="0.2" ${EDGE}`);
  s += poly(all.top, `fill="#e2e8f0" fill-opacity="0.7" ${EDGE}`);
  s += poly(plane(x2), `fill="#94a3b8" fill-opacity="0.45" ${EDGE}`);
  for (const xk of bounds.slice(1, -1)) {
    s += line(P(xk, -sH, -sZ), P(xk, sH, -sZ), `stroke="#64748b" stroke-width="1"`);
    s += line(P(xk, sH, -sZ), P(xk, sH, sZ), `stroke="#64748b" stroke-width="1"`);
  }
  // Transmitted rays.
  s += bundle(x2, xEnd, ratio);
  // Note under the lines that get through: no shield stops all of it.
  if (ratio > 0 && ratio < 1) {
    const nx = W - (narrow ? 6 : 14), ny = P(0, -Rb, 0)[1] + (narrow ? 16 : 18);
    const cls = narrow ? "m-amber m-xs-n m-xs" : "m-amber m-xs-n";
    s += text([nx, ny], "Never fully attenuated", cls, "end");
  }
  // Source: an orange dot with soft rings.
  const src = P(xS, 0, 0), sr = narrow ? 10 : 13;
  s += `<circle cx="${src[0].toFixed(1)}" cy="${src[1].toFixed(1)}" r="${sr + 15}" fill="#fdba74" fill-opacity="0.25"/>`
    + `<circle cx="${src[0].toFixed(1)}" cy="${src[1].toFixed(1)}" r="${sr + 7}" fill="#fb923c" fill-opacity="0.35"/>`
    + `<circle cx="${src[0].toFixed(1)}" cy="${src[1].toFixed(1)}" r="${sr}" fill="#f97316"/>`
    + `<circle cx="${src[0].toFixed(1)}" cy="${src[1].toFixed(1)}" r="${(sr * 0.3).toFixed(1)}" fill="#ffffff"/>`;
  s += text([Math.max(src[0], 24), src[1] + sr + 32], "Source", "m-navy m-bold", "middle");

  // Block names near the top of the front face: HVL 1, HVL 2, ...
  if (named) {
    for (let k = 0; k < whole; k++) {
      const p = P((bounds[k] + bounds[k + 1]) / 2, sH, -sZ);
      s += text([p[0], p[1] + (narrow ? 13 : 16)], whole === 1 ? layerName : `${layerName} ${k + 1}`, "m-navy m-blk", "middle");
    }
  }

  // Labels above: value, small caption under it, and a leader down to the beam or shield.
  const label = (x, cap, value, toY, cls) => {
    let t = "";
    if (value !== null) t += text([x, numY], value, cls, "middle");
    if (cap) t += text([x, capY], cap, "m-muted", "middle");
    const fromY = (cap ? capY : numY) + 8;
    t += line([x, fromY], [x, toY], `stroke="#1e3a5f" stroke-width="1"`);
    t += `<circle cx="${x.toFixed(1)}" cy="${fromY.toFixed(1)}" r="2" fill="#1e3a5f"/><circle cx="${x.toFixed(1)}" cy="${toY.toFixed(1)}" r="2.5" fill="#1e3a5f"/>`;
    return t;
  };
  const numCls = perLayer ? "m-num m-num-sm" : "m-num";
  const inX = P((xS + x1) / 2 + 8, 0, 0)[0];
  s += label(inX, "Incident", blank ? null : fmt(I0), P(0, Rb, 0)[1] - 4, "m-num");
  for (let k = 1; perLayer && k < whole; k++) {
    const p = P(bounds[k], sH, 0);
    s += label(p[0], null, fmt(I0 * f ** k), p[1], numCls);
  }
  const out = P(x2, sH, 0);
  s += label(Math.min(out[0], W - (narrow ? 34 : 44)), "Transmitted", blank ? null : fmt(I), out[1], numCls);

  // Dimensions below the shield's front edge: |— 1 HVL —| for each block, then the total.
  const tick = (x, y) => line([x, y - 6], [x, y + 6], `stroke="#1e3a5f" stroke-width="1.2"`);
  const DL = `stroke="#1e3a5f" stroke-width="1.2"`;
  let y = bottom + 18;
  if (!blank) {
    if (perLayer) {
      for (let k = 0; k < whole; k++) {
        const a = P(bounds[k], 0, -sZ)[0] + 4, b = P(bounds[k + 1], 0, -sZ)[0] - 4, m = (a + b) / 2;
        const lbl = `1 ${layerName}`, half = lbl.length * (narrow ? 2.9 : 3.3) + 5;
        s += tick(a, y) + tick(b, y) + text([m, y + 4], lbl, "m-navy m-xs-n", "middle");
        if (b - a > 2 * half + 6) s += line([a, y], [m - half, y], DL) + line([m + half, y], [b, y], DL);
      }
      y += 28;
    }
    const a = P(x1, 0, -sZ)[0], b = P(x2, 0, -sZ)[0];
    s += tick(a, y) + tick(b, y) + line([a, y], [b, y], DL) + text([(a + b) / 2, y + 19], totalLabel, "m-navy m-bold", "middle");
    if (layerLabel) s += text([(a + b) / 2, y + 36], layerLabel, "m-blue m-bold", "middle");
  }
  return s + `</svg><p class="dg-note">Each ${layerName} cuts the intensity ${f === 0.5 ? "in half" : "to one tenth"}. Conceptual illustration, not to scale.</p>`;

  function H() {
    let h = bottom + 18;
    if (!blank) { h += perLayer ? 28 : 0; h += layerLabel ? 46 : 28; } else h = Math.max(h, axisY + (narrow ? 42 : 50) + 6);
    return Math.round(h + 10);
  }
}

const plural = (n, name) => `${fmt(n)} ${name}${n === 1 ? "" : "s"}`;
// Diagrams for the Shielding (HVL / TVL) page, keyed by option.
export const SHIELDING_DIAGRAMS = {
  "half-value-layer": (v, w) => glassShield({ widthPx: w, I0: v.I0, I: v.I, layers: v.x / v.HVL, f: 0.5, layerName: "HVL",
    totalLabel: `Total thickness x = ${fmt(v.x)} (${plural(v.x / v.HVL, "HVL")})`, layerLabel: `1 HVL = ${fmt(v.HVL)}` }),
  "tenth-value-layer": (v, w) => glassShield({ widthPx: w, I0: v.I1, I: v.I2, layers: v.X / v.TVL, f: 0.1, layerName: "TVL",
    totalLabel: `Total thickness X = ${fmt(v.X)} (${plural(v.X / v.TVL, "TVL")})`, layerLabel: `1 TVL = ${fmt(v.TVL)}` }),
  "number-of-hvls": (v, w) => glassShield({ widthPx: w, I0: v.I0, I: v.I, layers: v.A, f: 0.5, layerName: "HVL",
    totalLabel: `Total thickness = ${plural(v.A, "HVL")}` }),
  "number-of-tvls": (v, w) => glassShield({ widthPx: w, I0: v.I0, I: v.I, layers: v.B, f: 0.1, layerName: "TVL",
    totalLabel: `Total thickness = ${plural(v.B, "TVL")}` }),
  "shield-thickness-hvl": (v, w) => glassShield({ widthPx: w, I0: v.I1, I: v.I2, layers: v.x / v.HVL, f: 0.5, layerName: "HVL",
    totalLabel: `Thickness needed x = ${fmt(v.x)} (${plural(v.x / v.HVL, "HVL")})`, layerLabel: `1 HVL = ${fmt(v.HVL)}` }),
};
// The same scene with no values, shown before anything is solved. f: 0.5 (HVL) or 0.1 (TVL).
export const blankShield = (widthPx, f) => glassShield({ widthPx, f, layerName: f === 0.5 ? "HVL" : "TVL", blank: true });

// ---------------------------------------------------------------------------
export const DIAGRAMS = {
  "laser-nhz-direct-beam": (v, w) => divergingBeam({ widthPx: w, a: v.a, phi: v.phi, r: v.rNHZ, rName: "r_NHZ", dName: "D", limit: "EL", zone: "Inside NHZ", edge: "NHZ boundary" }),
  "ds-tl": (v, w) => divergingBeam({ widthPx: w, a: v.a, phi: v.phi, r: v.Ds, rName: "Ds", dName: "D", limit: "TL", zone: "Within Ds", edge: "Ds" }),
  "laser-beam-diameter": (v, w) => divergingBeam({ widthPx: w, a: v.a, phi: v.phi, r: v.r, rName: "r", dName: "D_L", limit: null }),
  "laser-nhz-lens": (v, w) => lensBeam({ widthPx: w, f0: v.f0, b0: v.b0, r: v.rNHZ }),
  "laser-nhz-diffuse": (v, w) => diffuse({ widthPx: w, rho: v.rho, PHI: v.PHI, theta: v.theta, EL: v.EL, r: v.rNHZ }),
  "optical-density": (v, w) => eyewear({ widthPx: w, I0: v.I0, I: v.I, OD: v.OD, unit: v.unit }),

  // Ionizing radiation and RF
  "half-value-layer": (v, w) => shield({ widthPx: w, I0: v.I0, I: v.I, layers: v.x / v.HVL, f: 0.5, layerName: "HVL", xLabel: `x = ${fmt(v.x)}`, layerLabel: `1 HVL = ${fmt(v.HVL)}` }),
  "number-of-hvls": (v, w) => shield({ widthPx: w, I0: v.I0, I: v.I, layers: v.A, f: 0.5, layerName: "HVL", xLabel: `${fmt(v.A)} HVLs` }),
  "tenth-value-layer": (v, w) => shield({ widthPx: w, I0: v.I1, I: v.I2, layers: v.X / v.TVL, f: 0.1, layerName: "TVL", xLabel: `X = ${fmt(v.X)}`, layerLabel: `1 TVL = ${fmt(v.TVL)}` }),
  "number-of-tvls": (v, w) => shield({ widthPx: w, I0: v.I0, I: v.I, layers: v.B, f: 0.1, layerName: "TVL", xLabel: `${fmt(v.B)} TVLs` }),
  "shield-thickness-hvl": (v, w) => shield({ widthPx: w, I0: v.I1, I: v.I2, layers: v.x / v.HVL, f: 0.5, layerName: "HVL", xLabel: `x = ${fmt(v.x)} needed`, layerLabel: `1 HVL = ${fmt(v.HVL)}` }),
  "buildup-factor": (v, w) => shield({ widthPx: w, I0: v.I0, I: v.I, layers: null, f: null, layerName: "", xLabel: `x = ${fmt(v.x)} cm, μ = ${fmt(v.u)} /cm, B = ${fmt(v.B)}`, buildup: true }),
  "inverse-square-law": (v, w) => inverseSquare({ widthPx: w, I1: v.I1, d1: v.d1, I2: v.I2, d2: v.d2 }),
  "gamma-dose-rate": (v, w) => gammaDose({ widthPx: w, Gamma: v.Gamma, A: v.A, d: v.d, D: v.D }),
  "rf-distance-to-el": (v, w) => rfDistance({ widthPx: w, P: v.P, G: v.G, EL: v.EL, r: v.r }),
  "radioactive-decay": (v, w) => decayChart({ widthPx: w, A0: v.A0, A: v.A, t: v.t, Thalf: v.Thalf }),
  "effective-half-life": (v, w) => effectiveChart({ widthPx: w, Trad: v.Trad, Tbio: v.Tbio, Teff: v.Teff }),
};
