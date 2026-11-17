const test = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const { mkdtemp, readFile, writeFile, rm, rmdir } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const caixa = require("../caixa");
const alertas = require("../alertas");
const { generate } = require("../gerar-alertas");
const { createServer } = require("../server");

function caixaCsv(rows) {
  return Buffer.from(stringify(rows, { delimiter: ";" }), "latin1");
}

function historicCsv(percentages) {
  const rows = [["ano", "codigo_bairro_2010", "bairro", "faccao", "percentual_area_bairro"]];
  for (const [group, percentage] of Object.entries(percentages)) {
    rows.push(["2022", "123", "São Cristóvão", group, percentage]);
  }
  return Buffer.from(stringify(rows));
}

function property(uf = "RJ", city = "RIO DE JANEIRO", district = "SAO CRISTOVAO") {
  return ["123", uf, city, district, "Rua A", "1", "2", "50", "Sim", "Casa", "Venda", "link"];
}

const percentages = { ADA: "0", CV: "1e-06", Milicia: "25.2", TCP: "0" };

test("lê metadados, Windows-1252 e valores CSV entre aspas", () => {
  const row = [" 123 ", "SP", "São Paulo", "Centro", "Rua A; 10", "10.000,00",
    "20.000,00", "50.00", "Sim", "Casa\ncom terreno", "Venda", "https://example.com"];
  const data = caixaCsv([[], ["Lista", "", "Data de geração:", "13/11/2026"], caixa.COLUMNS, [], row]);
  const result = caixa.parseCsv(data);
  assert.equal(result.dataGeracao, "13/11/2026");
  assert.equal(result.imoveis[0][0], "123");
  assert.equal(result.imoveis[0][2], "São Paulo");
  assert.equal(result.imoveis[0][4], "Rua A; 10");
  assert.equal(result.imoveis[0][9], "Casa\ncom terreno");
});

test("rejeita CSV da Caixa incompleto ou com estrutura inválida", () => {
  for (const rows of [[["Lista"]], [["Lista", "", "", "data"], ["outra coluna"]],
    [["Lista", "", "", "data"], caixa.COLUMNS, ["123"]]]) {
    assert.throws(() => caixa.parseCsv(caixaCsv(rows)));
  }
});

test("usa o CSV local existente sem consultar a Caixa", async t => {
  const data = caixaCsv([["Lista", "", "", "data"], caixa.COLUMNS]);
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-local-"));
  const file = path.join(directory, "Lista_imoveis_geral.csv");
  const target = path.join(directory, "lista_imoveis_geral.csv");
  t.mock.method(globalThis, "fetch", () => { throw new Error("Não deve acessar a rede"); });
  try {
    await writeFile(file, data);
    assert.equal((await caixa.loadProperties(target)).dataGeracao, "data");
    assert.deepEqual(await readFile(file), data);
    await writeFile(file, caixaCsv([["Lista", "", "", "nova data"], caixa.COLUMNS]));
    assert.equal((await caixa.loadProperties(target)).dataGeracao, "nova data");
    assert.equal(globalThis.fetch.mock.calls.length, 0);
  } finally {
    await rm(file, { force: true });
    await rmdir(directory);
  }
});

test("baixa uma vez quando ausente, inclusive para consultas simultâneas", async t => {
  const data = caixaCsv([["Lista", "", "", "data"], caixa.COLUMNS]);
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-download-"));
  const file = path.join(directory, "lista_imoveis_geral.csv");
  t.mock.method(globalThis, "fetch", async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return new Response(data);
  });
  try {
    const results = await Promise.all(Array.from({ length: 4 }, () => caixa.loadProperties(file)));
    assert.ok(results.every(result => result.dataGeracao === "data"));
    assert.equal(globalThis.fetch.mock.calls.length, 1);
    assert.match(globalThis.fetch.mock.calls[0].arguments[0], new RegExp(`^${caixa.SOURCE_URL.replaceAll(".", "\\.")}\\?\\d+$`));
    assert.deepEqual(await readFile(file), data);
    await caixa.loadProperties(file);
    assert.equal(globalThis.fetch.mock.calls.length, 1);
  } finally {
    await rm(file, { force: true });
    await rmdir(directory);
  }
});

test("preserva o arquivo local criado durante o download", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-concorrente-"));
  const file = path.join(directory, "lista_imoveis_geral.csv");
  const local = caixaCsv([["Lista", "", "", "local"], caixa.COLUMNS]);
  const downloaded = caixaCsv([["Lista", "", "", "remoto"], caixa.COLUMNS]);
  t.mock.method(globalThis, "fetch", async () => {
    await writeFile(file, local);
    return new Response(downloaded);
  });
  try {
    assert.equal((await caixa.loadProperties(file)).dataGeracao, "local");
    assert.deepEqual(await readFile(file), local);
  } finally {
    await rm(file, { force: true });
    await rmdir(directory);
  }
});

test("não salva download inválido e permite nova tentativa", async t => {
  const data = caixaCsv([["Lista", "", "", "data"], caixa.COLUMNS]);
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-invalido-"));
  const file = path.join(directory, "lista_imoveis_geral.csv");
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(++requests === 1 ? "<html>erro</html>" : data));
  try {
    await assert.rejects(caixa.loadProperties(file));
    await assert.rejects(readFile(file), { code: "ENOENT" });
    assert.equal((await caixa.loadProperties(file)).dataGeracao, "data");
    assert.equal(requests, 2);
  } finally {
    await rm(file, { force: true });
    await rmdir(directory);
  }
});

test("CSV local inválido não é substituído nem provoca download", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-invalido-local-"));
  const file = path.join(directory, "lista_imoveis_geral.csv");
  t.mock.method(globalThis, "fetch", () => { throw new Error("Não deve acessar a rede"); });
  try {
    await writeFile(file, "inválido");
    await assert.rejects(caixa.loadProperties(file));
    assert.equal(await readFile(file, "utf8"), "inválido");
    assert.equal(globalThis.fetch.mock.calls.length, 0);
  } finally {
    await rm(file, { force: true });
    await rmdir(directory);
  }
});

test("sincronização local não baixa CSV ausente", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-sincronizacao-"));
  const file = path.join(directory, "lista_imoveis_geral.csv");
  t.mock.method(globalThis, "fetch", () => { throw new Error("Não deve acessar a rede"); });
  try {
    await assert.rejects(caixa.loadProperties(file, { downloadIfMissing: false }), /CSV local não encontrado/);
    assert.equal(globalThis.fetch.mock.calls.length, 0);
  } finally {
    await rmdir(directory);
  }
});

test("cruza apenas bairro correspondente da cidade do Rio", () => {
  const districts = alertas.parseAlertData(historicCsv(percentages));
  const match = alertas.findAlert(property("RJ", "RIO DE JANEIRO", " São  Cristóvão "), districts);
  assert.equal(match.nome, "São Cristóvão");
  assert.deepEqual(match.grupos, [
    { grupo: "CV", percentual: "0.000001" }, { grupo: "Milicia", percentual: "25.2" },
  ]);
  for (const row of [property("SP"), property("RJ", "NITEROI"), property("RJ", "RIO DE JANEIRO", "SAO CRISTOVAO II")]) {
    assert.equal(alertas.findAlert(row, districts), null);
  }
  const zero = alertas.parseAlertData(historicCsv({ ADA: "0", CV: "0", Milicia: "0", TCP: "0" }));
  assert.equal(alertas.findAlert(property(), zero), null);
});

test("rejeita base histórica incompleta ou percentuais inválidos", () => {
  for (const values of [{ ADA: "0" }, { ...percentages, ADA: "NaN" }, { ...percentages, ADA: "101" },
    { ...percentages, ADA: "" }]) {
    assert.throws(() => alertas.parseAlertData(historicCsv(values)));
  }
});

test("CSV contém somente correspondências, aviso e proteção contra fórmulas", async () => {
  const districts = alertas.parseAlertData(historicCsv(percentages));
  const match = property();
  match[4] = "=formula";
  const properties = { dataGeracao: "13/11/2026", imoveis: [match, property("RJ", "NITEROI")] };
  const directory = await mkdtemp(path.join(os.tmpdir(), "imoveis-caixa-"));
  const output = path.join(directory, "alertas.csv");
  try {
    assert.equal(await generate(properties, districts, output), 1);
    const text = await readFile(output, "utf8");
    const rows = parse(text, { bom: true, columns: true, delimiter: ";" });
    assert.equal(rows[0].endereco, "'=formula");
    assert.match(rows[0].aviso, /endereço e situação atual não verificados/);
    assert.equal(rows[0].data_lista_caixa, "13/11/2026");
  } finally {
    await rm(output, { force: true });
    await rmdir(directory);
  }
});

test("API mantém imóveis e informa indisponibilidade da base de alertas", async t => {
  const properties = { dataGeracao: "data", imoveis: [property()] };
  const server = createServer({
    loadProperties: async () => properties,
    fetchAlertData: async () => { throw new Error("indisponível"); },
  });
  t.mock.method(console, "error", () => {});
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/imoveis`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.imoveis, [property()]);
    assert.equal(data.alertas, null);
    assert.equal(console.error.mock.calls.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("servidor disponibiliza página e API com alertas correspondentes", async () => {
  const properties = { dataGeracao: "data", imoveis: [property(), property("SP")] };
  const districts = alertas.parseAlertData(historicCsv(percentages));
  const server = createServer({
    loadProperties: async () => properties,
    fetchAlertData: async () => districts,
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Imóveis Caixa/);
    const response = await fetch(`${url}/api/imoveis`);
    const data = await response.json();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(data.alertas[0].nome, "São Cristóvão");
    assert.equal(data.alertas[1], null);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("API solicita leitura exclusivamente local na sincronização", async () => {
  let options;
  const server = createServer({
    loadProperties: async (_, settings) => {
      options = settings;
      return { dataGeracao: "data", imoveis: [] };
    },
    fetchAlertData: async () => new Map(),
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/imoveis?local=1`);
    assert.equal(response.status, 200);
    assert.equal(options.downloadIfMissing, false);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("API sinaliza falha ao buscar imóveis", async t => {
  const server = createServer({ loadProperties: async () => { throw new Error("indisponível"); } });
  t.mock.method(console, "error", () => {});
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/imoveis`);
    assert.equal(response.status, 502);
    assert.match((await response.json()).erro, /Não foi possível carregar/);
    assert.equal(console.error.mock.calls.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
