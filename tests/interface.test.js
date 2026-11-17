const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { build } = require("esbuild");

const WEB_ROOT = path.join(__dirname, "..", "src", "web");

// jsdom não executa módulos ES; o código do navegador é empacotado em um único script.
async function bundleApp() {
  const result = await build({
    entryPoints: [path.join(WEB_ROOT, "js", "main.js")],
    bundle: true, format: "iife", write: false, logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

function row(id, uf, city, district, description, discount, financing = "Sim") {
  return [String(id), uf, city, district, `Rua ${id}`, "100.000,00", "200.000,00", String(discount),
    financing, description, "Venda Direta Online", "https://venda-imoveis.caixa.gov.br/imovel"];
}

async function openPage(data, responseForUrl = () => ({ ok: true, json: async () => data })) {
  const html = await readFile(path.join(WEB_ROOT, "index.html"), "utf8");
  const script = await bundleApp();
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

function rowIds(document) {
  return [...document.querySelectorAll("tbody tr td:nth-child(2) button")]
    .map(link => link.getAttribute("aria-label").match(/imóvel (\S+)/)[1]);
}

function change(dom, control, value) {
  if (control.type === "checkbox") control.checked = value;
  else control.value = value;
  const type = control.tagName === "SELECT" || control.type === "checkbox" ? "change" : "input";
  control.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

function toggleLocation(document, filter, value) {
  const search = document.querySelector(`#${filter}-filter input[type="search"]`);
  const checkbox = [...document.querySelectorAll(`#${filter}-filter .location-option`)]
    .find(label => label.textContent === value)?.querySelector("input");
  assert.ok(checkbox, `Opção ${value} não encontrada em ${filter}; busca: ${search.value}`);
  checkbox.click();
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

test("ranking mostra três imóveis e permite expandir até vinte e recolher", async () => {
  const properties = Array.from({ length: 22 }, (_, index) =>
    row(index + 1, "RJ", "RIO", "CENTRO", "Casa", 100 - index));
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: properties.map(() => null) });
  try {
    const cards = () => document.querySelectorAll("#ranking-cards .property-card");
    const toggle = document.querySelector("#ranking-toggle");
    assert.equal(cards().length, 3);
    assert.equal(toggle.hidden, false);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.match(toggle.textContent, /20/);
    toggle.click();
    assert.equal(cards().length, 20);
    assert.equal(cards()[19].querySelector(".rank-badge").textContent, "#20");
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    const minDiscount = document.querySelector('[name="minDiscount"]');
    change(dom, minDiscount, "99");
    assert.equal(cards().length, 2);
    assert.equal(toggle.hidden, true);
    change(dom, minDiscount, "");
    assert.equal(cards().length, 20);
    toggle.click();
    assert.equal(cards().length, 3);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    change(dom, minDiscount, "100");
    assert.equal(cards().length, 1);
    assert.equal(toggle.hidden, true);
    change(dom, document.querySelector('[name="search"]'), "não existe");
    assert.equal(cards().length, 0);
    assert.equal(toggle.hidden, true);
    assert.equal(document.querySelector("#ranking-empty").hidden, false);
  } finally {
    dom.window.close();
  }
});

test("ações no início da tabela abrem a Caixa, pesquisam o endereço e exibem o popup", async () => {
  const property = row(42, "RJ", "PETROPOLIS", "CENTRO", "Casa", 30);
  property[4] = "Rua São José, N. 10";
  property[11] = "https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=42";
  const data = { dataGeracao: "data", imoveis: [property], alertas: [null] };
  const { dom, document, calls } = await openPage(data, url => url.startsWith("/api/imoveis/")
    ? { ok: true, json: async () => ({ localizacao: null }) }
    : { ok: true, json: async () => data });
  try {
    const header = [...document.querySelectorAll("thead th")].map(cell => cell.textContent);
    assert.deepEqual(header.slice(0, 2), ["Modalidade", "Ações"]);
    assert.ok(!header.includes("Nº"));
    assert.ok(!header.includes("Detalhes"));
    const actions = document.querySelectorAll("tbody tr td:nth-child(2) .icon-action");
    assert.equal(actions.length, 3);
    assert.ok([...actions].every(action => action.querySelector("svg") && action.getAttribute("aria-label")));
    assert.equal(actions[0].href, property[11]);
    assert.equal(actions[0].target, "_blank");
    const map = new URL(actions[1].href);
    assert.equal(map.origin + map.pathname, "https://www.google.com/maps/search/");
    assert.equal(map.searchParams.get("api"), "1");
    assert.equal(map.searchParams.get("query"), "Rua São José, N. 10, CENTRO, PETROPOLIS, RJ, Brasil");
    assert.equal(actions[1].target, "_blank");
    for (const link of [actions[0], actions[1]]) {
      link.addEventListener("click", event => event.preventDefault());
      link.querySelector("path").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      assert.equal(document.querySelector("#property-dialog").open, false);
    }
    actions[2].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelector("#property-dialog").open, true);
    assert.match(document.querySelector("#property-title").textContent, /42/);
    assert.deepEqual(calls, ["/api/imoveis", "/api/imoveis/42/localizacao"]);
  } finally {
    dom.window.close();
  }
});

test("ações indisponíveis não abrem links ou popup", async () => {
  const property = row(1, "RJ", "RIO", "CENTRO", "Casa", 20);
  property[4] = "";
  property[11] = "https://example.com/imovel";
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: [property], alertas: [null] });
  try {
    const actions = document.querySelectorAll("tbody .icon-action");
    for (const action of [actions[0], actions[1]]) {
      assert.equal(action.tagName, "SPAN");
      assert.equal(action.getAttribute("aria-disabled"), "true");
      assert.match(action.title, /indisponível/);
      action.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(document.querySelector("#property-dialog").open, false);
    }
  } finally {
    dom.window.close();
  }
});

test("cartões e popup exibem ações do imóvel selecionado", async () => {
  const first = row(1, "RJ", "RIO", "CENTRO", "Casa", 30);
  const second = row(2, "SP", "SAO PAULO", "JARDIM", "Casa", 20);
  first[11] = "https://venda-imoveis.caixa.gov.br/imovel?id=1";
  second[11] = "https://venda-imoveis.caixa.gov.br/imovel?id=2";
  const data = { dataGeracao: "data", imoveis: [first, second], alertas: [null, null] };
  const { dom, document } = await openPage(data, url => url.startsWith("/api/imoveis/")
    ? { ok: true, json: async () => ({ localizacao: null }) }
    : { ok: true, json: async () => data });
  try {
    const rankingActions = document.querySelectorAll("#ranking-cards .property-card:first-child .icon-action");
    assert.equal(rankingActions.length, 3);
    assert.equal(rankingActions[0].href, first[11]);
    assert.match(new URL(rankingActions[1].href).searchParams.get("query"), /Rua 1.*RIO, RJ/);
    rankingActions[1].addEventListener("click", event => event.preventDefault());
    rankingActions[1].querySelector("path").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(document.querySelector("#property-dialog").open, false);
    rankingActions[2].click();
    await new Promise(resolve => setImmediate(resolve));
    let popupActions = document.querySelectorAll("#property-dialog-actions .icon-action");
    assert.equal(popupActions.length, 2);
    assert.equal(popupActions[0].href, first[11]);
    assert.match(new URL(popupActions[1].href).searchParams.get("query"), /Rua 1.*RIO, RJ/);
    document.querySelector("#property-dialog").close();
    document.querySelector("#grid-view").click();
    const cardActions = document.querySelectorAll("#result-cards .property-card:nth-child(2) .icon-action");
    assert.equal(cardActions.length, 3);
    assert.equal(cardActions[0].href, second[11]);
    cardActions[2].click();
    await new Promise(resolve => setImmediate(resolve));
    popupActions = document.querySelectorAll("#property-dialog-actions .icon-action");
    assert.equal(popupActions[0].href, second[11]);
    assert.match(new URL(popupActions[1].href).searchParams.get("query"), /Rua 2.*SAO PAULO, SP/);
    assert.match(document.querySelector("#property-title").textContent, /imóvel 2/i);
  } finally {
    dom.window.close();
  }
});

test("cartões e popup sinalizam links indisponíveis sem abrir outro popup", async () => {
  const property = row(1, "RJ", "RIO", "CENTRO", "Casa", 20);
  property[4] = "";
  property[11] = "https://example.com/imovel";
  const data = { dataGeracao: "data", imoveis: [property], alertas: [null] };
  const { dom, document } = await openPage(data, url => url.startsWith("/api/imoveis/")
    ? { ok: true, json: async () => ({ localizacao: null }) }
    : { ok: true, json: async () => data });
  try {
    const actions = document.querySelectorAll("#ranking-cards .icon-action");
    for (const action of [actions[0], actions[1]]) {
      assert.equal(action.getAttribute("aria-disabled"), "true");
      action.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(document.querySelector("#property-dialog").open, false);
    }
    actions[2].click();
    await new Promise(resolve => setImmediate(resolve));
    const popupActions = document.querySelectorAll("#property-dialog-actions .icon-action");
    assert.equal(popupActions.length, 2);
    assert.ok([...popupActions].every(action => action.getAttribute("aria-disabled") === "true"));
  } finally {
    dom.window.close();
  }
});

test("clique fora fecha os diálogos, mas clique no conteúdo os mantém abertos", async () => {
  const property = row(1, "RJ", "RIO", "CENTRO", "Casa", 20);
  const data = { dataGeracao: "data", imoveis: [property],
    alertas: [{ nome: "Centro", grupos: [{ grupo: "CV", percentual: "2.5" }] }] };
  const { dom, document } = await openPage(data, url => url.startsWith("/api/imoveis/")
    ? { ok: true, json: async () => ({ localizacao: null }) }
    : { ok: true, json: async () => data });
  try {
    const propertyDialog = document.querySelector("#property-dialog");
    const alertDialog = document.querySelector("#alert-dialog");
    for (const dialog of [propertyDialog, alertDialog]) {
      dialog.getBoundingClientRect = () => ({ left: 20, right: 200, top: 20, bottom: 200 });
    }
    document.querySelector("#ranking-cards .detail-button").click();
    await new Promise(resolve => setImmediate(resolve));
    propertyDialog.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, clientX: 50, clientY: 50 }));
    assert.equal(propertyDialog.open, true);
    propertyDialog.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    assert.equal(propertyDialog.open, false);
    document.querySelector("tbody .alert-button").click();
    alertDialog.querySelector("h2").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    assert.equal(alertDialog.open, true);
    alertDialog.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, clientX: 250, clientY: 50 }));
    assert.equal(alertDialog.open, false);
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
    toggleLocation(document, "uf", "RJ");
    assert.equal(document.querySelectorAll("tbody tr").length, 2);
    toggleLocation(document, "city", "RJ - RIO DE JANEIRO");
    change(dom, fields.minRooms, "3");
    assert.equal(rowIds(document)[0], "1");
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
    assert.equal(document.querySelector("#city-summary").textContent, "RJ - RIO DE JANEIRO");
    document.querySelector("#grid-view").click();
    assert.equal(document.querySelectorAll("#result-cards .property-card").length, 1);
    assert.equal(document.querySelector("#grid-view").getAttribute("aria-pressed"), "true");
    assert.ok(document.querySelector("#result-cards .property-card").classList.contains("has-alert"));
  } finally {
    dom.window.close();
  }
});

test("seleção múltipla combina valores e atualiza cidades e bairros disponíveis", async () => {
  const properties = [
    row(1, "RJ", "RIO DE JANEIRO", "CENTRO", "Casa", 40),
    row(2, "RJ", "NITEROI", "ICARAI", "Casa", 30),
    row(3, "SP", "SAO PAULO", "CENTRO", "Casa", 20),
    row(4, "SP", "SANTOS", "GONZAGA", "Casa", 10),
    row(5, "MG", "BELO HORIZONTE", "CENTRO", "Casa", 5),
  ];
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: properties.map(() => null) });
  try {
    toggleLocation(document, "uf", "RJ");
    toggleLocation(document, "uf", "SP");
    toggleLocation(document, "city", "RJ - RIO DE JANEIRO");
    toggleLocation(document, "city", "SP - SAO PAULO");
    toggleLocation(document, "district", "RJ - RIO DE JANEIRO - CENTRO");
    toggleLocation(document, "district", "SP - SAO PAULO - CENTRO");
    assert.deepEqual(rowIds(document), ["1", "3"]);
    assert.equal(document.querySelector("#uf-summary").textContent, "2 selecionados");
    assert.equal(document.querySelector("#city-summary").textContent, "2 selecionados");
    toggleLocation(document, "uf", "RJ");
    assert.equal(document.querySelector("#city-summary").textContent, "SP - SAO PAULO");
    assert.deepEqual(rowIds(document), ["3"]);
    document.querySelector("#clear-filters").click();
    assert.equal(document.querySelectorAll("tbody tr").length, 5);
    assert.equal(document.querySelector("#district-summary").textContent, "Todos");
  } finally {
    dom.window.close();
  }
});

test("busca e seleção de vários bairros persistem em filtros salvos", async () => {
  const properties = [
    row(1, "RJ", "RIO", "CENTRO", "Casa", 30),
    row(2, "RJ", "RIO", "COPACABANA", "Casa", 20),
    row(3, "RJ", "RIO", "TIJUCA", "Casa", 10),
  ];
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: [null, null, null] });
  try {
    toggleLocation(document, "uf", "RJ");
    toggleLocation(document, "city", "RJ - RIO");
    const search = document.querySelector('#district-filter input[type="search"]');
    change(dom, search, "copa");
    toggleLocation(document, "district", "RJ - RIO - COPACABANA");
    change(dom, search, "centro");
    toggleLocation(document, "district", "RJ - RIO - CENTRO");
    assert.equal(document.querySelectorAll("tbody tr").length, 2);
    document.querySelector("#filter-name").value = "Vários bairros";
    document.querySelector("#save-filter").click();
    const saved = JSON.parse(dom.window.localStorage.getItem("imoveis-caixa-filtros"))["Vários bairros"];
    assert.deepEqual(saved.districts, [JSON.stringify(["RJ", "RIO", "COPACABANA"]), JSON.stringify(["RJ", "RIO", "CENTRO"])]);
    document.querySelector("#clear-filters").click();
    change(dom, document.querySelector("#saved-filters"), "Vários bairros");
    assert.deepEqual(rowIds(document), ["1", "2"]);
    assert.equal(document.querySelector("#district-summary").textContent, "2 selecionados");
    document.querySelector("#district-filter .location-clear").click();
    assert.equal(document.querySelectorAll("tbody tr").length, 3);
  } finally {
    dom.window.close();
  }
});

test("cidades e bairros homônimos são selecionados por UF e cidade", async () => {
  const properties = [
    row(1, "RJ", "BOM JESUS", "CENTRO", "Casa", 40),
    row(2, "SP", "BOM JESUS", "CENTRO", "Casa", 30),
    row(3, "RJ", "OUTRA CIDADE", "CENTRO", "Casa", 20),
  ];
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: [null, null, null] });
  try {
    toggleLocation(document, "city", "RJ - BOM JESUS");
    assert.deepEqual(rowIds(document), ["1"]);
    toggleLocation(document, "city", "SP - BOM JESUS");
    toggleLocation(document, "district", "RJ - BOM JESUS - CENTRO");
    assert.deepEqual(rowIds(document), ["1"]);
    toggleLocation(document, "district", "SP - BOM JESUS - CENTRO");
    document.querySelector("#filter-name").value = "Homônimos";
    document.querySelector("#save-filter").click();
    document.querySelector("#clear-filters").click();
    change(dom, document.querySelector("#saved-filters"), "Homônimos");
    assert.deepEqual(rowIds(document), ["1", "2"]);
    toggleLocation(document, "city", "RJ - BOM JESUS");
    assert.equal(document.querySelector("#district-summary").textContent, "SP - BOM JESUS - CENTRO");
    assert.deepEqual(rowIds(document), ["2"]);
  } finally {
    dom.window.close();
  }
});

test("filtros salvos antigos preservam UF, cidade e busca parcial por bairro", async () => {
  const properties = [
    row(1, "RJ", "RIO", "JARDIM SUL", "Casa", 30),
    row(2, "RJ", "RIO", "JARDIM NORTE", "Casa", 20),
    row(3, "SP", "SAO PAULO", "JARDIM SUL", "Casa", 10),
  ];
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: [null, null, null] });
  try {
    dom.window.localStorage.setItem("imoveis-caixa-filtros", JSON.stringify({ Antigo: { uf: "RJ", city: "RIO", district: "jardim" } }));
    document.querySelector("#filter-name").value = "novo";
    document.querySelector("#save-filter").click();
    change(dom, document.querySelector("#saved-filters"), "Antigo");
    assert.equal(document.querySelector("#uf-summary").textContent, "RJ");
    assert.equal(document.querySelector("#city-summary").textContent, "RJ - RIO");
    assert.equal(document.querySelector('[name="district"]').value, "jardim");
    assert.equal(document.querySelectorAll("tbody tr").length, 2);
  } finally {
    dom.window.close();
  }
});

test("menus de localização fecham com Escape ou clique fora", async () => {
  const properties = [row(1, "RJ", "RIO", "CENTRO", "Casa", 30)];
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: [null] });
  try {
    const filter = document.querySelector("#uf-filter");
    const search = filter.querySelector("input[type=search]");
    filter.open = true;
    search.focus();
    search.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(filter.open, false);
    assert.equal(document.activeElement, filter.querySelector("summary"));
    filter.open = true;
    document.querySelector("#results-title").click();
    assert.equal(filter.open, false);
  } finally {
    dom.window.close();
  }
});

test("busca permite encontrar bairros além das primeiras opções sem alterar a seleção", async () => {
  const properties = Array.from({ length: 105 }, (_, index) =>
    row(index + 1, "SP", "SAO PAULO", `BAIRRO ${String(index + 1).padStart(3, "0")}`, "Casa", 1));
  const { dom, document } = await openPage({ dataGeracao: "data", imoveis: properties, alertas: properties.map(() => null) });
  try {
    toggleLocation(document, "district", "SP - SAO PAULO - BAIRRO 001");
    const search = document.querySelector('#district-filter input[type="search"]');
    change(dom, search, "105");
    assert.equal(document.querySelector("#result-count").textContent, "(1 imóveis)");
    toggleLocation(document, "district", "SP - SAO PAULO - BAIRRO 105");
    assert.equal(document.querySelector("#result-count").textContent, "(2 imóveis)");
    change(dom, search, "");
    assert.equal(document.querySelector("#district-summary").textContent, "2 selecionados");
    assert.match(document.querySelector("#district-filter .location-count").textContent, /Digite para refinar/);
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
    assert.equal(rowIds(document)[0], "1");
    change(dom, fields.search, "");
    change(dom, fields.district, "jardim");
    assert.equal(document.querySelectorAll("tbody tr").length, 2);
    change(dom, fields.type, "Casa");
    change(dom, fields.modality, "Leilão");
    assert.equal(rowIds(document)[0], "3");
    document.querySelector("#clear-filters").click();
    change(dom, fields.minPrice, "120000");
    assert.equal(rowIds(document)[0], "1");
    change(dom, fields.minPrice, "");
    change(dom, fields.maxPrice, "100000");
    change(dom, fields.minDiscount, "50");
    assert.equal(rowIds(document)[0], "2");
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
    document.querySelector("tbody tr td:nth-child(3)").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelector("#property-dialog").open, true);
    assert.match(document.querySelector("#property-fields").textContent, /Rua 1/);
    assert.match(document.querySelector("#property-fields").textContent, /Venda Direta Online/);
    assert.equal(document.querySelector(".photo-placeholder"), null);
    assert.equal(document.querySelector("#property-dialog-actions a").href, properties[0][11]);
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
