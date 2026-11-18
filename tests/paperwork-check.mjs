// Run with: node tests/paperwork-check.mjs
// Checks the inventory row, the eyewear line and the SOP draft built from an assessment.
import { inventoryRow, eyewearRow, sopDraft, tsv, signKind, signSvg } from "../assessment/paperwork.js";
import { NONBEAM } from "../assessment/questions.js";
let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` → ${JSON.stringify(got)}`}`); };
const nb = Object.fromEntries(NONBEAM.flatMap(h => [[`nb_${h.id}`, "no"]]));
const base = (o = {}, a = {}) => ({ name: "L-01", loc: "Bldg 2", mfr: "Acme", model: "FM-50", cls: "1", e: "4", nm: "1064", output: "50 W",
  date: "2026-11-18", by: "J. F.", req: true, calcDone: true, need: 5, tier: "Medium", eyeModel: "F18", eyeOD: "4",
  hazardRows: [["NOHD, direct beam", "942.9 m (3093 ft)"]], nonbeam: NONBEAM.map(h => ({ name: h.name, status: "Not present", notes: "" })), controls: [["Is the enclosure interlocked so the laser stops when it is opened?", "Yes", "intlk"]],
  ...o, a: { cls: "1", clsIn: "4", open: "no", service: "yes", eyewear: "yes", sop: "no", ...nb, ...a } });
const get = (row, k) => row.find(([h]) => h.startsWith(k))[1];

let r = inventoryRow(base());
ok("inventory row has the sheet's 20 columns A to T", r.length === 20, r.length);
ok("class is the laser inside", get(r, "Class") === "4");
ok("enclosed Class 1 machine", get(r, "Enclosed") === "Enclosed (Class 1 in normal use)", get(r, "Enclosed"));
ok("date is month/day/year", get(r, "Laser Safety Assessment Completed") === "11/18/2026", get(r, "Laser Safety Assessment Completed"));
ok("risk carried over", get(r, "Assessment Risk") === "Medium");
ok("eyewear below the required OD → No", get(r, "Eyewear Selected") === "No", get(r, "Eyewear Selected"));
ok("no SOP → No", get(r, "SOP Approved") === "No");
ok("an SOP exists → left for the LSO", get(inventoryRow(base({}, { sop: "yes" })), "SOP Approved") === "");
ok("things the assessment does not ask are blank", ["Laser Type", "Area / Room", "Responsible Department", "Registered with LSO", "Installation Review", "Notes"].every(k => get(r, k) === ""));
ok("tsv has one value per column", tsv(r).split("\t").length === 20);
r = inventoryRow(base({ cls: "4", tier: "High" }, { cls: "4", clsIn: "", open: "yes" }));
ok("open beam → Not fully enclosed", get(r, "Enclosed") === "Not fully enclosed");
r = inventoryRow(base({ cls: "2", e: "3B" }, { cls: "2", clsIn: "3B" }));
ok("enclosed, label not Class 1 → left for the LSO", get(r, "Enclosed") === "");
r = inventoryRow(base({ tier: "Incomplete", calcDone: false }));
ok("incomplete assessment → no date or risk", get(r, "Laser Safety Assessment Completed") === "" && get(r, "Assessment Risk") === "");
ok("required calcs not done → No", get(r, "NHZ Calculated") === "No");
r = inventoryRow(base({ e: "1", cls: "1", req: false, calcDone: false }, { clsIn: "none", service: "no" }));
ok("Class 1 → calcs, SOP and eyewear N/A", get(r, "NHZ Calculated") === "N/A" && get(r, "SOP Approved") === "N/A" && get(r, "Eyewear Selected") === "N/A", r);

r = eyewearRow(base());
ok("eyewear line has Appendix H's 7 columns", r.length === 7);
ok("required OD", get(r, "OD required") === "OD 5");
ok("rated OD from the label", get(r, "Rated OD") === "OD 4");
const html = sopDraft(base());
ok("SOP draft names the form", html.includes("OEMS-IH-LSO-001-C"));
ok("SOP draft carries the NOHD", html.includes("942.9 m"));
ok("SOP draft carries the required OD", html.includes("OD 5 or higher at 1064 nm"));
ok("SOP draft lists the interlock answer", html.includes("interlocked") && html.includes("<strong>Yes</strong>"));
ok("SOP draft escapes what was typed", !sopDraft(base({ name: "<b>x" })).includes("<b>x"));

// Entrance sign
const open4 = base({ cls: "4", e: "4", power: ["Average power", "50 W"] }, { cls: "4", clsIn: "", open: "yes" });
ok("open Class 4 → WARNING", signKind(open4).kind === "WARNING" && signKind(open4).canDanger === true, signKind(open4));
ok("open Class 4, LSO switch → DANGER", signKind(open4, { danger: true }).kind === "DANGER");
const open3b = base({ cls: "3B", e: "3B" }, { cls: "3B", clsIn: "", open: "yes" });
ok("open Class 3B → WARNING, no DANGER switch", signKind(open3b, { danger: true }).kind === "WARNING" && !signKind(open3b).canDanger);
ok("enclosed, opened for service → NOTICE", signKind(base()).kind === "NOTICE");
ok("enclosed, never opened → no sign", signKind(base({}, { service: "no" })).kind === "none");
ok("Class 3R → no sign", signKind(base({ cls: "3R", e: "3R" }, { cls: "3R", open: "yes" })).kind === "none");
let svg = signSvg(open4);
ok("sign carries class, OD and power", svg.includes("Class 4 Laser Controlled Area") && svg.includes("OD 5 @ 1064 nm") && svg.includes("Average power: 50 W"), svg.slice(0, 80));
ok("no calculation → OD left blank to write in", signSvg({ ...open4, calcDone: false }).includes("OD __________ @"));
ok("NOTICE sign says temporary", signSvg(base()).includes("Temporary Class 4 Laser Controlled Area"));
ok("no sign → nothing drawn", signSvg(base({}, { service: "no" })) === "");
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
