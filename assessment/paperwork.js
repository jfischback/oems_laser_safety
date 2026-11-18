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
