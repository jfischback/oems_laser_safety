import { evaluate, defaultExposure, defaultAperture, toOneOverE, roundOD } from "./calc.js";
import { mpe as tableMPE, multiPulseMPE, skinMPE } from "./mpe.js";
import { QUESTIONS, NONBEAM, LOTO, effectiveClass, calcRequired, beamControlsApply, closedApplies, riskTier } from "./questions.js";
import { DIAGRAMS } from "../diagram.js";
import { addRow } from "../register/store.js";
import { inventoryRow, eyewearRow, sopDraft, tsv } from "./paperwork.js";

const $ = id => document.getElementById(id);
const num = id => {
  const raw = $(id).value.trim().replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
};
const fmt = x => {
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e7) return String(Number(x.toPrecision(4)));
  return x.toExponential(3);
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dist = cm => cm === 0 ? "0 (below the MPE at the aperture)"
  : cm < 100 ? `${fmt(cm)} cm (${fmt(cm / 2.54)} in)` : `${fmt(cm / 100)} m (${fmt(cm / 30.48)} ft)`;

// ---------- Questions ----------
const yn = (id, label, na) => `<select id="${id}" aria-label="${esc(label)}"><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option>${na ? '<option value="na">N/A</option>' : ""}</select>`;
const qRow = x => `<div class="lhe-q" data-q="${x.id}"><span class="lhe-q-text">${esc(x.text)}${x.hint ? `<small class="lhe-hint">${esc(x.hint)}</small>` : ""}</span>${yn(`q_${x.id}`, x.text, x.na)}</div>`;
for (const sec of ["access", "closed", "beam", "program"]) $(`q-${sec}`).innerHTML = QUESTIONS.filter(x => x.sec === sec).map(qRow).join("");
$("q-nonbeam").innerHTML = qRow(LOTO);
$("nonbeam").innerHTML = NONBEAM.map(h => `
  <div class="lhe-nb">
    <span class="lhe-nb-name">${esc(h.name)}</span>
    <select id="nb_${h.id}" aria-label="Present: ${esc(h.name)}"><option value="">Present?</option><option value="yes">Present</option><option value="no">Not present</option></select>
    <select id="nbc_${h.id}" aria-label="Controlled: ${esc(h.name)}" hidden><option value="">Controlled?</option><option value="yes">Controlled</option><option value="no">Not controlled</option></select>
    <input id="nbn_${h.id}" type="text" placeholder="Notes (controls: ${esc(h.control)})" aria-label="Notes for ${esc(h.name)}">
  </div>`).join("");

const ALL_Q = [...QUESTIONS, LOTO];
function answers() {
  const a = {
    cls: $("cls").value, clsIn: $("clsIn").value, nm: $("nm").value.trim(),
    mfr: $("mfr").value.trim(), model: $("model").value.trim(), eyeOD: $("eyeOD").value.trim(),
  };
  for (const x of ALL_Q) a[x.id] = $(`q_${x.id}`).value;
  for (const h of NONBEAM) { a[`nb_${h.id}`] = $(`nb_${h.id}`).value; a[`nbc_${h.id}`] = $(`nbc_${h.id}`).value; }
  return a;
}

// ---------- Beam calculations (unchanged math from the Laser Hazard Evaluation) ----------
let multi = null;
const touched = { T: false, Df: false, mpe: false };
for (const id of ["T", "Df", "mpe"]) $(id).addEventListener("input", () => { touched[id] = $(id).value.trim() !== ""; });

function fillDefaults() {
  const nm = num("nm");
  const tDef = defaultExposure(nm, $("viewing").value);
  if (!touched.T) $("T").value = tDef !== null ? String(tDef) : "";
  $("tNote").textContent = tDef !== null ? `default ${tDef} s for ${$("viewing").value} viewing at this wavelength (ANSI Table 3)` : "";
  const T = num("T");
  const mode = $("mode").value;
  multi = mode === "rep" && nm > 0 ? multiPulseMPE(nm, num("tp"), num("prf"), T) : null;
  const apT = multi && multi.H > 0 ? (multi.governing === "Rule 1" ? multi.rule1.t : multi.rule2.t) : T;
  const dDef = defaultAperture(nm, apT);
  if (!touched.Df) $("Df").value = dDef !== null ? String(dDef) : "";
  $("dfNote").textContent = dDef !== null ? `default ${dDef} mm (ANSI Table 10a)`
    : nm >= 180 && T > 0 ? "no default for this wavelength and time; enter it from ANSI Table 10a" : "";

  const t = mode === "cw" ? T : num("tp");
  const m = mode === "rep" ? multi : nm > 0 && t > 0 ? tableMPE(nm, t) : null;
  let value = null, note = "";
  if (mode === "rep" && m && m.H > 0) {
    value = m.H;
    note = `per pulse, the lower of Rule 1 (single pulse) ${fmt(m.rule1.H)} J/cm² and Rule 2 (${fmt(m.rule2.k)} pulses within ${fmt(m.rule2.t)} s) ${fmt(m.rule2.H)} J/cm² per pulse; ${m.governing} governs. Rule 3 does not apply to a point source (Table 8c: C_P = 1.0 for α ≤ 5 mrad). ANSI Z136.1-2022 Section 8.2.3.`;
    if (nm >= 280 && nm < 400) note += " If exposures near this MPE are expected on following days, the standard reduces the MPE by a factor of 2.5 (Section 8.2.3.1).";
  } else if (m && m.H > 0) {
    value = mode === "cw" ? m.E : m.H; note = `from ANSI Z136.1-2022 ${m.row}${mode === "cw" ? ` = ${fmt(m.H)} J/cm² over ${fmt(t)} s` : ""}`;
  } else if (m && m.needs) note = `Automatic MPE for this wavelength and time needs ${m.needs}, not added yet. Enter the MPE from your copy of ANSI Z136.1.`;
  else if (m && m.outOfRange) note = m.outOfRange;
  else if (mode !== "cw" && nm > 0) note = mode === "rep" ? "Enter the pulse duration and repetition frequency to work out the MPE." : "Enter the pulse duration to look up the MPE.";
  if (!touched.mpe) $("mpe").value = value !== null ? String(Number(value.toPrecision(4))) : "";
  $("mpeNote").textContent = touched.mpe ? "your value (clear the box to use the table value)" : note;
}

// Returns everything the screen and the report need about the beam calculations.
function calculate() {
  const mode = $("mode").value, pulsed = mode !== "cw";
  fillDefaults();
  const basis = $("basis").value, dia = num("dia"), div = num("div");
  const input = {
    nm: num("nm"), q: pulsed ? num("energy") : num("power"), mpe: num("mpe"),
    a: dia > 0 ? toOneOverE(dia / 10, basis) : 0,
    phi: div > 0 ? toOneOverE(div / 1000, basis) : null,
    Df: num("Df") > 0 ? num("Df") / 10 : null,
    f0: num("f0"), b0: num("b0") > 0 ? num("b0") / 10 : null,
    fiber: $("fiber").value, NA: num("NA"), w0: num("w0") > 0 ? num("w0") * 1e-4 : null,
    rho: num("rho"), theta: num("theta") || 0,
  };
  const bad = ["nm", "power", "energy", "tp", "prf", "dia", "div", "T", "Df", "mpe", "f0", "b0", "NA", "w0", "rho", "theta", "eyeOD"].filter(id => Number.isNaN(num(id)));
  if (bad.length) return { msg: `Check the number in: ${bad.map(id => $(id).closest("label").querySelector(".name").firstChild.textContent.trim()).join(", ")}.` };
  const need = [];
  if (!(input.nm > 0)) need.push("the wavelength");
  if (!(input.q > 0)) need.push(pulsed ? "the energy per pulse" : "the output power");
  if (!(input.mpe > 0)) need.push("the MPE");
  if (need.length) return { msg: `Enter ${need.join(", ")} to see results.` };
  if (input.rho > 1) return { msg: "Reflectance is a fraction from 0 to 1." };

  const r = evaluate(input);
  if (mode === "rep" && multi && multi.H > 0 && !touched.mpe && !touched.Df) {
    for (const rule of [multi.rule1, multi.rule2]) {
      const ap = defaultAperture(input.nm, rule.t);
      if (!(ap > 0)) continue;
      const d = Math.max(ap / 10, input.a);
      const e = input.q / (Math.PI * (d / 2) ** 2), odx = Math.log10(e / rule.H);
      if (r.odExact === undefined || odx > r.odExact) Object.assign(r, { exposure: e, exposureDiameter: d, odExact: odx, od: roundOD(odx), mpeUsed: rule.H });
    }
  }
  const mpeShown = r.mpeUsed || input.mpe;
  const unitE = pulsed ? "J/cm²" : "W/cm²";
  let eyewear, eyewearSub;
  if (r.od !== undefined) {
    eyewear = r.od > 0 ? `OD ${r.od} or higher at ${fmt(input.nm)} nm` : "No OD needed for the beam at the eye";
    eyewearSub = r.od > 0
      ? `Exposure at the eye ${fmt(r.exposure)} ${unitE} is ${fmt(r.exposure / mpeShown)}× the MPE (OD ${r.odExact.toFixed(2)} before rounding). The eyewear must be marked for ${fmt(input.nm)} nm.`
      : `Exposure at the eye ${fmt(r.exposure)} ${unitE} is below the MPE.`;
  } else { eyewear = "Enter the limiting aperture"; eyewearSub = "The eyewear OD needs the limiting aperture."; }

  const rows = [];
  if (r.exposure !== undefined) rows.push([`Exposure at the eye (averaged over ${fmt(r.exposureDiameter * 10)} mm)`, `${fmt(r.exposure)} ${unitE}`]);
  if (pulsed && num("tp") > 0) rows.push(["Peak power (Q ÷ pulse duration)", `${fmt(input.q / num("tp"))} W`]);
  if (mode === "rep" && num("prf") > 0) rows.push(["Average power (Q × PRF)", `${fmt(input.q * num("prf"))} W`]);
  if (mode === "rep" && multi && multi.H > 0 && !touched.mpe) rows.push(["MPE per pulse (governing rule)", `${fmt(multi.H)} J/cm² (${multi.governing})`]);
  rows.push(["NOHD, direct beam", r.nohd !== undefined ? dist(r.nohd) : "enter the beam divergence"]);
  if (r.nohdLens !== undefined) rows.push(["NOHD with the lens", dist(r.nohdLens)]);
  if (r.nohdFiber !== undefined) rows.push([`NOHD from the ${input.fiber === "multimode" ? "multimode" : "single-mode"} fiber`, dist(r.nohdFiber)]);
  if (r.nhzDiffuse !== undefined) rows.push(["NHZ, diffuse reflection", dist(r.nhzDiffuse)]);
  if (r.nhzSpecular !== undefined) rows.push(["NHZ, specular (mirror-like) reflection", dist(r.nhzSpecular)]);

  // Skin (Tables 9a and 9c): exposure at the laser output, averaged over the skin aperture,
  // against the skin MPE for T (CW) or the pulse duration (single pulse), and the distance
  // along the beam where it falls below. Repetitive pulses need Section 8.4.1, not added yet.
  let skin = null;
  if (mode === "rep") skin = { note: "Skin MPE for repetitive pulses needs the multiple-pulse rules of ANSI Section 8.4.1, not added yet." };
  else {
    const ts = mode === "cw" ? num("T") : num("tp");
    const s = input.nm > 0 && ts > 0 ? skinMPE(input.nm, ts) : null;
    if (s && s.H > 0) {
      const lim = mode === "cw" ? s.E : s.H, d = Math.max(s.aperture / 10, input.a);
      const e = input.q / (Math.PI * (d / 2) ** 2);
      const inside = (4 * input.q) / (Math.PI * lim) - input.a * input.a;
      skin = { mpe: lim, row: s.row, aperture: s.aperture, exposure: e, ratio: e / lim,
        dist: input.phi ? (inside > 0 ? Math.sqrt(inside) / input.phi : 0) : undefined };
      rows.push([`Skin MPE (${s.aperture} mm aperture)`, `${fmt(lim)} ${unitE}<br><small>${s.row}</small>`]);
      rows.push(["Skin exposure at the laser output", `${fmt(e)} ${unitE} (${e > lim ? `${fmt(e / lim)}× the skin MPE` : "below the skin MPE"})`]);
      if (skin.dist !== undefined) rows.push(["Skin hazard distance along the beam", dist(skin.dist)]);
    } else if (s && s.needs) skin = { note: `Skin MPE at this wavelength needs ${s.needs}, not added yet.` };
  }
  if (skin && skin.note) rows.push(["Skin MPE", skin.note]);

  const diagrams = w => {
    const parts = [];
    if (r.nohd > 0) parts.push(DIAGRAMS["laser-nhz-direct-beam"]({ a: input.a, phi: input.phi, rNHZ: r.nohd }, w));
    if (r.nohdLens > 0) parts.push(DIAGRAMS["laser-nhz-lens"]({ f0: input.f0, b0: input.b0, rNHZ: r.nohdLens }, w));
    if (!pulsed && r.nhzDiffuse > 0) parts.push(DIAGRAMS["laser-nhz-diffuse"]({ rho: input.rho, PHI: input.q, theta: input.theta, EL: input.mpe, rNHZ: r.nhzDiffuse }, w));
    if (r.od > 0) parts.push(DIAGRAMS["optical-density"]({ I0: r.exposure, I: mpeShown, OD: r.odExact, unit: unitE }, w));
    return parts.filter(Boolean);
  };
  return { ok: true, r, input, rows, skin, eyewear, eyewearSub, diagrams, requiredOD: r.od > 0 ? r.od : 0, mpeNote: $("mpeNote").textContent };
}

// ---------- Screen ----------
let last = null;
function update() {
  const mode = $("mode").value;
  document.querySelectorAll(".cw-only").forEach(el => (el.hidden = mode !== "cw"));
  document.querySelectorAll(".pulse-only").forEach(el => (el.hidden = mode === "cw"));
  document.querySelectorAll(".rep-only").forEach(el => (el.hidden = mode !== "rep"));
  document.querySelectorAll(".mm-only").forEach(el => (el.hidden = $("fiber").value !== "multimode"));
  document.querySelectorAll(".sm-only").forEach(el => (el.hidden = $("fiber").value !== "singlemode"));
  $("mpeUnit").textContent = mode !== "cw" ? "J/cm² per pulse" : "W/cm²";
  document.querySelectorAll(".low-only").forEach(el => (el.hidden = !["1", "1M", "2", "2M"].includes($("cls").value)));

  // Gates: show only the questions that apply.
  let a = answers();
  for (const x of ALL_Q) document.querySelector(`[data-q="${x.id}"]`).hidden = !x.show(a);
  for (const h of NONBEAM) { const c = $(`nbc_${h.id}`); c.hidden = a[`nb_${h.id}`] !== "yes"; }
  $("closedBlock").hidden = !closedApplies(a);
  const beamQs = QUESTIONS.filter(x => x.sec === "beam" && x.show(a));
  $("beamBlock").hidden = beamQs.length === 0;
  $("beamHow").hidden = !beamControlsApply(a);
  document.querySelectorAll(".eye-only").forEach(el => (el.hidden = !(beamControlsApply(a) && a.eyewear === "yes")));
  $("programBlock").hidden = !QUESTIONS.some(x => x.sec === "program" && x.show(a));
  const e = effectiveClass(a);
  $("clsNote").textContent = e && e !== a.cls ? `This assessment treats it as Class ${e}, the laser inside.` : "";

  const req = calcRequired(a);
  $("calcBadge").textContent = req ? "Required" : "Optional";
  $("calcBadge").className = `badge ${req ? "req" : "opt"}`;
  $("calcHow").textContent = req
    ? `Required: a Class ${e} beam can be reached${a.open === "yes" ? " in normal operation" : " during service or alignment"}. Use the specifications of the laser inside.`
    : "Optional for this laser: no Class 3R, 3B or 4 beam can be reached. The calculations are still here if you want them.";

  const c = calculate();
  last = c;
  if (!c.ok) { $("msg").textContent = c.msg; $("msg").hidden = false; $("results").hidden = true; $("diagrams").innerHTML = ""; }
  else {
    $("msg").hidden = true; $("results").hidden = false;
    $("eyewearOut").textContent = c.eyewear; $("eyewearSub").textContent = c.eyewearSub;
    $("rows").innerHTML = c.rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
    $("diagrams").innerHTML = c.diagrams($("diagrams").clientWidth || 700).map(p => `<div class="diagram">${p}</div>`).join("");
  }

  const calcInfo = c.ok ? { requiredOD: c.requiredOD, nm: fmt(c.input.nm) } : {};
  const t = riskTier(a, calcInfo);
  const reqCalcMissing = req && !(c.ok && c.r.od !== undefined);
  $("tier").className = `tier tier-${t.tier.toLowerCase()}`;
  $("tier").innerHTML = `<span class="tier-k">Risk</span><span class="tier-v">${t.tier}</span><span class="tier-why">${t.reasons.map(esc).join(" ")}${reqCalcMissing ? " The required calculations in section 4 are not complete yet." : ""}</span>`
    + (t.missing ? `<details><summary>What is still missing</summary><ul>${t.missing.map(m => `<li>${esc(m)}</li>`).join("")}</ul></details>` : "");
  $("findings").innerHTML = (t.findings || []).map(f => `<li><strong>${esc(f.text)}</strong><br>${esc(f.rec)}</li>`).join("");
  const out = { a, c, t, req, reqCalcMissing };
  drawPaperwork(out);
  return out;
}

// ---------- Program paperwork (paperwork.js): inventory row, eyewear line, SOP draft ----------
function paperData({ a, c, t, req }) {
  const v = id => $(id).value.trim(), mode = $("mode").value;
  const status = h => a[`nb_${h.id}`] === "yes" ? (a[`nbc_${h.id}`] === "yes" ? "Present, controlled" : a[`nbc_${h.id}`] === "no" ? "Present, NOT controlled" : "Present") : a[`nb_${h.id}`] === "no" ? "Not present" : "Not answered";
  return {
    name: v("name"), loc: v("loc"), mfr: v("mfr"), model: v("model"), cls: a.cls, e: effectiveClass(a), nm: v("nm"),
    output: mode === "cw" ? (v("power") ? `${v("power")} W` : "") : (v("energy") ? `${v("energy")} J per pulse${mode === "rep" && v("prf") ? ` at ${v("prf")} Hz` : ""}` : ""),
    date: v("date"), by: v("by"), a, req, tier: t.tier,
    calcDone: !!(c.ok && c.r.od !== undefined && c.r.nohd !== undefined), need: c.ok ? c.requiredOD : 0,
    eyeModel: v("eyeModel"), eyeOD: a.eyeOD,
    hazardRows: c.ok ? c.rows.filter(([k, val]) => /NOHD|NHZ|hazard distance/.test(k) && !/^enter /.test(val)) : [],
    nonbeam: NONBEAM.map(h => ({ name: h.name, status: status(h), notes: v(`nbn_${h.id}`) })),
    controls: ALL_Q.filter(x => x.show(a) && a[x.id]).map(x => [x.text, { yes: "Yes", no: "No", na: "N/A" }[a[x.id]], x.id]),
  };
}
let paper = null;
function drawPaperwork(state) {
  paper = paperData(state);
  const table = row => row.map(([k, val]) => `<tr><th>${esc(k)}</th><td>${val ? esc(val) : '<span class="pw-blank">blank</span>'}</td></tr>`).join("");
  $("pwInv").innerHTML = table(inventoryRow(paper));
  $("pwEye").innerHTML = table(eyewearRow(paper));
}
async function copyRow(row, msgId, done) {
  try { await navigator.clipboard.writeText(tsv(row)); $(msgId).textContent = done; }
  catch (e) { $(msgId).textContent = "Could not copy: this browser is not allowing the clipboard. Type the values from the table above."; }
}
$("pwInvCopy").addEventListener("click", () => copyRow(inventoryRow(paper), "pwInvMsg", "Row copied. Paste into the first cell of an empty row on the Register tab of Appendix A."));
$("pwEyeCopy").addEventListener("click", () => copyRow(eyewearRow(paper), "pwEyeMsg", "Line copied."));

document.addEventListener("input", e => { if (e.target.closest("#lhe")) update(); });
document.addEventListener("change", e => { if (e.target.closest("#lhe")) update(); });
try { const d = new Date(); $("date").value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); } catch (e) {}

// ---------- Report ----------
const TOOL_VERSION = "1.1 (2026-11-18)";
const CAT = { laser: "The laser", environment: "The environment", personnel: "The people" };
const CTRL = { engineering: "Engineering control", administrative: "Administrative control", ppe: "PPE" };
const val = id => esc($(id).value.trim()) || "—";
const optText = id => { const s = $(id); return s.value ? esc(s.options[s.selectedIndex].text) : "—"; };
const ansText = v => ({ yes: "Yes", no: "No", na: "N/A" }[v] || "Not answered");

// The report reuses the diagrams; give their SVG ids a prefix so they do not clash with the
// (hidden while printing) diagrams on the page, whose gradients would not render.
let rid = 0;
const own = svg => { const k = `r${++rid}-`; return svg.replace(/id="([^"]+)"/g, `id="${k}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${k}$1)`).replace(/href="#([^"]+)"/g, `href="#${k}$1"`); };

function buildReport() {
  const { a, c, t, req, reqCalcMissing } = update();
  const e = effectiveClass(a);
  const f = t.findings || [];
  const top = f.slice(0, 3);
  const qa = ALL_Q.filter(x => x.show(a)).map(x => `<tr><td>${esc(x.text)}</td><td>${ansText(a[x.id])}</td></tr>`).join("");
  const nb = NONBEAM.map(h => `<tr><td>${esc(h.name)}</td><td>${a[`nb_${h.id}`] === "yes" ? (a[`nbc_${h.id}`] === "yes" ? "Present, controlled" : a[`nbc_${h.id}`] === "no" ? "Present, NOT controlled" : "Present") : a[`nb_${h.id}`] === "no" ? "Not present" : "Not answered"}</td><td>${val(`nbn_${h.id}`)}</td></tr>`).join("");
  const byCat = Object.keys(CAT).map(k => {
    const list = f.filter(x => x.cat === k);
    return `<h3>${CAT[k]}</h3>` + (list.length
      ? `<table class="rt find"><thead><tr><th>Finding</th><th>Recommendation</th><th>Section</th><th>Control type</th><th>Owner</th><th>Due date</th></tr></thead><tbody>${list.map(x => `<tr><td>${esc(x.text)}</td><td>${esc(x.rec)}</td><td>${esc(x.ref)}</td><td>${CTRL[x.control]}</td><td></td><td></td></tr>`).join("")}</tbody></table>`
      : "<p>No findings.</p>");
  }).join("");
  const eyeCheck = !c.ok || !(c.requiredOD > 0) ? "No eyewear OD was calculated." :
    `Required: OD ${c.requiredOD} at ${fmt(c.input.nm)} nm. Eyewear in use: ${val("eyeModel")}, marked OD ${val("eyeOD")}. ` +
    (Number(a.eyeOD) >= c.requiredOD ? "Adequate." : Number(a.eyeOD) > 0 ? "NOT adequate." : "Not checked (OD not entered).");
  const w = 640;
  const calcApp = c.ok ? `
    <table class="rt"><tbody>
      <tr><th>Wavelength</th><td>${fmt(c.input.nm)} nm</td></tr>
      <tr><th>Mode</th><td>${optText("mode")}</td></tr>
      <tr><th>${$("mode").value === "cw" ? "Output power" : "Energy per pulse"}</th><td>${fmt(c.input.q)} ${$("mode").value === "cw" ? "W" : "J"}</td></tr>
      ${$("mode").value !== "cw" ? `<tr><th>Pulse duration</th><td>${val("tp")} s</td></tr>` : ""}
      ${$("mode").value === "rep" ? `<tr><th>Pulse repetition frequency</th><td>${val("prf")} Hz</td></tr>` : ""}
      <tr><th>Beam diameter at the aperture</th><td>${val("dia")} mm (${optText("basis")})</td></tr>
      <tr><th>Beam divergence</th><td>${val("div")} mrad</td></tr>
      <tr><th>Viewing</th><td>${optText("viewing")}</td></tr>
      <tr><th>Exposure duration T</th><td>${val("T")} s</td></tr>
      <tr><th>Limiting aperture</th><td>${val("Df")} mm</td></tr>
      <tr><th>MPE</th><td>${val("mpe")} ${$("mpeUnit").textContent}${c.mpeNote ? `<br><small>${esc(c.mpeNote)}</small>` : ""}</td></tr>
      ${num("f0") > 0 ? `<tr><th>Lens focal length / beam at lens</th><td>${val("f0")} cm / ${val("b0")} mm</td></tr>` : ""}
      ${$("fiber").value ? `<tr><th>Fiber</th><td>${optText("fiber")} ${$("fiber").value === "multimode" ? `NA ${val("NA")}` : `ω₀ ${val("w0")} µm`}</td></tr>` : ""}
      ${num("rho") > 0 ? `<tr><th>Reflectance / viewing angle</th><td>${val("rho")} / ${$("theta").value.trim() || "0"}°</td></tr>` : ""}
    </tbody></table>
    <h3>Results</h3>
    <table class="rt"><tbody><tr><th>Laser safety eyewear</th><td>${esc(c.eyewear)}<br><small>${esc(c.eyewearSub)}</small></td></tr>
    ${c.rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>
    ${c.diagrams(w).map(p => `<div class="diagram">${own(p)}</div>`).join("")}` : `<p>${esc(c.msg || "No calculations entered.")}</p>`;

  $("report").innerHTML = `
  <header class="rh"><div><strong>OEMS</strong> · Occupational Exposure Management Systems LLC</div><div>Laser Safety Assessment Report · tool version ${TOOL_VERSION}</div></header>
  <h1>Laser Safety Assessment: ${val("name")}</h1>
  <p class="rnote"><strong>Owner self-assessment.</strong> This report is based on the answers entered by the preparer. It is not a professional evaluation by OEMS.</p>
  <div class="rtier tier-${t.tier.toLowerCase()}"><span>Overall risk</span><strong>${t.tier}</strong><span>${t.reasons.map(esc).join(" ")}${reqCalcMissing ? " The required beam calculations were not completed." : ""}</span></div>

  <h2>1. Summary</h2>
  <p>${val("mfr")} ${val("model")}, ${a.cls ? `Class ${esc(a.cls)}` : "class not entered"}${e && e !== a.cls ? ` (assessed as Class ${esc(e)}, the laser inside)` : ""}, at ${val("loc")}. ${f.length} finding${f.length === 1 ? "" : "s"}.</p>
  ${top.length ? `<p><strong>Top findings:</strong></p><ol>${top.map(x => `<li>${esc(x.text)} ${esc(x.rec)}</li>`).join("")}</ol>` : ""}
  ${t.missing ? `<p><strong>Incomplete:</strong> ${t.missing.length} item(s) were not answered, so no risk tier was given.</p>` : ""}

  <h2>2. Scope and method</h2>
  <p>One laser system, assessed with the OEMS Laser Safety Assessment against ANSI Z136.1-2022 (Safe Use of Lasers). The assessment covers the laser and its enclosure, the environment it is used in, and the people who may be exposed, for normal operation and for service and alignment. Beam calculations ${req ? "were required" : "were optional"} for this laser. Program sections refer to the OEMS Laser Safety Officer Program (OEMS-IH-LSO-001). Once the Laser Safety Officer has reviewed and signed it, this report is the hazard evaluation record under Section 6.3.3 of that program.</p>

  <h2>3. Laser</h2>
  <table class="rt"><tbody>
    <tr><th>Name or ID</th><td>${val("name")}</td></tr><tr><th>Manufacturer / model</th><td>${val("mfr")} / ${val("model")}</td></tr>
    <tr><th>Serial number</th><td>${val("serial")}</td></tr><tr><th>Location</th><td>${val("loc")}</td></tr>
    <tr><th>Class on the label</th><td>${a.cls ? esc(a.cls) : "—"}</td></tr>
    ${["1", "1M", "2", "2M"].includes(a.cls) ? `<tr><th>Laser inside the enclosure</th><td>${optText("clsIn")}</td></tr>` : ""}
    <tr><th>Wavelength</th><td>${val("nm")} nm</td></tr><tr><th>Mode</th><td>${optText("mode")}</td></tr>
  </tbody></table>

  <h2>4. Hazard evaluation results</h2>
  ${c.ok ? `<table class="rt"><tbody><tr><th>Laser safety eyewear</th><td>${esc(c.eyewear)}</td></tr>${c.rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>` : `<p>${esc(c.msg)}</p>`}
  <p><strong>Eyewear check:</strong> ${eyeCheck}</p>
  ${c.ok && c.r.nohd > 0 ? `<div class="diagram">${own(DIAGRAMS["laser-nhz-direct-beam"]({ a: c.input.a, phi: c.input.phi, rNHZ: c.r.nohd }, w))}</div>` : ""}

  <h2>5. Findings and recommendations</h2>
  <p>Grouped as in an ANSI Z136.1 hazard evaluation. Within each group, engineering controls come first, then administrative controls, then PPE. Write in an owner and a due date for each recommendation.</p>
  ${byCat}

  <h2>6. Answers</h2>
  <table class="rt"><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>${qa}</tbody></table>
  <h3>Non-beam hazards</h3>
  <table class="rt"><thead><tr><th>Hazard</th><th>Status</th><th>Notes</th></tr></thead><tbody>${nb}</tbody></table>

  <h2>7. Sign-off</h2>
  <table class="rt sign"><tbody>
    <tr><th>Prepared by</th><td>${val("by")}${$("role").value ? `, ${esc($("role").value)}` : ""}</td><th>Date</th><td>${val("date")}</td></tr>
    <tr><th>Signature</th><td></td><th></th><td></td></tr>
    <tr><th>Reviewed and approved by (Laser Safety Officer)</th><td></td><th>Date</th><td></td></tr>
    <tr><th>Signature</th><td></td><th></th><td></td></tr>
  </tbody></table>

  <h2 class="pb">Appendix A. Calculation record</h2>
  <p>The inputs, MPE and results exactly as calculated by the OEMS Laser Safety Assessment for this report.</p>
  ${calcApp}

  <p class="rfoot">An owner self-assessment based on the preparer's answers, not a professional evaluation by OEMS. The results depend on those answers and are to be reviewed and signed by the Laser Safety Officer before they are relied on. The Laser Safety Officer approves the eyewear for each application. © 2026 Occupational Exposure Management Systems LLC.</p>`;
}

// Printing shows the assessment report, or the SOP draft when its button was used.
let printing = "report";
const buildPrint = () => { if (printing === "sop") { update(); $("report").innerHTML = sopDraft(paper); } else buildReport(); };
$("print").addEventListener("click", () => { printing = "report"; buildPrint(); window.print(); });
$("pwSop").addEventListener("click", () => { printing = "sop"; buildPrint(); window.print(); });
window.addEventListener("beforeprint", buildPrint);
window.addEventListener("afterprint", () => { printing = "report"; });


// ---------- Risk register: add this laser as one row (kept in this browser; register/store.js) ----------
function registerRow() {
  const { a, c, t, req, reqCalcMissing } = update();
  const f = t.findings || [], e = effectiveClass(a), mode = $("mode").value;
  const v = id => $(id).value.trim(), yn = x => ({ yes: "Yes", no: "No" }[x] || "");
  const rated = Number(a.eyeOD), need = c.ok ? c.requiredOD : 0;
  const nohd = c.ok ? (c.rows.find(r => r[0] === "NOHD, direct beam") || [])[1] : "";
  return {
    risk: t.tier, laserId: v("name"), date: v("date"), preparedBy: v("by"), role: $("role").value, location: v("loc"),
    manufacturer: v("mfr"), model: v("model"), serial: v("serial"),
    labelClass: a.cls, assessedClass: e, wavelength: v("nm"), mode: $("mode").options[$("mode").selectedIndex].text,
    output: mode === "cw" ? (v("power") ? `${v("power")} W` : "") : (v("energy") ? `${v("energy")} J per pulse` : ""),
    beamNormal: yn(a.open), beamService: yn(a.service),
    why: t.reasons.join(" "), nFindings: t.missing ? "" : String(f.length),
    topFindings: f.slice(0, 3).map(x => x.text).join("; "),
    nonBeam: f.filter(x => x.id.startsWith("nb_")).map(x => x.text.replace(/^Uncontrolled non-beam hazard: /, "").replace(/\.$/, "")).join("; "),
    calcs: req ? (reqCalcMissing ? "Required, not complete" : "Required, complete") : (c.ok ? "Optional, done" : "Optional, not done"),
    requiredOD: c.ok && c.r.od !== undefined ? (need > 0 ? `OD ${need} at ${fmt(c.input.nm)} nm` : "None needed") : "",
    eyewear: a.eyewear === "yes" ? [v("eyeModel"), a.eyeOD ? `OD ${a.eyeOD}` : ""].filter(Boolean).join(", ") : "",
    eyewearOk: a.eyewear === "yes" && need > 0 ? (rated >= need ? "Yes" : rated > 0 ? "No" : "Not checked") : "",
    nohd: nohd && !/enter the/.test(nohd) ? nohd : "",
    reportOriginal: "", reportSigned: "", addedAt: new Date().toISOString(),
  };
}
$("regAdd").addEventListener("click", () => {
  const how = addRow(registerRow());
  $("regMsg").textContent = how === "added" ? "Added to the register." : how === "updated" ? "Already in the register: its row was updated." : "Could not save: this browser is not allowing storage.";
});

// ---------- Shareable link: answers and numbers only, never names, model, serial, location or notes ----------
const SHARE_IDS = ["cls", "clsIn", "nm", "mode", "power", "energy", "tp", "prf", "dia", "div", "basis", "viewing", "T", "Df", "mpe", "f0", "b0", "fiber", "NA", "w0", "rho", "theta", "eyeOD",
  ...ALL_Q.map(x => `q_${x.id}`), ...NONBEAM.flatMap(h => [`nb_${h.id}`, `nbc_${h.id}`])];
$("share").addEventListener("click", async () => {
  const p = new URLSearchParams();
  for (const id of SHARE_IDS) { const v = $(id).value.trim(); if (v && !(id in touched && !touched[id])) p.set(id, v); }
  const url = `${location.origin}${location.pathname}#${p}`;
  try { await navigator.clipboard.writeText(url); $("shareNote").textContent = "Link copied. It reopens this assessment with your answers and numbers (no names, model, serial, location or notes)."; }
  catch (e) { history.replaceState(null, "", url); $("shareNote").textContent = "Copy the address in your browser's address bar; it now holds this assessment."; }
});
if (location.hash.length > 1) {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const [id, v] of p) if (SHARE_IDS.includes(id) && $(id)) { $(id).value = v; if (id in touched) touched[id] = true; }
}
update();
