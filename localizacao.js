function createLocator({ fetchImpl = fetch, endpoint = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search" } = {}) {
  const cache = new Map();
  const pending = new Map();
  let queue = Promise.resolve();
  let nextRequest = 0;

  return function locate(row) {
    const key = JSON.stringify(row.slice(1, 5));
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);

    const task = queue.then(async () => {
      const delay = Math.max(0, nextRequest - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const parts = row[4].split(",");
      const number = parts.map(part => part.match(/^\s*N\.\s*(\d+[A-Z]?)/i)).find(Boolean);
      const street = [number?.[1], parts[0].trim()].filter(Boolean).join(" ");
      const url = new URL(endpoint);
      url.searchParams.set("street", street);
      url.searchParams.set("city", row[2]);
      url.searchParams.set("state", row[1]);
      url.searchParams.set("country", "Brasil");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "br");
      nextRequest = Date.now() + 1100;
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "imoveis-caixa-local/1.0 (consulta individual de imoveis)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Geocodificador retornou HTTP ${response.status}`);
      const results = await response.json();
      if (!Array.isArray(results)) throw new Error("Resposta inválida do geocodificador");
      let location = null;
      if (results.length) {
        const result = results[0];
        const lat = Number(result.lat);
        const lon = Number(result.lon);
        if (!result.lat || !result.lon || !Number.isFinite(lat) || !Number.isFinite(lon) ||
            lat < -90 || lat > 90 || lon < -180 || lon > 180 || typeof result.display_name !== "string") {
          throw new Error("Coordenadas inválidas do geocodificador");
        }
        location = { lat, lon, endereco: result.display_name };
      }
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
