import { CALCULATORS } from "./calculators.js";
import { computeList, solveBlank } from "./solver.js";
import { DIAGRAMS } from "./diagram.js";

const calc = CALCULATORS.find(c => c.slug === document.body.dataset.slug);
const root = document.getElementById("calc");

function fmt(x) {
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e7) return String(Number(x.toPrecision(4)));
  return x.toExponential(3);
}

function render() {
  document.title = `${calc.name} | OEMS Laser Safety`;
  root.innerHTML = `
    <a class="back" href="../">All laser safety tools</a>
    <h1>${calc.name}</h1>
    <p class="eq">${calc.equation}</p>
    <p class="how">${calc.list
      ? "Enter each reading. Leave unused boxes blank and press Solve."
      : "Fill in every box except the one you want. Leave that one blank and press Solve."}</p>
    <form id="f" novalidate>
      ${calc.vars.map(v => `
        <label class="row" for="in-${v.k}">
          <span class="name">${v.label}</span>
          <input id="in-${v.k}" name="${v.k}" type="text" inputmode="decimal" autocomplete="off">
          <span class="unit">${v.unit}</span>
        </label>`).join("")}
      ${calc.list ? `
        <label class="row" for="in-${calc.result.k}">
          <span class="name">${calc.result.label}</span>
          <input id="in-${calc.result.k}" name="${calc.result.k}" type="text" readonly tabindex="-1">
          <span class="unit">${calc.result.unit}</span>
        </label>` : ""}
      <div class="buttons">
        <button type="submit">Solve</button>
        <button type="button" id="clear" class="secondary">Clear</button>
      </div>
      <p id="msg" role="status" aria-live="polite"></p>
    </form>
    ${DIAGRAMS[calc.slug] ? `<div id="diagram" class="diagram" hidden></div>` : ""}
    <p class="src">Source: ${calc.source}</p>`;

  const form = document.getElementById("f");
  const msg = document.getElementById("msg");
  const diagram = document.getElementById("diagram");
  const hideDiagram = () => { if (diagram) { diagram.hidden = true; diagram.innerHTML = ""; } };

  form.addEventListener("submit", e => {
    e.preventDefault();
    form.querySelectorAll("input").forEach(i => i.classList.remove("solved"));
    const values = {};
    for (const v of calc.vars) {
      const raw = form.elements[v.k].value.trim().replace(/,/g, "");
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) { msg.className = "err"; msg.textContent = `"${raw}" is not a number.`; return; }
      values[v.k] = n;
    }
    try {
      const { key, value } = calc.list ? computeList(calc, values) : solveBlank(calc, values);
      const input = form.elements[key];
      input.value = fmt(value);
      input.classList.add("solved");
      const v = calc.list ? calc.result : calc.vars.find(x => x.k === key);
      msg.className = "ok";
      msg.textContent = `${v.label.split(",")[0]} = ${fmt(value)} ${v.unit}`;
      if (diagram) {
        const svg = DIAGRAMS[calc.slug]({ ...values, [key]: value }, root.clientWidth - 26);
        if (svg) { diagram.innerHTML = svg; diagram.hidden = false; } else hideDiagram();
      }
    } catch (err) {
      msg.className = "err";
      msg.textContent = err.message;
      hideDiagram();
    }
  });

  document.getElementById("clear").addEventListener("click", () => {
    form.reset();
    form.querySelectorAll("input").forEach(i => i.classList.remove("solved"));
    msg.textContent = "";
    hideDiagram();
  });
}

if (calc) render();
else root.textContent = "Calculator not found.";
