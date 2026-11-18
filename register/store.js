// The laser risk register, built the same way as the chemical tool's register. One row per laser, kept in this browser only (localStorage): nothing is sent
// anywhere and there is no login. The Excel download is the evaluator's own copy and the only backup.
// A row holds results the calculator already produced; nothing is calculated here.

export const REG_KEY = "oems_laser_register_v1";

// The columns, in order. The risk comes first so a row can be read at a glance.
export const COLUMNS = [
  ["risk", "Risk"], ["laserId", "Laser name or ID"],
  // Follow-up, typed in on the register page (not from the assessment).
  ["action", "Action needed"], ["owner", "Owner"], ["dueDate", "Due date"],
  ["date", "Assessment date"], ["preparedBy", "Prepared by"], ["role", "Role"], ["location", "Location"],
  ["manufacturer", "Manufacturer"], ["model", "Model"], ["serial", "Serial number"],
  ["labelClass", "Class on the label"], ["assessedClass", "Assessed as class"], ["wavelength", "Wavelength (nm)"], ["mode", "Mode"], ["output", "Output"],
  ["beamNormal", "Beam reachable in normal operation"], ["beamService", "Beam reachable during service or alignment"],
  ["why", "Why this risk"], ["nFindings", "Findings"], ["topFindings", "Top findings"], ["nonBeam", "Uncontrolled non-beam hazards"],
  ["calcs", "Beam calculations"], ["requiredOD", "Eyewear OD required"], ["eyewear", "Eyewear in use"], ["eyewearOk", "Eyewear adequate"], ["nohd", "NOHD, direct beam"],
  // The report: the PDF as first printed, and the copy signed by the Laser Safety Officer. The files are kept in
  // this browser (IndexedDB); these columns hold the file name and the date it was added.
  ["reportOriginal", "Original report"], ["reportSigned", "Signed report"],
];
export const RISK_COLUMNS = ["risk"];
export const FOLLOW_UP = ["action", "owner", "dueDate"];
export const REPORT_SLOTS = ["reportOriginal", "reportSigned"];
// Kept when the same laser is added again: the follow-up, the report files and the row's file key.
const KEEP = [...FOLLOW_UP, ...REPORT_SLOTS, "rowId"];
// The rating colours, as on the assessment page: [fill, text].
export const RISK_COLOURS = { "Low": ["E2EFDA", "1F3D17"], "Medium": ["FEF3C7", "92400E"], "High": ["FECACA", "991B1B"] };

const one = (v) => String(v ?? "").replace(/\s*\n\s*/g, "; ").trim();

export function loadRegister() {
  try { const v = JSON.parse(localStorage.getItem(REG_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
// Adds the row. A row with the same laser name or ID is replaced, so adding the same assessment twice does not
// make two rows. Returns "added", "updated" or "failed" (storage unavailable).
export function addRow(row) {
  const rows = loadRegister();
  const i = row.laserId === "" ? -1 : rows.findIndex((x) => x.laserId === row.laserId);
  if (i >= 0) { for (const k of KEEP) row[k] = rows[i][k] ?? ""; rows[i] = row; } else rows.push(row); // an updated row keeps its follow-up and reports
  try { localStorage.setItem(REG_KEY, JSON.stringify(rows)); } catch (e) { return "failed"; }
  return i >= 0 ? "updated" : "added";
}

// Saves one follow-up value typed on the register page. "index" is the row's place in the stored register.
export function setFollowUp(index, key, value) {
  if (!FOLLOW_UP.includes(key)) return false;
  const rows = loadRegister();
  if (!rows[index]) return false;
  rows[index][key] = String(value ?? "").trim();
  try { localStorage.setItem(REG_KEY, JSON.stringify(rows)); } catch (e) { return false; }
  return true;
}

// ---------- load a downloaded register back in ----------
// Reads an .xlsx file (the register's own download, also after it has been opened and saved in Excel) and puts its
// rows into the register kept in this browser. Columns are matched by their headings. A row whose Assessment ID is
// already in the register replaces that row; the others are added. Returns { added, updated } or throws.
export async function loadFromXlsx(arrayBuffer) {
  const files = await unzip(new Uint8Array(arrayBuffer));
  const name = Object.keys(files).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
  if (!name) throw new Error("This is not an Excel file the register can read.");
  const dom = (t) => new DOMParser().parseFromString(t, "application/xml");
  const text = (el) => [...el.getElementsByTagName("t")].map((t) => t.textContent).join("");
  const shared = files["xl/sharedStrings.xml"] ? [...dom(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map(text) : [];
  const colOf = (ref) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const grid = [...dom(files[name]).getElementsByTagName("row")].map((row) => {
    const out = [];
    for (const c of row.getElementsByTagName("c")) {
      const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0];
      out[colOf(c.getAttribute("r") || "")] = t === "inlineStr" ? text(c) : t === "s" ? shared[Number(v ? v.textContent : -1)] ?? "" : v ? v.textContent : "";
    }
    return out;
  });
  const byLabel = Object.fromEntries(COLUMNS.map(([key, label]) => [label.toLowerCase(), key]));
  const keys = (grid[0] || []).map((h) => byLabel[String(h ?? "").trim().toLowerCase()]);
  if (!keys.includes("laserId") || !keys.includes("risk")) throw new Error("This file does not have the register's column headings.");
  // A date typed in Excel comes back as Excel's day number: turn it back into a date.
  const DATES = ["dueDate", "date"];
  const fix = (key, v) => (DATES.includes(key) && /^\d+(\.\d+)?$/.test(v) ? new Date(Math.round((Number(v) - 25569) * 86400000)).toISOString().slice(0, 10) : v);
  const rows = loadRegister();
  let added = 0, updated = 0;
  for (const line of grid.slice(1)) {
    const row = { addedAt: new Date().toISOString() };
    keys.forEach((key, c) => { if (key) row[key] = fix(key, String(line[c] ?? "").trim()); });
    if (!COLUMNS.some(([key]) => row[key])) continue; // an empty line
    for (const [key] of COLUMNS) row[key] = row[key] ?? "";
    const i = row.laserId === "" ? -1 : rows.findIndex((x) => x.laserId === row.laserId);
    if (i >= 0) { // keep the report files already kept with this row
      if (rows[i].rowId) { row.rowId = rows[i].rowId; for (const k of REPORT_SLOTS) row[k] = rows[i][k] || row[k]; }
      rows[i] = row; updated++;
    } else { rows.push(row); added++; }
  }
  try { localStorage.setItem(REG_KEY, JSON.stringify(rows)); } catch (e) { throw new Error("Could not save: this browser is not allowing storage."); }
  return { added, updated };
}
// The files inside a zip, as text, by name. Handles stored and deflated entries (what Excel writes).
async function unzip(b) {
  const u16 = (p) => b[p] | (b[p + 1] << 8), u32 = (p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
  let end = -1;
  for (let p = b.length - 22; p >= 0 && p >= b.length - 66000; p--) if (u32(p) === 0x06054b50) { end = p; break; }
  if (end < 0) throw new Error("This is not an Excel file the register can read.");
  const out = {}, dec = new TextDecoder();
  let p = u32(end + 16);
  for (let n = u16(end + 10); n > 0; n--) {
    if (u32(p) !== 0x02014b50) break;
    const method = u16(p + 10), size = u32(p + 20), nameLen = u16(p + 28), extra = u16(p + 30), comment = u16(p + 32), local = u32(p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
    if (!/\.xml$/.test(name) || !/^xl\//.test(name)) continue;
    const start = local + 30 + u16(local + 26) + u16(local + 28), data = b.subarray(start, start + size);
    if (method === 0) out[name] = dec.decode(data);
    else if (method === 8) out[name] = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}

// Removes one row from the register kept in this browser. "index" is the row's place in the stored register.
export function removeRow(index) {
  const rows = loadRegister();
  if (!rows[index]) return false;
  const id = rows[index].rowId;
  rows.splice(index, 1);
  if (id) for (const slot of REPORT_SLOTS) deleteReportFile(id, slot).catch(() => {});
  try { localStorage.setItem(REG_KEY, JSON.stringify(rows)); } catch (e) { return false; }
  return true;
}

// ---------- Excel (.xlsx) ----------
// A small .xlsx writer: one sheet, a header row, text cells, the rating cells coloured. No library needed.
const xml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const colName = (n) => { let s = ""; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

export function registerXlsx(rows) {
  const ratings = Object.keys(RISK_COLOURS);
  // styles: 0 plain, 1 header, 2.. one per rating
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>', '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    ...ratings.map((k) => `<font><b/><sz val="11"/><color rgb="FF${RISK_COLOURS[k][1]}"/><name val="Calibri"/></font>`)];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0F2B55"/></patternFill></fill>',
    ...ratings.map((k) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${RISK_COLOURS[k][0]}"/></patternFill></fill>`)];
  const xfs = ['<xf fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '<xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>',
    ...ratings.map((k, i) => `<xf fontId="${i + 2}" fillId="${i + 3}" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`)];
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const cell = (c, rIdx, v, s) => `<c r="${colName(c)}${rIdx}" t="inlineStr"${s ? ` s="${s}"` : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  const head = `<row r="1" ht="32" customHeight="1">${COLUMNS.map(([, label], c) => cell(c, 1, label, 1)).join("")}</row>`;
  const body = rows.map((row, i) => `<row r="${i + 2}">${COLUMNS.map(([key], c) => {
    const v = row[key] ?? "", s = RISK_COLUMNS.includes(key) && ratings.includes(v) ? ratings.indexOf(v) + 2 : 0;
    return cell(c, i + 2, v, s);
  }).join("")}</row>`).join("");
  const widths = COLUMNS.map(([key], c) => `<col min="${c + 1}" max="${c + 1}" width="${RISK_COLUMNS.includes(key) ? 16 : ["why", "topFindings", "nonBeam", "action"].includes(key) ? 44 : 22}" customWidth="1"/>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${head}${body}</sheetData><autoFilter ref="A1:${colName(COLUMNS.length - 1)}${rows.length + 1}"/></worksheet>`;
  const files = [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Laser risk register" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml", styles],
    ["xl/worksheets/sheet1.xml", sheet],
  ];
  return zip(files);
}

// A stored (uncompressed) zip, which is all an .xlsx needs. Returns a Uint8Array.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const [name, text] of files) {
    const n = enc.encode(name), d = enc.encode(text), crc = crc32(d);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0)]);
    parts.push(local, n, d);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), n);
    offset += local.length + n.length + d.length;
  }
  const cSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const b of all) { out.set(b, p); p += b.length; }
  return out;
}

// ---------- the report files (17 Nov 2026) ----------
// Word files are too large for localStorage, so they go in IndexedDB, keyed by the row's rowId and the slot.
const DB = "oems_laser_register_files", STORE = "files";
function db() {
  return new Promise((ok, bad) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => bad(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => {
    const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => { d.close(); ok(req && req.result); };
    t.onerror = () => { d.close(); bad(t.error); };
  });
}
export const getReportFile = (id, slot) => tx("readonly", (s) => s.get(id + "/" + slot));
const deleteReportFile = (id, slot) => tx("readwrite", (s) => s.delete(id + "/" + slot));
// Saves a report file to a row ("index" is the row's place in the stored register). Returns the line shown in the
// row (file name · date added), or throws.
export async function setReportFile(index, slot, file) {
  if (!REPORT_SLOTS.includes(slot)) throw new Error("Unknown report slot.");
  const rows = loadRegister();
  if (!rows[index]) throw new Error("That row is no longer in the register.");
  if (slot === "reportOriginal" && rows[index].reportOriginal) throw new Error("The original report is locked and cannot be replaced.");
  if (!rows[index].rowId) rows[index].rowId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  await tx("readwrite", (s) => s.put({ name: file.name, type: file.type, data: file }, rows[index].rowId + "/" + slot));
  rows[index][slot] = `${file.name} · added ${new Date().toISOString().slice(0, 10)}`;
  try { localStorage.setItem(REG_KEY, JSON.stringify(rows)); } catch (e) { throw new Error("Could not save: this browser is not allowing storage."); }
  return rows[index][slot];
}
