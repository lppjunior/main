const { parse } = require("csv-parse/sync");
const { open, readFile, link, unlink } = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const SOURCE_URL = "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv";
const LOCAL_FILE = path.join(__dirname, "lista_imoveis_geral.csv");
const COLUMNS = [
  "N° do imóvel", "UF", "Cidade", "Bairro", "Endereço", "Preço",
  "Valor de avaliação", "Desconto", "Financiamento", "Descrição",
  "Modalidade de venda", "Link de acesso",
];

function parseCsv(data) {
  const text = new TextDecoder("windows-1252", { fatal: true }).decode(data);
  const rows = parse(text, {
    delimiter: ";",
    relax_column_count: true,
    relax_quotes: true,
  }).filter(row => row.some(cell => cell.trim()));
  if (rows.length < 2) throw new Error("CSV da Caixa incompleto");
  const [metadata, rawHeader, ...dataRows] = rows;
  const header = rawHeader.map(cell => cell.trim());
  if (metadata.length < 4 || header.length !== COLUMNS.length ||
      header.some((column, index) => column !== COLUMNS[index])) {
    throw new Error("Formato do CSV da Caixa não reconhecido");
  }
  const properties = dataRows.map(row => {
    if (row.length !== COLUMNS.length) {
      throw new Error("Linha do CSV da Caixa com número inesperado de colunas");
    }
    return row.map(cell => cell.trim());
  });
  return { dataGeracao: metadata[3].trim(), imoveis: properties };
}

async function readLocal(filePath) {
  const paths = [filePath];
  if (path.basename(filePath) === "lista_imoveis_geral.csv") {
    paths.push(path.join(path.dirname(filePath), "Lista_imoveis_geral.csv"));
  }
  for (const candidate of paths) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function downloadCsv() {
  const response = await fetch(`${SOURCE_URL}?${Date.now()}`, {
    headers: { "User-Agent": "imoveis-caixa/1.0", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Consulta à Caixa falhou: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadProperties(filePath = LOCAL_FILE, { downloadIfMissing = true } = {}) {
  let data = await readLocal(filePath);
  if (data !== null) return parseCsv(data);
  if (!downloadIfMissing) throw new Error(`CSV local não encontrado: ${filePath}`);

  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + 75000;
  let lock;
  while (!lock) {
    try {
      lock = await open(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      data = await readLocal(filePath);
      if (data !== null) return parseCsv(data);
      if (Date.now() >= deadline) {
        throw new Error(`Tempo esgotado aguardando download do CSV; verifique ${lockPath}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  try {
    data = await readLocal(filePath);
    if (data !== null) return parseCsv(data);
    const downloaded = await downloadCsv();
    const properties = parseCsv(downloaded);
    data = await readLocal(filePath);
    if (data !== null) return parseCsv(data);

    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
    const temporary = await open(tempPath, "wx");
    try {
      try {
        await temporary.writeFile(downloaded);
      } finally {
        await temporary.close();
      }
      try {
        await link(tempPath, filePath);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        return parseCsv(await readFile(filePath));
      }
    } finally {
      await unlink(tempPath);
    }
    return properties;
  } finally {
    try {
      await lock.close();
    } finally {
      await unlink(lockPath);
    }
  }
}

module.exports = { SOURCE_URL, LOCAL_FILE, COLUMNS, parseCsv, loadProperties };
