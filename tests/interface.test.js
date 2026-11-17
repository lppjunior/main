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
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new dom.window.Event("close"));
  };
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
    assert.equal(document.querySelector("#property-dialog").open, false);
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

test("resposta atrasada não substitui o mapa do imóvel aberto depois", async () => {
  const data = { dataGeracao: "data", imoveis: [
    row(1, "SP", "SAO PAULO", "CENTRO", "Casa", 30),
    row(2, "SP", "SAO PAULO", "CENTRO", "Casa", 20),
  ], alertas: [null, null] };
  let resolveFirst;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  const { dom, document } = await openPage(data, url => {
    if (url === "/api/imoveis/1/localizacao") return first;
    if (url === "/api/imoveis/2/localizacao") return { ok: true, json: async () => ({ localizacao: null }) };
    return { ok: true, json: async () => data };
  });
  try {
    document.querySelectorAll("tbody .detail-button")[0].click();
    document.querySelector("#property-dialog").close();
    document.querySelectorAll("tbody .detail-button")[1].click();
    await new Promise(resolve => setImmediate(resolve));
    resolveFirst({ ok: true, json: async () => ({ localizacao: { lat: 1, lon: 2, endereco: "antigo" } }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.match(document.querySelector("#property-title").textContent, /imóvel 2/i);
    assert.match(document.querySelector("#map-status").textContent, /não encontrada/);
    assert.equal(document.querySelector("#property-map").hidden, true);
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

test("detalhes exibem os campos, alerta e mapa aproximado do imóvel selecionado", async () => {
  const properties = [row(1, "RJ", "RIO DE JANEIRO", "CENTRO", "Casa, 3 qto(s)", 45)];
  const data = { dataGeracao: "data", imoveis: properties,
    alertas: [{ nome: "Centro", grupos: [{ grupo: "CV", percentual: "2.5" }] }] };
  const { dom, document, calls } = await openPage(data, url => url.startsWith("/api/imoveis/")
    ? { ok: true, json: async () => ({ localizacao: { lat: -22.9, lon: -43.2, endereco: "Centro, Rio" } }) }
    : { ok: true, json: async () => data });
  let marker;
  dom.window.L = {
    map: () => ({ setView: () => ({ invalidateSize() {}, remove() {} }) }),
    tileLayer: () => ({ on() {}, addTo() {} }),
    circleMarker: coords => { marker = coords; return { addTo() {} }; },
  };
  try {
    document.querySelector("tbody tr td").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelector("#property-dialog").open, true);
    assert.match(document.querySelector("#property-fields").textContent, /Rua 1/);
    assert.match(document.querySelector("#property-fields").textContent, /Venda Direta Online/);
    assert.match(document.querySelector(".photo-placeholder").textContent, /Foto indisponível/);
    assert.equal(document.querySelector("#property-link a").href, properties[0][11]);
    assert.match(document.querySelector("#property-alert").textContent, /CV: 2,5%/);
    assert.match(document.querySelector("#map-status").textContent, /aproximada.*Centro, Rio/);
    assert.deepEqual(Array.from(marker), [-22.9, -43.2]);
    assert.equal(document.querySelector("#property-map").hidden, false);
    assert.deepEqual(calls, ["/api/imoveis", "/api/imoveis/1/localizacao"]);
  } finally {
    dom.window.close();
  }
});

test("detalhes informam localização ausente ou indisponível sem abrir outro diálogo para o alerta", async () => {
  const data = { dataGeracao: "data", imoveis: [row(1, "SP", "SAO PAULO", "CENTRO", "Casa", 20)], alertas: [null] };
  let failure = false;
  const { dom, document } = await openPage(data, url => url.startsWith("/api/imoveis/")
    ? failure ? { ok: false, status: 502 } : { ok: true, json: async () => ({ localizacao: null }) }
    : { ok: true, json: async () => data });
  try {
    document.querySelector("#grid-view").click();
    document.querySelector("#result-cards .detail-button").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(document.querySelector("#map-status").textContent, /não encontrada/);
    assert.equal(document.querySelector("#property-map").hidden, true);
    document.querySelector("#property-dialog").close();
    failure = true;
    document.querySelector("#ranking-cards .property-card").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(document.querySelector("#map-status").textContent, /Não foi possível/);
    assert.equal(document.querySelector("#property-map").hidden, true);
  } finally {
    dom.window.close();
  }
});
