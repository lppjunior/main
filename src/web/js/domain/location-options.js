import { COLUMN } from "./columns.js";

export const cityKey = row => JSON.stringify([row[COLUMN.UF], row[COLUMN.CITY]]);
export const districtKey = row => JSON.stringify([row[COLUMN.UF], row[COLUMN.CITY], row[COLUMN.DISTRICT]]);

// Níveis da hierarquia: 1 = UF, 2 = UF/cidade, 3 = UF/cidade/bairro.
// "legacy" guarda o nome simples usado por filtros salvos em versões anteriores.
export function buildLocationOptions(rows, depth) {
  const options = new Map();
  for (const row of rows) {
    const parts = row.slice(COLUMN.UF, COLUMN.UF + depth);
    if (parts.some(part => !part)) continue;
    const value = depth === 1 ? parts[0] : JSON.stringify(parts);
    options.set(value, { value, label: parts.join(" - "), legacy: parts.at(-1) });
  }
  return [...options.values()];
}
