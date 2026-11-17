const { NOMINATIM_URL } = require("../config");
const { COLUMN } = require("../domain/columns");

const MIN_INTERVAL_MS = 1100;
const USER_AGENT = "imoveis-caixa-local/1.0 (consulta individual de imoveis)";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function streetOf(address) {
  const parts = address.split(",");
  const number = parts.map(part => part.match(/^\s*N\.\s*(\d+[A-Z]?)/i)).find(Boolean);
  return [number?.[1], parts[0].trim()].filter(Boolean).join(" ");
}

function buildSearchUrl(endpoint, row) {
  const url = new URL(endpoint);
  url.searchParams.set("street", streetOf(row[COLUMN.ADDRESS]));
  url.searchParams.set("city", row[COLUMN.CITY]);
  url.searchParams.set("state", row[COLUMN.UF]);
  url.searchParams.set("country", "Brasil");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  return url;
}

function toLocation(result) {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!result.lat || !result.lon || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180 || typeof result.display_name !== "string") {
    throw new Error("Coordenadas inválidas do geocodificador");
  }
  return { lat, lon, endereco: result.display_name };
}

// Consulta serializada, com intervalo mínimo e cache, conforme a política de uso do Nominatim.
function createLocator({ fetchImpl = fetch, endpoint = NOMINATIM_URL } = {}) {
  const cache = new Map();
  const pending = new Map();
  let queue = Promise.resolve();
  let nextRequest = 0;

  async function search(row) {
    const delay = Math.max(0, nextRequest - Date.now());
    if (delay) await sleep(delay);
    nextRequest = Date.now() + MIN_INTERVAL_MS;
    const response = await fetchImpl(buildSearchUrl(endpoint, row), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Geocodificador retornou HTTP ${response.status}`);
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error("Resposta inválida do geocodificador");
    return results.length ? toLocation(results[0]) : null;
  }

  return function locate(row) {
    const key = JSON.stringify(row.slice(COLUMN.UF, COLUMN.ADDRESS + 1));
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);

    const task = queue.then(async () => {
      const location = await search(row);
      cache.set(key, location);
      return location;
    });
    pending.set(key, task);
    queue = task.then(() => undefined, () => undefined);
    task.then(() => pending.delete(key), () => pending.delete(key));
    return task;
  };
}

module.exports = { createLocator };
