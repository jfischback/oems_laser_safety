// Program paperwork from one assessment: the laser's row for the Laser Inventory and Registration Form
// (Appendix A), its line for the eyewear selection log (Appendix H, Part 1), and a draft of the Standard
// Operating Procedure (Appendix C). Everything comes from what was entered in the assessment; a cell the
// assessment does not ask about is left blank for the Laser Safety Officer. No page code here, so
// tests/paperwork-check.mjs can run it in Node.
//
// d: { name, loc, mfr, model, cls, e, nm, output, date, by, a, req, calcDone, need, tier,
//      eyeModel, eyeOD, hazardRows: [[label, html]], nonbeam: [{ name, status, notes }], controls: [[text, answer]] }
import { beamControlsApply, NONBEAM } from "./questions.js";

const hi = d => ["3B", "4"].includes(d.e);
const yn = v => ({ yes: "Yes", no: "No" }[v] || "");
// The sheet's dates are written month/day/year.
const usDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? `${m[2]}/${m[3]}/${m[1]}` : ""; };

// Appendix A, Register tab, columns A to T in order: [heading, value]. Column U (Inventory Status) is the
// sheet's own formula and is not part of the row.
export function inventoryRow(d) {
  const a = d.a;
  // "Enclosed or Embedded" uses the sheet's own list. Only the two cases the assessment settles are filled.
  const enclosed = a.open === "yes" ? "Not fully enclosed" : a.open === "no" && a.cls === "1" ? "Enclosed (Class 1 in normal use)" : "";
  const eyewear = !beamControlsApply(a) ? "N/A" : a.eyewear !== "yes" ? yn(a.eyewear)
    : d.need > 0 ? (Number(d.eyeOD) >= d.need ? "Yes" : "No") : "Yes";
  const nonbeamDone = NONBEAM.every(h => a[`nb_${h.id}`] === "no" || (a[`nb_${h.id}`] === "yes" && a[`nbc_${h.id}`]));
  return [
    ["Laser ID", d.name],
    ["Location", d.loc],
    ["Laser Type", ""],
    ["Manufacturer / Model", [d.mfr, d.model].filter(Boolean).join(" / ")],
    ["Class", d.e],
    ["Wavelength(s) (nm)", d.nm],
    ["Maximum Output (with units)", d.output],
    ["Area / Room", ""],
    ["Responsible Department", ""],
    ["Enclosed or Embedded", enclosed],
    ["Registered with LSO (date)", ""],
    ["Installation Review Approved, Appendix E (date)", ""],
    ["NHZ Calculated, Appendix B", d.calcDone ? "Yes" : d.req ? "No" : "N/A"],
    // The assessment asks whether an SOP exists, not whether the LSO approved it, so "Yes" is left to the LSO.
    ["SOP Approved, Appendix C", !hi(d) ? "N/A" : a.sop === "no" ? "No" : ""],
    ["Eyewear Selected, Appendix H", eyewear],
    ["Non-Beam Evaluation Done, Appendix I", nonbeamDone ? "Yes" : "No"],
    ["Beam Reachable During Service or Alignment (Yes / No)", yn(a.service)],
    ["Laser Safety Assessment Completed (date)", d.tier === "Incomplete" ? "" : usDate(d.date)],
    ["Assessment Risk (High / Medium / Low)", d.tier === "Incomplete" ? "" : d.tier],
    ["Notes (changes, moves, removal)", ""],
  ];
}

// Appendix H, Part 1 (Selection), one line: [heading, value].
export function eyewearRow(d) {
  const used = d.a.eyewear === "yes";
  return [
    ["Laser (Appendix A no.)", d.name],
    ["Wavelength (nm)", d.nm],
    ["OD required (assessment or Appendix B)", d.calcDone ? (d.need > 0 ? `OD ${d.need}` : "None needed") : ""],
    ["Eyewear make / model", used ? d.eyeModel : ""],
    ["Rated OD and wavelength range (label)", used && d.eyeOD ? `OD ${d.eyeOD}` : ""],
    ["Qty / storage location", ""],
    ["LSO approval / date", ""],
  ];
}

// One line of tab-separated values, to paste across a row of the sheet.
export const tsv = row => row.map(([, v]) => String(v ?? "").replace(/[\t\r\n]+/g, " ")).join("\t");

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const steps = n => `<table class="rt steps"><thead><tr><th>Step</th><th>Action</th><th>Control or check</th></tr></thead><tbody>${"<tr><td></td><td></td><td></td></tr>".repeat(n)}</tbody></table>`;
const list = items => items.length ? `<ul>${items.map(x => `<li>${x}</li>`).join("")}</ul>` : "";

// Appendix C with the header, hazards and controls filled in from the assessment. The steps, the emergency
// stop, the names and the approval are left for the laser owner and the LSO. Returns HTML for the print area.
export function sopDraft(d) {
  const a = d.a, used = a.eyewear === "yes";
  const present = d.nonbeam.filter(h => h.status !== "Not present" && h.status !== "Not answered");
  const eyewear = [
    d.calcDone ? (d.need > 0 ? `Required: OD ${d.need} or higher at ${esc(d.nm)} nm.` : "The calculation found no eyewear OD is needed for the beam at the eye.") : "Required OD not calculated in the assessment.",
    used ? `In use: ${esc(d.eyeModel) || "model not entered"}${d.eyeOD ? `, marked OD ${esc(d.eyeOD)}` : ""}.` : "",
    used && d.need > 0 && Number(d.eyeOD) > 0 && Number(d.eyeOD) < d.need ? "<strong>The eyewear in use is below the required OD.</strong>" : "",
  ].filter(Boolean).join(" ");
  const ctl = filter => list(d.controls.filter(filter).map(([text, ans]) => `${esc(text)} <strong>${esc(ans)}</strong>`));
  return `
  <header class="rh"><div><strong>LASER SAFETY OFFICER (LSO) PROGRAM</strong></div><div>Form OEMS-IH-LSO-001-C · Rev. 1.1</div></header>
  <h1>Laser Standard Operating Procedure: ${esc(d.name) || "—"}</h1>
  <p class="rnote"><strong>Draft.</strong> The laser, hazards and controls below were filled in from the OEMS Laser Safety Assessment of ${esc(d.date) || "—"}. Write in the steps, the emergency shutdown and the names. The Laser Safety Officer approves the procedure before it is used (Program Section 6.7.2).</p>
  <table class="rt kv"><tbody>
    <tr><th>Procedure no. / revision</th><td></td></tr>
    <tr><th>Location / area</th><td>${esc(d.loc)}</td></tr>
    <tr><th>Laser (Appendix A no.) / manufacturer / model</th><td>${[d.name, d.mfr, d.model].map(esc).filter(Boolean).join(" / ")}</td></tr>
    <tr><th>Class / wavelength(s) / maximum output</th><td>${[d.e ? `Class ${esc(d.e)}${d.cls && d.cls !== d.e ? ` (label: Class ${esc(d.cls)})` : ""}` : "", d.nm ? `${esc(d.nm)} nm` : "", esc(d.output)].filter(Boolean).join(" / ")}</td></tr>
    <tr><th>Responsible department / People Leader</th><td></td></tr>
    <tr><th>Procedure covers</th><td>☐ Operation &nbsp; ☐ Alignment &nbsp; ☐ Maintenance</td></tr>
  </tbody></table>

  <h2>1. Hazards</h2>
  <table class="rt kv"><tbody>
    <tr><th>Beam hazards (NHZ from the OEMS Laser Safety Assessment or Appendix B)</th><td>
      Beam reachable in normal operation: <strong>${yn(a.open) || "not answered"}</strong>. During service or alignment: <strong>${yn(a.service) || "not answered"}</strong>.
      ${list(d.hazardRows.map(([k, v]) => `${k}: ${v}`))}</td></tr>
    <tr><th>Non-beam hazards (from Appendix I or the assessment)</th><td>${present.length ? list(present.map(h => `${esc(h.name)}: <strong>${esc(h.status)}</strong>${h.notes ? `. ${esc(h.notes)}` : ""}`)) : "None marked present in the assessment."}</td></tr>
  </tbody></table>

  <h2>2. Required controls and PPE</h2>
  <table class="rt kv"><tbody>
    <tr><th>Engineering controls (Section 6.5)</th><td>${ctl(([, , id]) => ENG.includes(id))}</td></tr>
    <tr><th>Laser-Controlled Area and posting (Appendix F, Section 6.11)</th><td>${ctl(([, , id]) => AREA.includes(id))}</td></tr>
    <tr><th>Laser protective eyewear (Appendix H), OD / wavelength</th><td>${eyewear}</td></tr>
    <tr><th>Other PPE (Section 6.10.4)</th><td></td></tr>
    <tr><th>Who may operate (Authorized Operators, Appendix J)</th><td></td></tr>
  </tbody></table>

  <h2>3. Startup</h2>${steps(4)}
  <h2>4. Operation</h2>${steps(4)}
  <h2>5. Alignment (Section 6.8)</h2>
  <p>Use the lowest laser power necessary. Never view the beam directly. Secure entrances, wear required eyewear, watch beam direction and reflections, and remove reflective jewelry and tools from the beam area.</p>${steps(3)}
  <h2>6. Maintenance (Section 6.9)</h2>
  <p>Work that removes a protective housing or defeats an interlock requires a Service and Alignment Authorization (Appendix G) before it starts. Work on the power supply or other electrical parts follows the machine-specific lockout/tagout procedure (Section 6.9.1).</p>${steps(3)}
  <h2>7. Shutdown</h2>${steps(3)}
  <p>Remove the key and secure it with the LSO or designee when the laser is not in use (Section 6.5.1).</p>

  <h2>8. Emergency shutdown</h2>
  <table class="rt kv tall"><tbody>
    <tr><th>How to stop the beam (emergency stop location)</th><td></td></tr>
    <tr><th>Who to notify: LSO / People Leader (names, phone)</th><td></td></tr>
    <tr><th>Suspected exposure: shut down and secure the laser, report immediately, follow Appendix D (Section 6.14)</th><td></td></tr>
  </tbody></table>

  <h2>9. Approval and review</h2>
  <table class="rt kv tall"><tbody>
    <tr><th>Prepared by / date</th><td>${[d.by, d.date].map(esc).filter(Boolean).join(" / ")}</td></tr>
    <tr><th>Approved by LSO / date</th><td></td></tr>
    <tr><th>Review trigger met (laser, controls, or use changed) / date reviewed</th><td></td></tr>
  </tbody></table>
  <p class="rfoot">Drafted from an owner self-assessment, not a professional evaluation by OEMS. The Laser Safety Officer reviews and approves this procedure before it is used. © 2026 Occupational Exposure Management Systems LLC.</p>`;
}
// Which assessment questions are listed under each line of Appendix C, Section 2 (by the program section each falls under).
const ENG = ["intlk", "intlkTest", "windows", "path", "walkway", "stops", "key"];
const AREA = ["area", "signs", "people"];

// ---------- Laser-Controlled Area entrance sign (Program Section 6.11.2) ----------
// Which sign this laser needs. The signal word follows ANSI Z136.1 as shown in the ANSI 2022 sign formats:
//   WARNING: Class 3B and Class 4 laser controlled areas.
//   DANGER:  Class 4 with multi-kilowatt output power or high pulse energy and an exposed beam. The Laser
//            Safety Officer makes that call, so it is a switch (opts.danger), never worked out here.
//   NOTICE:  a temporary controlled area while an enclosed Class 3B or 4 laser is open for service.
// Returns { kind: "none", why } when the program does not call for a posted area.
export function signKind(d, opts = {}) {
  const a = d.a;
  if (!hi(d)) return { kind: "none", why: "No area sign: the program requires a posted Laser-Controlled Area only for Class 3B and Class 4 lasers (Section 6.6.1)." };
  if (a.open === "yes") return { kind: d.e === "4" && opts.danger ? "DANGER" : "WARNING", canDanger: d.e === "4" };
  if (a.service === "yes") return { kind: "NOTICE" };
  if (!a.open || !a.service) return { kind: "none", why: "Answer the two beam access questions in section 2 to see the sign." };
  return { kind: "none", why: "No area sign: the beam cannot be reached in normal operation or during service, so no Laser-Controlled Area is set up." };
}

const HEAD = { DANGER: ["#C8102E", "#fff", 823], WARNING: ["#FF8200", "#000", 927], NOTICE: ["#0055A4", "#fff", 718] };
// The sign as an SVG, 14 by 10 (landscape). Lines the assessment cannot fill are left as blanks to write on.
export function signSvg(d, opts = {}) {
  const k = signKind(d, opts);
  if (k.kind === "none") return "";
  const [fill, ink, wordW] = HEAD[k.kind], alert = k.kind !== "NOTICE";
  const total = wordW + (alert ? 200 : 0), x0 = (1400 - total) / 2, wordX = x0 + (alert ? 200 : 0);
  const tri = alert ? `<g transform="translate(${x0},48)"><path d="M85 6 L166 150 H4 Z" fill="${k.kind === "DANGER" ? "#fff" : "#000"}" stroke="${k.kind === "DANGER" ? "#fff" : "#000"}" stroke-width="10" stroke-linejoin="round"/>
    <path d="M85 30 L148 142 H22 Z" fill="${k.kind === "DANGER" ? "#C8102E" : "#FF8200"}"/><rect x="77" y="62" width="16" height="48" rx="7" fill="${k.kind === "DANGER" ? "#fff" : "#000"}"/><circle cx="85" cy="126" r="9" fill="${k.kind === "DANGER" ? "#fff" : "#000"}"/></g>` : "";
  const rays = Array.from({ length: 16 }, (_, i) => {
    const t = (i * Math.PI) / 8, len = i === 0 ? 118 : i === 8 ? 96 : i % 2 ? 58 : 80;
    return `<line x1="${(22 * Math.cos(t)).toFixed(1)}" y1="${(22 * Math.sin(t)).toFixed(1)}" x2="${(len * Math.cos(t)).toFixed(1)}" y2="${(len * Math.sin(t)).toFixed(1)}"/>`;
  }).join("");
  const od = d.calcDone && d.need > 0 ? `OD ${d.need} @ ${esc(d.nm)} nm` : "OD __________ @ __________ nm";
  const power = d.power && d.power[1] ? `${esc(d.power[0])}: ${esc(d.power[1])}` : "Average power: ______________";
  const area = `Class ${esc(d.e)} Laser Controlled Area`;
  const T = (y, size, text, weight = 700) => `<text x="520" y="${y}" font-size="${size}" font-weight="${weight}">${text}</text>`;
  const body = k.kind === "NOTICE"
    ? T(350, 60, "Laser service in progress") + T(420, 42, `Temporary ${area}`) + T(490, 42, "Authorized personnel only")
    : T(370, 58, area);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1000" role="img" aria-label="${k.kind} sign: ${area}" font-family="Arial, Helvetica, sans-serif">
  <rect x="10" y="10" width="1380" height="980" fill="#fff" stroke="#000" stroke-width="12"/>
  <rect x="16" y="16" width="1368" height="226" fill="${fill}"/><line x1="10" y1="246" x2="1390" y2="246" stroke="#000" stroke-width="10"/>
  ${tri}<text x="${wordX}" y="202" font-size="190" font-weight="700" ${k.kind === "NOTICE" ? 'font-style="italic" ' : ""}fill="${ink}" textLength="${wordW}" lengthAdjust="spacingAndGlyphs">${k.kind}</text>
  <line x1="480" y1="246" x2="480" y2="990" stroke="#000" stroke-width="8"/>
  <path d="M245 360 L455 760 H35 Z" fill="#FFD100" stroke="#000" stroke-width="22" stroke-linejoin="round"/>
  <g transform="translate(245,640)" stroke="#000" stroke-width="9" stroke-linecap="butt">${rays}<circle r="26" fill="#000" stroke="none"/></g>
  <g fill="#000">${body}
  ${T(600, 46, "Laser eye protection required:")}${T(665, 46, od)}
  ${T(770, 46, "Laser type: __________________")}${T(850, 46, power)}
  <text x="520" y="950" font-size="28" textLength="840" lengthAdjust="spacingAndGlyphs">Laser Safety Officer __________________ Phone ____________</text></g></svg>`;
}
