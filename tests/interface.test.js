const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { JSDOM } = require("jsdom");

function row(id, uf, city, district, description, discount, financing = "Sim") {
  return [String(id), uf, city, district, `Rua ${id}`, "100.000,00", "200.000,00", String(discount),
    financing, description, "Venda Direta Online", "https://venda-imoveis.caixa.gov.br/imovel"];
}

async function openPage(data, responseForUrl = () => ({ ok: true, json: async () => data })) {
  const html = await readFile(path.join(__dirname, "..", "index.html"), "utf8");
  const script = await readFile(path.join(__dirname, "..", "app.js"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost:8000", runScripts: "outside-only" });
  const calls = [];
  dom.window.fetch = async url => { calls.push(url); return responseForUrl(url); };
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  dom.window.eval(script);
  await new Promise(resolve => setImmediate(resolve));
  return { dom, document: dom.window.document, calls };
}

function change(dom, control, value) {
  if (control.type === "checkbox") control.checked = value;
  else control.value = value;
  const type = control.tagName === "SELECT" || control.type === "checkbox" ? "change" : "input";
  control.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

test("ranking, alertas, diálogo e paginação usam os imóveis correspondentes", async () => {
  const properties = Array.from({ length: 51 }, (_, index) =>
    row(index + 1, "RJ", "RIO DE JANEIRO", "CENTRO", "Casa, 100.00 de área privativa, 2 qto(s)", 99 - index));
  const alerts = properties.map((_, index) => index === 0 || index === 50
    ? { nome: "Centro", grupos: [{ grupo: "Milicia", percentual: "25.2" }] } : null);
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: alerts });
  try {
    const rows = document.querySelectorAll("tbody tr");
    assert.equal(rows.length, 50);
    assert.ok(rows[0].classList.contains("has-alert"));
    assert.ok(!rows[1].classList.contains("has-alert"));
    assert.equal(document.querySelector("#ranking-cards .card-price").textContent, "R$ 100.000,00");
    assert.match(document.querySelector("#ranking-cards .discount-badge").textContent, /99%/);
    rows[0].querySelector(".alert-button").click();
    assert.match(document.querySelector("#alert-title").textContent, /imóvel 1$/);
    assert.match(document.querySelector("#alert-description").textContent, /Milicia: 25,2%/);
    document.querySelector("#alert-dialog").dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(document.querySelector("#alert-dialog").open, false);
    document.querySelector("#next").click();
    const last = document.querySelector("tbody tr");
    assert.ok(last.classList.contains("has-alert"));
    last.querySelector(".alert-button").click();
    assert.match(document.querySelector("#alert-title").textContent, /imóvel 51$/);
  } finally {
    dom.window.close();
  }
});

test("filtros, visualização e filtros salvos refletem os dados", async () => {
  const properties = [
    row(1, "RJ", "RIO DE JANEIRO", "CENTRO", "Casa, 75.00 de área privativa, 3 qto(s)", 45),
    row(2, "RJ", "NITEROI", "CENTRO", "Apartamento, 50.00 de área privativa, 1 qto(s)", 60, "Não"),
    row(3, "SP", "SAO PAULO", "JARDIM", "Casa, 90.00 de área total, 2 qto(s)", 30),
  ];
  const alerts = [{ nome: "Centro", grupos: [{ grupo: "CV", percentual: "2.5" }] }, null, null];
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: alerts });
  try {
    const fields = document.querySelector("#filters").elements;
    change(dom, fields.uf, "RJ");
    assert.equal(document.querySelectorAll("tbody tr").length, 2);
    change(dom, fields.city, "RIO DE JANEIRO");
    change(dom, fields.minRooms, "3");
    assert.equal(document.querySelector("tbody tr td").textContent, "1");
    change(dom, fields.hideAlerts, true);
    assert.equal(document.querySelectorAll("tbody tr").length, 0);
    change(dom, fields.hideAlerts, false);
    document.querySelector("#filter-name").value = "Rio";
    document.querySelector("#save-filter").click();
    assert.match(document.querySelector("#filter-message").textContent, /Filtro salvo/);
    document.querySelector("#clear-filters").click();
    assert.equal(document.querySelectorAll("tbody tr").length, 3);
    change(dom, document.querySelector("#saved-filters"), "Rio");
    assert.equal(document.querySelectorAll("tbody tr").length, 1);
    assert.equal(fields.city.value, "RIO DE JANEIRO");
    document.querySelector("#grid-view").click();
    assert.equal(document.querySelectorAll("#result-cards .property-card").length, 1);
    assert.equal(document.querySelector("#grid-view").getAttribute("aria-pressed"), "true");
    assert.ok(document.querySelector("#result-cards .property-card").classList.contains("has-alert"));
  } finally {
    dom.window.close();
  }
});

test("busca, tipo, modalidade, preço, desconto e financiamento filtram resultados", async () => {
  const properties = [
    row(1, "RJ", "RIO DE JANEIRO", "CENTRO", "Casa, 75.00 de área privativa, 3 qto(s)", 45),
    row(2, "RJ", "NITEROI", "JARDIM", "Apartamento, 50.00 de área privativa, 1 qto(s)", 60, "Não"),
    row(3, "SP", "SAO PAULO", "JARDIM", "Casa, 90.00 de área total, 2 qto(s)", 30),
  ];
  properties[0][5] = "150.000,00";
  properties[2][10] = "Leilão";
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: [null, null, null] });
  try {
    const fields = document.querySelector("#filters").elements;
    change(dom, fields.search, "rua 1");
    assert.equal(document.querySelector("tbody tr td").textContent, "1");
    change(dom, fields.search, "");
    change(dom, fields.district, "jardim");
    assert.equal(document.querySelectorAll("tbody tr").length, 2);
    change(dom, fields.type, "Casa");
    change(dom, fields.modality, "Leilão");
    assert.equal(document.querySelector("tbody tr td").textContent, "3");
    document.querySelector("#clear-filters").click();
    change(dom, fields.minPrice, "120000");
    assert.equal(document.querySelector("tbody tr td").textContent, "1");
    change(dom, fields.minPrice, "");
    change(dom, fields.maxPrice, "100000");
    change(dom, fields.minDiscount, "50");
    assert.equal(document.querySelector("tbody tr td").textContent, "2");
    change(dom, fields.financing, true);
    assert.equal(document.querySelectorAll("tbody tr").length, 0);
  } finally {
    dom.window.close();
  }
});

test("sincronização e nova tentativa usam apenas o arquivo local", async () => {
  const data = { dataGeracao: "data", imoveis: [row(1, "RJ", "RIO DE JANEIRO", "CENTRO", "Casa", 20)], alertas: null };
  const { dom, document, calls } = await openPage(data, url =>
    url.includes("?local=1") ? { ok: false } : { ok: true, json: async () => data });
  try {
    assert.equal(document.querySelector('[name="hideAlerts"]').disabled, true);
    document.querySelector("#sync").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(document.querySelector("#status").textContent, /CSV local/);
    document.querySelector("#retry").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ["/api/imoveis", "/api/imoveis?local=1", "/api/imoveis?local=1"]);
  } finally {
    dom.window.close();
  }
});
