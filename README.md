# oems_laser_safety
OEMS Laser Safety: the Laser Safety Assessment and the laser calculators.

## Pages
- `assessment/`: the Laser Safety Assessment. One laser at a time: laser details, beam access (open or enclosed, service and alignment), beam controls and eyewear, the beam calculations (automatic ANSI Z136.1 MPE, eyewear OD, NOHD and hazard zones, with diagrams), non-beam hazards, program items, a High / Medium / Low risk tier, and a printable report with a calculation appendix.
  - `questions.js`: the questions, the gates (which questions and calculations apply), findings and the risk tier.
  - `calc.js`, `mpe.js`: the beam math and the ANSI MPE tables (moved from oems_radiation's Laser Hazard Evaluation).
  - `app.js`: the page and the report.
- `register/`: the laser risk register, built the same way as the chemical tool's register (non_man_exposure_assessment). One row per laser, added from the assessment with "Add to register"; kept in the browser only, with Excel download and load, follow-up columns, and the original and signed report files.
- `assessment/paperwork.js`: program paperwork from one assessment, shown in section 9 of the assessment page: the laser's row for the Appendix A inventory sheet (copy and paste across), its line for the Appendix H eyewear log, and a printable draft of the Appendix C operating procedure. Cells the assessment does not ask about are left blank for the Laser Safety Officer. Tests: `node tests/paperwork-check.mjs`.
- Six laser calculators (NHZ direct beam, lens, diffuse, Ds, beam diameter, eyewear OD), defined in `calculators.js` and drawn by `diagram.js`.

## Changing things
```
node scripts/build-pages.mjs      # rebuilds the pages and vercel.json
node tests/check.mjs              # calculators against the Google Sheet values
node tests/mpe-check.mjs          # MPE tables
node tests/assessment-check.mjs   # gates and risk tiers
```

## Hosting
Static site, no build step. On Vercel, import this repo with the default settings. The old radiation-site address /laser-hazard-evaluation redirects to /assessment/.
