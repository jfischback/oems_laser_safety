// The risk register page. Reads the rows kept in this browser (register-store.js) and shows them; nothing is sent anywhere.
import { COLUMNS, RISK_COLUMNS, RISK_COLOURS, FOLLOW_UP, REPORT_SLOTS, loadRegister, registerXlsx, setFollowUp, removeRow, loadFromXlsx, setReportFile, getReportFile } from "./store.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let rows = [];
const box = document.getElementById("regTable");
function load() {
  rows = loadRegister().map((row, i) => ({ ...row, _i: i })); // _i: the row's place in the stored register
  document.getElementById("regCount").textContent = rows.length === 1 ? "1 laser" : `${rows.length} lasers`;
}
load();

// Sorting: click a column heading. Rating columns sort by severity (Very High first), the others A to Z.
// Display only: the stored register and the Excel download keep the order the rows were added in.
const RANK = Object.fromEntries(Object.keys(RISK_COLOURS).map((k, i) => [k, i + 1]));
let sort = { key: "", dir: 1 };
function sorted() {
  if (!sort.key) return rows;
  const risk = RISK_COLUMNS.includes(sort.key);
  return [...rows].sort((a, b) => {
    const x = a[sort.key] ?? "", y = b[sort.key] ?? "";
    return (risk ? (RANK[y] || 0) - (RANK[x] || 0) : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
  });
}
const EMPTY = '<p class="reg-empty">No lasers in the register yet. Finish an assessment, then choose “Add to register” in its Report section.</p>';
function draw() {
  document.getElementById("regDownload").disabled = rows.length === 0;
  if (rows.length === 0) { box.innerHTML = EMPTY; return; }
  const cell = (key, v, row) => {
    // Follow-up: typed in here by the evaluator and saved in this browser as it is changed.
    if (FOLLOW_UP.includes(key)) {
      const label = COLUMNS.find((c) => c[0] === key)[1] + " for " + (row.laserId || "this laser");
      return key === "action" ? `<td><textarea class="reg-in" rows="2" data-i="${row._i}" data-key="${key}" aria-label="${esc(label)}">${esc(v)}</textarea></td>`
        : `<td><input class="reg-in" type="${key === "dueDate" ? "date" : "text"}" value="${esc(v)}" data-i="${row._i}" data-key="${key}" aria-label="${esc(label)}"></td>`;
    }
    // Original and signed report: a file kept with the row. Upload, open, or replace (asks first).
    if (REPORT_SLOTS.includes(key)) {
      const label = COLUMNS.find((c) => c[0] === key)[1] + " for " + (row.laserId || "this laser");
      const id = `rf-${row._i}-${key}`;
      const pick = `<input type="file" id="${id}" class="reg-file reg-rep-in" accept=".pdf,.docx,.doc" data-i="${row._i}" data-key="${key}" aria-label="${esc((v ? "Replace " : "Upload ") + label)}">`;
      // The original is locked once added (decision 17 Nov 2026); only the signed report can be replaced.
      if (v && key === "reportOriginal") return `<td class="reg-rep"><button type="button" class="reg-rep-open" data-i="${row._i}" data-key="${key}">${esc(v)}</button><span class="reg-rep-lock">Locked</span></td>`;
      return v
        ? `<td class="reg-rep"><button type="button" class="reg-rep-open" data-i="${row._i}" data-key="${key}">${esc(v)}</button><label class="reg-rep-btn" for="${id}">Replace</label>${pick}</td>`
        : `<td class="reg-rep"><label class="reg-rep-btn" for="${id}">Upload report file</label>${pick}</td>`;
    }
    const c = RISK_COLUMNS.includes(key) && RISK_COLOURS[v];
    if (c) return `<td><span class="reg-risk" style="background:#${c[0]};color:#${c[1]}">${esc(v)}</span></td>`;
    // Long text shows three lines; click the cell to read all of it.
    return String(v).length > 90 ? `<td><button type="button" class="reg-clip" title="Show all">${esc(v)}</button></td>` : `<td>${esc(v)}</td>`;
  };
  const head = COLUMNS.map(([key, label]) => {
    const on = sort.key === key;
    return `<th scope="col" ${on ? `aria-sort="${sort.dir === 1 ? "ascending" : "descending"}"` : ""}><button type="button" class="reg-sort" data-key="${key}">${esc(label)}<span aria-hidden="true">${on ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</span></button></th>`;
  }).join("") + '<th scope="col">Remove</th>';
  // Removing a row asks first, in the row itself.
  const remove = (row) => `<td class="reg-rm"><button type="button" class="reg-rm-ask" data-i="${row._i}" aria-label="Remove ${esc(row.laserId || "this row")} from the register">Remove</button></td>`;
  box.innerHTML = `<table class="reg"><thead><tr>${head}</tr></thead><tbody>${
    sorted().map((row) => `<tr>${COLUMNS.map(([key]) => cell(key, row[key] ?? "", row)).join("")}${remove(row)}</tr>`).join("")}</tbody></table>`;
}
draw();
{
  box.addEventListener("click", (e) => {
    const ask = e.target.closest(".reg-rm-ask");
    if (ask) { ask.parentElement.innerHTML = `<span>Remove this row?</span> <button type="button" class="reg-rm-yes" data-i="${ask.dataset.i}">Yes, remove</button> <button type="button" class="reg-rm-no">Keep</button>`; return; }
    if (e.target.closest(".reg-rm-no")) { draw(); return; }
    const yes = e.target.closest(".reg-rm-yes");
    if (yes) { const ok = removeRow(Number(yes.dataset.i)); load(); draw(); document.getElementById("regSaved").textContent = ok ? "Row removed." : "Could not remove the row."; return; }
    const s = e.target.closest(".reg-sort");
    if (s) { sort = { key: s.dataset.key, dir: sort.key === s.dataset.key ? -sort.dir : 1 }; draw(); return; }
    const c = e.target.closest(".reg-clip");
    if (c) c.classList.toggle("open");
    const open = e.target.closest(".reg-rep-open");
    if (open) openReport(Number(open.dataset.i), open.dataset.key);
  });
  box.addEventListener("change", async (e) => {
    const rep = e.target.closest(".reg-rep-in");
    if (rep) {
      const file = rep.files && rep.files[0], msg = document.getElementById("regSaved");
      const i = Number(rep.dataset.i), row = rows.find((r) => r._i === i), name = COLUMNS.find((c) => c[0] === rep.dataset.key)[1].toLowerCase();
      if (!file) return;
      const who = (row && row.laserId) || "this laser";
      if (rep.dataset.key === "reportOriginal" && !confirm(`Add ${file.name} as the original report for ${who}? The original cannot be replaced once added.`)) { rep.value = ""; return; }
      if (rep.dataset.key !== "reportOriginal" && row && row[rep.dataset.key] && !confirm(`Replace the ${name} for ${who}?`)) { rep.value = ""; return; }
      try { await setReportFile(i, rep.dataset.key, file); load(); draw(); msg.textContent = `Saved the ${name}.`; }
      catch (err) { msg.textContent = err.message || "Could not save the file."; }
      return;
    }
    const el = e.target.closest(".reg-in"); if (!el) return;
    const ok = setFollowUp(Number(el.dataset.i), el.dataset.key, el.value);
    const row = rows.find((r) => r._i === Number(el.dataset.i)); if (row && ok) row[el.dataset.key] = el.value.trim();
    document.getElementById("regSaved").textContent = ok ? "Saved." : "Could not save: this browser is not allowing storage.";
  });
}
// Load a downloaded register back in (after clearing the browser, or on another computer).
document.getElementById("regLoad").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const msg = document.getElementById("regSaved");
  try {
    const { added, updated } = await loadFromXlsx(await file.arrayBuffer());
    load(); draw();
    msg.textContent = `Loaded: ${added} added, ${updated} updated.`;
  } catch (err) { msg.textContent = err.message || "The file could not be read."; }
  e.target.value = "";
});
document.getElementById("regDownload").addEventListener("click", () => {
  const blob = new Blob([registerXlsx(loadRegister())], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "OEMS laser risk register.xlsx";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// Opens (downloads) a report file kept with a row.
async function openReport(i, key) {
  const msg = document.getElementById("regSaved"), row = rows.find((r) => r._i === i);
  try {
    const f = row && row.rowId ? await getReportFile(row.rowId, key) : null;
    if (!f) { msg.textContent = "That file is not in this browser. It may have been added on another computer or before the browser was cleared."; return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f.data); a.download = f.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (err) { msg.textContent = "Could not open the file."; }
}
