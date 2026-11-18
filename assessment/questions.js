// Laser safety assessment: the questions, which ones show (the gates), the findings
// a wrong answer produces, and the High / Medium / Low risk tier.
// No page code here, so tests/assessment-check.mjs can run it in Node.
//
// Answers are "yes", "no", "na" or "" (not answered). Each yes/no question names the
// answer that is OK ("good"); the other answer is a finding with a recommendation.
// category: the ANSI Z136.1 hazard-evaluation group the report files it under
//   (laser = the laser and its enclosure, environment = where it is used, personnel = the people).
// control: where the fix sits in the hierarchy of controls, used to order recommendations.

export const CLASSES = ["1", "1M", "2", "2M", "3R", "3B", "4"];
const HIGHER = ["3R", "3B", "4"];

// The class that drives the gates: the laser inside the enclosure when the label class is
// lower (a Class 1 machine can hold a Class 4 laser). "Don't know" is treated as Class 4
// until the manual or service label says otherwise.
export function effectiveClass(a) {
  if (["1", "1M", "2", "2M"].includes(a.cls)) {
    if (a.clsIn === "unknown") return "4";
    if (HIGHER.includes(a.clsIn)) return a.clsIn;
  }
  return a.cls || "";
}
const eff = a => effectiveClass(a);
const higher = a => HIGHER.includes(eff(a));
const hiClass = a => ["3B", "4"].includes(eff(a));
const beamReachable = a => a.open === "yes" || a.service === "yes";

// Gate: the beam calculations (MPE, eyewear OD, NOHD, NHZ) are required when a Class 3R,
// 3B or 4 beam can be reached in normal operation or during service or alignment.
// They stay available, as optional, for every other laser.
export const calcRequired = a => higher(a) && beamReachable(a);
// Beam controls apply to the same lasers, for normal operation and for service and alignment.
export const beamControlsApply = a => higher(a) && beamReachable(a);
export const closedApplies = a => higher(a) && a.open === "no";

const q = (o) => ({ na: false, ...o });

export const QUESTIONS = [
  // ---------- 2. Beam access ----------
  q({ id: "open", sec: "access", text: "During normal operation, can anyone reach the laser beam?",
      hint: "Answer No only if the beam is fully enclosed while the laser runs.",
      show: () => true }),
  q({ id: "service", sec: "access", text: "Does anyone ever open the enclosure, defeat an interlock, or work on the beam path for service, alignment or maintenance?",
      hint: "Answer Yes even if only the vendor's service technician does it.",
      show: () => true }),
  q({ id: "align", sec: "access", text: "Is beam alignment done on site?",
      show: a => higher(a) && a.service === "yes" }),
  q({ id: "alignLow", sec: "access", good: "yes", cat: "personnel", control: "administrative",
      text: "Is alignment done at the lowest practical power, with alignment aids (IR viewer or cards, a low-power visible beam)?",
      finding: "Alignment is not done at reduced power with alignment aids.",
      rec: "Write an alignment procedure that uses the lowest practical power, alignment aids and alignment eyewear. Alignment is where most laser eye injuries happen.",
      show: a => higher(a) && a.align === "yes" }),
  q({ id: "alignAuth", sec: "access", good: "yes", cat: "personnel", control: "administrative",
      text: "Is alignment done only by people authorized and trained for it?",
      finding: "People who are not authorized and trained do alignment.",
      rec: "Limit alignment to named, trained people, and list them on the authorized operator list.",
      show: a => higher(a) && a.align === "yes" }),

  // ---------- Closed beam ----------
  q({ id: "intlk", sec: "closed", good: "yes", cat: "laser", control: "engineering",
      text: "Is the enclosure interlocked so the laser stops when it is opened?",
      finding: "The enclosure is not interlocked.",
      rec: "Interlock every removable panel and door of the enclosure so the beam stops when it is opened.",
      show: closedApplies }),
  q({ id: "intlkTest", sec: "closed", good: "yes", cat: "laser", control: "administrative",
      text: "Are the interlocks tested on a schedule, with records kept?",
      finding: "Interlocks are not tested on a schedule.",
      rec: "Test the interlocks on a set schedule (and after service), and keep the records.",
      show: a => closedApplies(a) && a.intlk !== "no" }),
  q({ id: "windows", sec: "closed", good: "yes", na: true, cat: "laser", control: "engineering",
      text: "Are any viewing windows rated for this wavelength?", hint: "N/A if the enclosure has no viewing windows.",
      finding: "Viewing windows are not rated for the laser wavelength.",
      rec: "Replace the viewing windows with ones rated (OD and wavelength) for this laser, or cover them.",
      show: closedApplies }),
  q({ id: "housing", sec: "closed", good: "yes", cat: "laser", control: "administrative",
      text: "Is the protective housing labeled (class label, and warnings at access panels)?",
      finding: "The protective housing is not labeled.",
      rec: "Label the housing with the laser class and put warning labels on every access panel.",
      show: closedApplies }),
  q({ id: "modified", sec: "closed", good: "no", cat: "laser", control: "engineering",
      text: "Has the enclosure or the laser been modified since it left the manufacturer?",
      finding: "The laser system has been modified since manufacture.",
      rec: "Have the modified system re-evaluated and its class confirmed. Whoever modifies a laser product can take on the manufacturer's FDA reporting duties (21 CFR 1040.10).",
      show: closedApplies }),

  // ---------- 3. Beam controls and eyewear ----------
  q({ id: "area", sec: "beam", good: "yes", cat: "environment", control: "engineering",
      text: "Is the laser used in a designated laser controlled area with entry controls (interlocked door, warning light or barrier)?",
      finding: "There is no laser controlled area with entry controls.",
      rec: "Set up a laser controlled area with entry controls (interlocked door, warning light, or barrier and curtain) for normal operation and for service.",
      show: beamControlsApply }),
  q({ id: "signs", sec: "beam", good: "yes", cat: "environment", control: "administrative",
      text: "Are laser warning signs posted at every entrance?",
      finding: "Laser warning signs are missing at one or more entrances.",
      rec: "Post a laser warning sign at every entrance, with the wavelength, class and output.",
      show: beamControlsApply }),
  q({ id: "path", sec: "beam", good: "yes", cat: "environment", control: "engineering",
      text: "Is the beam path enclosed, or kept above or below eye level?",
      finding: "Open beam paths are at eye level.",
      rec: "Enclose the beam path as far as practical, or keep it well above or below standing and seated eye level.",
      show: beamControlsApply }),
  q({ id: "walkway", sec: "beam", good: "no", cat: "environment", control: "engineering",
      text: "Does any open beam cross a walkway or aisle?",
      finding: "An open beam crosses a walkway or aisle.",
      rec: "Reroute or enclose the beam so it does not cross a walkway or aisle.",
      show: beamControlsApply }),
  q({ id: "stops", sec: "beam", good: "yes", cat: "environment", control: "engineering",
      text: "Are there beam stops at the end of every beam path?",
      finding: "Beam paths do not all end in a beam stop.",
      rec: "End every beam path in a beam stop rated for the beam's power (non-flammable for Class 4).",
      show: beamControlsApply }),
  q({ id: "reflect", sec: "beam", good: "yes", cat: "environment", control: "administrative",
      text: "Are reflective surfaces controlled, including jewelry, watches and tools near the beam?",
      finding: "Reflective surfaces near the beam are not controlled.",
      rec: "Remove or cover reflective surfaces near the beam, and ban jewelry and watches and use non-reflective tools in the laser area.",
      show: beamControlsApply }),
  q({ id: "optics", sec: "beam", good: "no", cat: "environment", control: "engineering",
      text: "Does anyone look at the beam or the work area through optics (loupes, microscopes, magnifiers, camera viewfinders, binoculars)?",
      hint: "Optics collect more of the beam into the eye. Class 1M and 2M are only safe without them.",
      finding: "People view the beam or work area through optics.",
      rec: "Fit the optics with filters rated for the wavelength, or interlock or enclose them so they cannot be used while the beam can reach them.",
      show: a => ["1M", "2M"].includes(a.cls) || beamControlsApply(a) }),
  q({ id: "key", sec: "beam", good: "yes", cat: "laser", control: "administrative",
      text: "Is the laser key-controlled, with the key kept by an authorized person?",
      finding: "The laser is not key-controlled.",
      rec: "Use the key switch (or a password) and keep the key with an authorized person when the laser is not in use.",
      show: a => hiClass(a) && beamReachable(a) }),
  q({ id: "people", sec: "beam", good: "yes", cat: "personnel", control: "administrative",
      text: "Are only authorized, trained people allowed in the area while the beam can be reached?",
      finding: "Untrained or unauthorized people can be in the area while the beam can be reached.",
      rec: "Keep a list of authorized people and keep everyone else out while the beam can be reached.",
      show: beamControlsApply }),
  q({ id: "eyewear", sec: "beam", good: "yes", cat: "personnel", control: "ppe",
      text: "Is laser safety eyewear provided?",
      finding: "Laser safety eyewear is not provided.",
      rec: "Provide eyewear with at least the OD the calculation requires, marked for this wavelength. Eyewear backs up the engineering controls; it does not replace them.",
      show: beamControlsApply }),
  q({ id: "eyeLabel", sec: "beam", good: "yes", cat: "personnel", control: "ppe",
      text: "Is each pair marked with the wavelength and OD?",
      finding: "Eyewear is not marked with the wavelength and OD.",
      rec: "Use only eyewear marked with the wavelength and OD, so users can check it matches the laser.",
      show: a => beamControlsApply(a) && a.eyewear === "yes" }),
  q({ id: "eyeCond", sec: "beam", good: "yes", cat: "personnel", control: "ppe",
      text: "Is the eyewear in good condition (no cracks, deep scratches, loose filters or damaged frames)?",
      finding: "Eyewear is damaged.",
      rec: "Take damaged eyewear out of service and inspect eyewear on a schedule.",
      show: a => beamControlsApply(a) && a.eyewear === "yes" }),

  // ---------- 6. Program ----------
  q({ id: "lso", sec: "program", good: "yes", cat: "personnel", control: "administrative",
      text: "Is a Laser Safety Officer, or a person responsible for laser safety, designated in writing?",
      finding: "No Laser Safety Officer or responsible person is designated.",
      rec: "Designate a Laser Safety Officer (or responsible person) in writing.",
      show: higher }),
  q({ id: "inventory", sec: "program", good: "yes", cat: "laser", control: "administrative",
      text: "Is this laser on a current laser inventory?",
      finding: "The laser is not on a current laser inventory.",
      rec: "Add the laser to the site laser inventory.",
      show: higher }),
  q({ id: "sop", sec: "program", good: "yes", cat: "personnel", control: "administrative",
      text: "Is there a written SOP for this laser covering operation, service and alignment?",
      finding: "There is no written SOP for this laser.",
      rec: "Write an SOP for this laser covering normal operation, service and alignment.",
      show: higher }),
  q({ id: "training", sec: "program", good: "yes", cat: "personnel", control: "administrative",
      text: "Has everyone who operates, services or aligns the laser had current laser safety training?",
      finding: "Laser safety training is missing or out of date.",
      rec: "Train everyone who operates, services or aligns the laser, and keep the training records.",
      show: higher }),
  q({ id: "contingency", sec: "program", good: "yes", cat: "personnel", control: "administrative",
      text: "Is there a written plan for what to do after a suspected eye exposure?",
      finding: "There is no plan for a suspected eye exposure.",
      rec: "Write an exposure response plan: stop work, report, and send the person for an eye exam promptly.",
      show: higher }),
  q({ id: "visitors", sec: "program", good: "yes", cat: "personnel", control: "administrative",
      text: "Are visitors and contractors, including vendor service technicians, controlled when the laser is on or being serviced?",
      finding: "Visitors and contractors are not controlled.",
      rec: "Escort visitors, and require contractors and vendor technicians to follow the site laser rules and LOTO procedure.",
      show: higher }),
  q({ id: "medical", sec: "program", good: "yes", na: true, cat: "personnel", control: "administrative",
      text: "Are baseline eye exams done where your program requires them?", hint: "N/A if your program does not require them.",
      finding: "Required baseline eye exams are not done.",
      rec: "Schedule the baseline eye exams your program requires.",
      show: a => hiClass(a) }),
];

// Non-beam hazards (ANSI Z136.1 non-beam hazards, plus lockout/tagout).
// Each: present yes/no; if present, controlled yes/no.
export const NONBEAM = [
  { id: "lgac", name: "Laser-generated air contaminants (fume or smoke from cutting, welding, marking or ablation)", control: "local exhaust or fume extraction at the source" },
  { id: "elec", name: "High voltage reachable during service (power supplies, capacitors)", control: "guarding, and service only by qualified electrical workers" },
  { id: "water", name: "Water or liquid cooling near high voltage", control: "tubing and connections inspected, leak detection or drip protection" },
  { id: "fire", name: "Fire (the beam can reach flammable material; any Class 4 beam)", control: "flammables kept out of the beam, non-flammable beam stops and curtains, extinguisher" },
  { id: "explosion", name: "Explosion (arc lamps, pressurized parts, combustible dust from the process)", control: "manufacturer's housings intact, dust collection" },
  { id: "collat", name: "Collateral radiation (UV or blue light from the plasma, RF, X-rays)", control: "shielding or filtered viewing" },
  { id: "gas", name: "Compressed or toxic gases (assist gases, excimer or other laser gases)", control: "cylinders secured, gas cabinet or monitoring" },
  { id: "chem", name: "Chemicals (laser dyes, solvents, cleaning agents)", control: "SDS on hand, ventilation, gloves" },
  { id: "cryo", name: "Cryogenic liquids", control: "ventilation or oxygen monitoring, cryogenic gloves and face shield" },
  { id: "bio", name: "Biological agents (plume from tissue or biological samples)", control: "plume evacuation and respiratory protection" },
  { id: "mech", name: "Mechanical (robots, moving stages, automated parts)", control: "guarding and interlocks" },
  { id: "noise", name: "Noise from the laser process (pulsed marking, cutting)", control: "noise measured, hearing conservation if needed" },
  { id: "ergo", name: "Ergonomics and lighting (dim rooms, awkward alignment work)", control: "task lighting, reachable controls, breaks" },
];
export const LOTO = q({ id: "loto", sec: "nonbeam", good: "yes", cat: "laser", control: "administrative",
  text: "Is there a written, machine-specific lockout/tagout procedure covering the laser power supply and stored energy (capacitors)?",
  finding: "There is no machine-specific lockout/tagout procedure for the laser.",
  rec: "Write a machine-specific LOTO procedure that covers the laser power supply and discharging stored energy (capacitors) before service.",
  show: a => a.service === "yes" || a["nb_elec"] === "yes" });


// OEMS-IH-LSO-001 section each finding falls under, printed in the report.
export const REF = { clsIn: "6.1.1", alignLow: "6.8.2", alignAuth: "6.8.1", intlk: "6.5.1", intlkTest: "6.5.3", windows: "6.5.1",
  housing: "6.11.1", modified: "6.4.2", area: "6.6.1", signs: "6.11.2", path: "6.5.1", walkway: "6.5.1", stops: "6.5.1",
  reflect: "6.8.3", optics: "2.2", key: "6.5.1", people: "6.6.2", eyewear: "6.10.1", eyeLabel: "6.10.2", eyeCond: "6.10.3",
  eyeOD: "6.10.2", lso: "5.2.1", inventory: "6.2.1", sop: "6.7.1", training: "6.15.1", contingency: "6.14",
  visitors: "6.16", medical: "6.13.1", loto: "6.9.1" };
export const refFor = id => REF[id] || (id.startsWith("nb_") ? "6.12.1" : "");

const ORDER = { engineering: 0, administrative: 1, ppe: 2 };

// Questions that show for these answers.
export const visible = a => [...QUESTIONS, LOTO].filter(x => x.show(a));

// What the preparer still has to answer before a tier can be given.
export function missing(a) {
  const out = [];
  if (!a.mfr) out.push("the manufacturer");
  if (!a.model) out.push("the model");
  if (!a.cls) out.push("the class on the label");
  if (["1", "1M", "2", "2M"].includes(a.cls) && !a.clsIn) out.push("whether there is a higher-class laser inside");
  if (!(Number(a.nm) > 0)) out.push("the wavelength");
  for (const x of visible(a)) if (!a[x.id]) out.push(`"${x.text}"`);
  for (const h of NONBEAM) {
    if (!a[`nb_${h.id}`]) out.push(`whether this non-beam hazard is present: ${h.name}`);
    else if (a[`nb_${h.id}`] === "yes" && !a[`nbc_${h.id}`]) out.push(`whether this hazard is controlled: ${h.name}`);
  }
  return out;
}

// Findings: every visible question answered the wrong way, the eyewear OD check,
// uncontrolled non-beam hazards, and an unknown embedded class.
// calc: { requiredOD, nm } from the beam calculations (may be empty).
export function findings(a, calc = {}) {
  const out = [];
  if (a.clsIn === "unknown") out.push({ id: "clsIn", sec: "laser", cat: "laser", control: "administrative",
    text: "The class of the laser inside the enclosure is not known, so it was treated as Class 4.",
    rec: "Find the embedded laser's class and output in the manual or on the service label, and redo this assessment." });
  for (const x of visible(a)) {
    if (!x.good || !a[x.id] || a[x.id] === "na" || a[x.id] === x.good) continue;
    out.push({ id: x.id, sec: x.sec, cat: x.cat, control: x.control, text: x.finding, rec: x.rec });
  }
  const rated = Number(a.eyeOD), need = calc.requiredOD;
  if (beamControlsApply(a) && a.eyewear === "yes" && need > 0) {
    if (!(rated > 0)) out.push({ id: "eyeOD", sec: "beam", cat: "personnel", control: "ppe",
      text: `The eyewear's OD at ${calc.nm} nm was not entered, so it could not be checked against the required OD ${need}.`,
      rec: `Check the eyewear marking and confirm it is OD ${need} or higher at ${calc.nm} nm.` });
    else if (rated < need) out.push({ id: "eyeOD", sec: "beam", cat: "personnel", control: "ppe",
      text: `The eyewear is rated OD ${rated}, below the OD ${need} this laser requires at ${calc.nm} nm.`,
      rec: `Replace it with eyewear rated OD ${need} or higher at ${calc.nm} nm.` });
  }
  for (const h of NONBEAM) {
    if (a[`nb_${h.id}`] === "yes" && a[`nbc_${h.id}`] === "no") out.push({ id: `nb_${h.id}`, sec: "nonbeam",
      cat: "environment", control: "engineering", text: `Uncontrolled non-beam hazard: ${h.name}.`, rec: `Put controls in place: ${h.control}.` });
  }
  return out.map(x => ({ ...x, ref: refFor(x.id) })).sort((x, y) => ORDER[x.control] - ORDER[y.control]);
}

// Risk tier. Rules as approved:
//   High:   Class 3B or 4 (the laser inside, if enclosed) with a beam that can be reached during
//           normal operation. Automatic, whatever else is answered; eyewear cannot lower it.
//   Medium: Class 3B or 4 that is enclosed in normal operation but has gaps for service,
//           alignment or maintenance; or a non-beam hazard that is present and not controlled.
//   Low:    Class 1, or an enclosed system whose controls are all in place; Class 2 and 3R
//           with basic controls in place.
// Where the approved rules are silent (marked PROVISIONAL), the more cautious tier is used
// until the owner decides.
const BEAM_SECS = new Set(["access", "closed", "beam"]);
export function riskTier(a, calc = {}) {
  const need = missing(a);
  if (need.length) return { tier: "Incomplete", reasons: [`Still to answer: ${need.length} item${need.length > 1 ? "s" : ""}.`], missing: need };
  const e = eff(a);
  const f = findings(a, calc);
  const beamGaps = f.filter(x => BEAM_SECS.has(x.sec) || x.id === "clsIn");
  const nonbeamGaps = f.filter(x => x.sec === "nonbeam" && x.id !== "loto");
  const reasons = [];
  if (hiClass(a) && a.open === "yes") {
    reasons.push(`Class ${e} laser beam can be reached during normal operation.`);
    return { tier: "High", reasons, findings: f };
  }
  if (hiClass(a) && beamGaps.length) {
    reasons.push(a.open === "no"
      ? `Class ${e} laser is enclosed in normal operation but has ${beamGaps.length} gap${beamGaps.length > 1 ? "s" : ""} in its enclosure or in its controls for service and alignment.`
      : `Class ${e} laser has gaps in its controls.`);
  }
  // PROVISIONAL: Class 3R, 2, 2M or 1M with a beam-control gap is not covered by the approved rules.
  if (!hiClass(a) && beamGaps.length) reasons.push(`Class ${e} laser has ${beamGaps.length} gap${beamGaps.length > 1 ? "s" : ""} in its basic controls.`);
  if (nonbeamGaps.length) reasons.push(`${nonbeamGaps.length} non-beam hazard${nonbeamGaps.length > 1 ? "s are" : " is"} present and not controlled.`);
  if (reasons.length) return { tier: "Medium", reasons, findings: f };
  reasons.push(hiClass(a) || e === "3R"
    ? `Class ${e} laser with its beam controls in place.` : `Class ${e} laser.`);
  return { tier: "Low", reasons, findings: f };
}
