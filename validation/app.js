// The Validation page: runs the cases (cases.js) with the tool's own code and shows the result.
import { run } from "./cases.js";
import { TOOL_VERSION } from "../assessment/version.js";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rows = run(), bad = rows.filter(r => !r.ok);
document.getElementById("valSum").innerHTML = `<strong>${rows.length - bad.length} of ${rows.length}</strong> published values reproduced. ${bad.length ? `The other ${bad.length} are OSHA table values that do not follow from OSHA's own inputs; each is explained in its row.` : ""}`;
let html = "", group = "";
for (const r of rows) {
  if (r.group !== group) { group = r.group; html += `<tr class="val-g"><th colspan="6">${esc(group)}</th></tr>`; }
  html += `<tr class="${r.ok ? "" : "val-diff"}"><td>${esc(r.what)}</td><td>${esc(r.inputs)}</td><td>${esc(r.source)}</td><td>${esc(r.ref)}</td><td>${esc(r.got)}</td><td>${r.ok ? "Agrees" : `<strong>Differs.</strong> ${esc(r.note)}`}</td></tr>`;
}
document.getElementById("valTable").innerHTML = `<table class="val"><thead><tr><th>Case</th><th>Inputs</th><th>Source</th><th>Published</th><th>Tool</th><th>Result</th></tr></thead><tbody>${html}</tbody></table>`;
document.getElementById("valVer").textContent = TOOL_VERSION;
document.getElementById("valDate").textContent = new Date().toISOString().slice(0, 10);
document.getElementById("valPrint").addEventListener("click", () => window.print());
