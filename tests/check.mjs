// Run with: node tests/check.mjs
// 1. Each calculator's main answer must match the IH Calculator Equations Google Sheet.
// 2. Leaving each variable blank (except in list calculators) in turn must solve back to its example value.
import { readFileSync } from "node:fs";
import { CALCULATORS } from "../calculators.js";
import { computeList, solveBlank } from "../solver.js";

const sheet = JSON.parse(readFileSync(new URL("./sheet-values.json", import.meta.url)));
const close = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b));
let failures = 0, checks = 0;

for (const calc of CALCULATORS) {
  if (calc.list) {
    const { value } = computeList(calc, calc.example);
    const expected = sheet[calc.slug]?.primaryValue;
    checks++;
    if (expected === undefined || !close(value, expected)) {
      failures++;
      console.log(`FAIL ${calc.slug}: ${calc.result.k} = ${value}, Sheet says ${expected}`);
    }
    continue;
  }

  const full = { ...calc.example };
  full[calc.primary] = calc.solve[calc.primary](full);

  const expected = sheet[calc.slug]?.primaryValue;
  checks++;
  if (expected === undefined || !close(full[calc.primary], expected)) {
    failures++;
    console.log(`FAIL ${calc.slug}: ${calc.primary} = ${full[calc.primary]}, Sheet says ${expected}`);
  }

  for (const v of calc.vars) {
    const given = { ...full };
    delete given[v.k];
    checks++;
    try {
      const { value } = solveBlank(calc, given);
      if (!close(value, full[v.k])) {
        failures++;
        console.log(`FAIL ${calc.slug}: solving ${v.k} gave ${value}, expected ${full[v.k]}`);
      }
    } catch (e) {
      failures++;
      console.log(`FAIL ${calc.slug}: solving ${v.k} threw "${e.message}"`);
    }
  }
}
console.log(`${CALCULATORS.length} calculators, ${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
