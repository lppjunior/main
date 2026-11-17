const { open, readFile, link, unlink } = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { CAIXA_CSV_URL, CAIXA_CSV_FILE } = require("../config");
const { parseCsv } = require("./caixa-csv-parser");

const LEGACY_FILE_NAME = "Lista_imoveis_geral.csv";
const LOCK_TIMEOUT_MS = 75000;
const LOCK_RETRY_MS = 100;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readLocal(filePath) {
  const candidates = [filePath];
  if (path.basename(filePath).toLowerCase() === LEGACY_FILE_NAME.toLowerCase()) {
    candidates.push(path.join(path.dirname(filePath), LEGACY_FILE_NAME));
  }
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function downloadCsv() {
  const response = await fetch(`${CAIXA_CSV_URL}?${Date.now()}`, {
    headers: { "User-Agent": "imoveis-caixa/1.0", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Consulta à Caixa falhou: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Publica o arquivo de forma atômica: nunca sobrescreve um CSV que já exista.
async function publishFile(filePath, content) {
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  const temporary = await open(tempPath, "wx");
  try {
    try {
      await temporary.writeFile(content);
    } finally {
      await temporary.close();
    }
    try {
      await link(tempPath, filePath);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      return false;
    }
    return true;
  } finally {
    await unlink(tempPath);
  }
}

// Se outro processo criar o CSV enquanto aguardamos, ele é devolvido no lugar do bloqueio.
async function acquireLock(lockPath, filePath) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      return { lock: await open(lockPath, "wx") };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const data = await readLocal(filePath);
      if (data !== null) return { data };
      if (Date.now() >= deadline) {
        throw new Error(`Tempo esgotado aguardando download do CSV; verifique ${lockPath}`);
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

async function releaseLock(lock, lockPath) {
  try {
    await lock.close();
  } finally {
    await unlink(lockPath);
  }
}

async function downloadAndStore(filePath) {
  const downloaded = await downloadCsv();
  const properties = parseCsv(downloaded);
  const existing = await readLocal(filePath);
  if (existing !== null) return parseCsv(existing);
  const published = await publishFile(filePath, downloaded);
  return published ? properties : parseCsv(await readFile(filePath));
}

async function loadProperties(filePath = CAIXA_CSV_FILE, { downloadIfMissing = true } = {}) {
  const local = await readLocal(filePath);
  if (local !== null) return parseCsv(local);
  if (!downloadIfMissing) throw new Error(`CSV local não encontrado: ${filePath}`);

  const lockPath = `${filePath}.lock`;
  const { lock, data } = await acquireLock(lockPath, filePath);
  if (data) return parseCsv(data);
  try {
    const current = await readLocal(filePath);
    return current !== null ? parseCsv(current) : await downloadAndStore(filePath);
  } finally {
    await releaseLock(lock, lockPath);
  }
}

module.exports = { loadProperties };
