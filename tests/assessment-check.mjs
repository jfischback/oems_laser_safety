// Run with: node tests/assessment-check.mjs
// Checks the gates and the risk tier on typical lasers.
import { riskTier, calcRequired, effectiveClass, visible, NONBEAM } from "../assessment/questions.js";
let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` → ${JSON.stringify(got)}`}`); };

// Answer every visible question the "good" way, then apply overrides.
function laser(base) {
  let a = { mfr: "Acme", model: "X1", nm: "1064", ...base };
  for (let i = 0; i < 4; i++) for (const q of visible(a)) if (!(q.id in a)) a[q.id] = q.good || (q.id === "align" ? "no" : "no");
  for (const h of NONBEAM) if (!(`nb_${h.id}` in a)) a[`nb_${h.id}`] = "no";
  return a;
}

// Class 1 machine, Class 4 laser inside, nobody services it: calcs optional, Low.
let a = laser({ cls: "1", clsIn: "4", open: "no", service: "no" });
ok("embedded Class 4 is treated as Class 4", effectiveClass(a) === "4", effectiveClass(a));
ok("enclosed, no service → calcs optional", !calcRequired(a));
ok("enclosed, no service, controls in place → Low", riskTier(a).tier === "Low", riskTier(a));

// Same machine, vendor services it: calcs required.
a = laser({ cls: "1", clsIn: "4", open: "no", service: "yes" });
ok("service on an embedded Class 4 → calcs required", calcRequired(a));
ok("service, all controls in place → Low", riskTier(a).tier === "Low", riskTier(a));
a = laser({ cls: "1", clsIn: "4", open: "no", service: "yes", stops: "no" });
ok("service with a gap → Medium", riskTier(a).tier === "Medium", riskTier(a));

// Open-beam Class 4: High no matter what.
a = laser({ cls: "4", open: "yes", service: "yes" });
ok("open Class 4 with every control in place → High", riskTier(a).tier === "High", riskTier(a));
ok("open Class 4 → calcs required", calcRequired(a));

// Unknown class inside: treated as Class 4 and flagged.
a = laser({ cls: "1", clsIn: "unknown", open: "no", service: "no" });
ok("unknown inside class → Class 4", effectiveClass(a) === "4");
ok("unknown inside class → finding", riskTier(a).findings.some(f => f.id === "clsIn"));

// Uncontrolled non-beam hazard → Medium.
a = laser({ cls: "1", clsIn: "none", open: "no", service: "no", nb_lgac: "yes", nbc_lgac: "no" });
ok("uncontrolled fume → Medium", riskTier(a).tier === "Medium", riskTier(a));

// True Class 2 pointer: Low, calcs optional.
a = laser({ cls: "2", clsIn: "none", open: "yes", service: "no", nm: "650" });
ok("Class 2 → Low", riskTier(a).tier === "Low", riskTier(a));
ok("Class 2 → calcs optional", !calcRequired(a));

// Missing answers → Incomplete.
a = { cls: "4", mfr: "Acme", model: "X1", nm: "1064" };
ok("unanswered → Incomplete", riskTier(a).tier === "Incomplete");
a = laser({ cls: "4", open: "yes", service: "yes" }); delete a.model;
ok("no model → Incomplete", riskTier(a).tier === "Incomplete");

// Eyewear rated below the required OD → finding.
a = laser({ cls: "4", open: "yes", service: "no", eyewear: "yes", eyeOD: "3" });
ok("eyewear OD 3 vs required 5 → finding", riskTier(a, { requiredOD: 5, nm: "1064" }).findings.some(f => f.id === "eyeOD"));

// Every finding carries its program section.
a = laser({ cls: "4", open: "yes", service: "yes", stops: "no", sop: "no", loto: "no", nb_lgac: "yes", nbc_lgac: "no" });
ok("every finding has a program section", riskTier(a).findings.every(f => f.ref), riskTier(a).findings);

console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
