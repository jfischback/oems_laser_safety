// Run with: node tests/validation-check.mjs
// The validation record must keep its result: every case passes except the three OSHA table values
// that do not follow from OSHA's own inputs (explained on the Validation page).
import { run } from "../validation/cases.js";
const rows = run(), bad = rows.filter(r => !r.ok);
for (const r of rows) console.log(`${r.ok ? "PASS" : r.note ? "KNOWN" : "FAIL"} ${r.source} | ${r.what} | published ${r.ref} | tool ${r.got}`);
const unexpected = bad.filter(r => !r.note);
console.log(`${rows.length} cases, ${rows.length - bad.length} agree, ${bad.length - unexpected.length} explained, ${unexpected.length} unexplained`);
const okCount = rows.length === 40 && bad.length === 3 && unexpected.length === 0;
console.log(okCount ? "ALL PASS" : "FAILED");
process.exit(okCount ? 0 : 1);
