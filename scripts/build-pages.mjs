// Run with: node scripts/build-pages.mjs
// Writes index.html (the list), one folder per calculator (e.g. half-value-layer/index.html),
// and vercel.json, which also serves each page at its underscore name (e.g. /half_value_layer/).
// The OEMS banner (partials/topbar.html) and first-visit agreement (partials/gate.html,
// disclaimer.js, disclaimer.css) are copied from the APF calculator.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CALCULATORS, GROUPS } from "../calculators.js";

const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const GATE = read("partials/gate.html");
const TOPBAR = read("partials/topbar.html");
const DISCLAIMER = "For estimation only. Not a substitute for a hazard evaluation by a qualified laser safety officer.";
const SITE = "OEMS Laser Safety";
const COPYRIGHT = '<p class="copyright">© 2026 Occupational Exposure Management Systems LLC. All rights reserved.</p>';

const page = (title, bodyAttrs, main, depth) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${depth}style.css">
<link rel="stylesheet" href="${depth}disclaimer.css">
<script>try { if (localStorage.getItem("oems_disclaimer_v1")) document.documentElement.classList.add("oems-agreed"); } catch (e) {}</script>
</head>
<body${bodyAttrs}>
${GATE.replace('src="disclaimer.js"', `src="${depth}disclaimer.js"`)}
${TOPBAR}
${main}
</body>
</html>
`;

for (const c of CALCULATORS) {
  mkdirSync(new URL(`${c.slug}/`, root), { recursive: true });
  writeFileSync(new URL(`${c.slug}/index.html`, root), page(
    `${c.name} | ${SITE}`,
    ` data-slug="${c.slug}"`,
    `<main>
<div id="calc"></div>
<p class="disclaimer">${DISCLAIMER}</p>
${COPYRIGHT}
</main>
<script type="module" src="../app.js"></script>`,
    "../"));
}

// Hand-built tools that are not equation calculators. Each has its own folder and
// app.js; its page body lives in partials/<slug>.html.
const TOOLS = [
  { slug: "assessment", name: "Laser Safety Assessment", group: "Assessment" },
  { slug: "register", name: "Laser Risk Register", group: "Assessment" },
];
for (const t of TOOLS) {
  writeFileSync(new URL(`${t.slug}/index.html`, root), page(
    `${t.name} | ${SITE}`, ` data-tool="${t.slug}"`, read(`partials/${t.slug}.html`), "../"));
}

const list = `<div class="lead-tool">
<h2>Laser Safety Assessment</h2>
<p>One laser at a time: the questions, the beam calculations (MPE, eyewear OD, NOHD and hazard zones), a High, Medium or Low risk ranking, and a printable report with the calculation record. It also fills in the program paperwork for that laser: the inventory row, the eyewear line, an operating procedure draft and the entrance sign.</p>
<p><a class="lead-btn" href="assessment/">Start an assessment</a> <a class="lead-link" href="register/">Laser risk register</a></p>
</div>
<h2>Laser calculators</h2>
<p class="how">Each calculator solves for whichever value you leave blank. The assessment uses the same equations.</p>
<ul class="list">
${CALCULATORS.map(c => `<li><a href="${c.slug}/">${c.name}</a></li>`).join("\n")}
</ul>`;

writeFileSync(new URL("index.html", root), page(SITE, "", `<main>
<h1>Laser Safety Tools</h1>
${list}
<p class="disclaimer">${DISCLAIMER}</p>
${COPYRIGHT}
</main>`, ""));

const aliases = [...CALCULATORS, ...TOOLS].map(c => c.slug).sort().map(slug => [slug.replace(/-/g, "_"), slug]);
writeFileSync(new URL("vercel.json", root), JSON.stringify({
  redirects: [
    ...aliases.map(([u]) => ({ source: `/${u}`, destination: `/${u}/`, permanent: false })),
    // The page's old name on the radiation site.
    ...["laser-hazard-evaluation", "laser_hazard_evaluation"].map(u => ({ source: `/${u}/:path*`, destination: "/assessment/", permanent: false })),
  ],
  rewrites: [
    ...aliases.map(([u, slug]) => ({ source: `/${u}/`, destination: `/${slug}/index.html` })),
    ...aliases.map(([u, slug]) => ({ source: `/${u}/:path+`, destination: `/${slug}/:path+` })),
  ],
}, null, 2) + "\n");

console.log(`Wrote index.html, vercel.json, ${CALCULATORS.length} calculator pages and ${TOOLS.length} tool page(s)`);
