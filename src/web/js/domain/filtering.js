import { COLUMN } from "./columns.js";
import { normalize } from "./text.js";
import { cityKey, districtKey } from "./location-options.js";

export const RANKING_SIZE = 20;

const isSet = (selected, key) => !selected.size || selected.has(key);
const atLeast = (limit, value) => limit === null || (value !== null && value >= limit);
const atMost = (limit, value) => limit === null || (value !== null && value <= limit);

export function hasValidPriceRange({ minPrice, maxPrice }) {
  return !(minPrice !== null && maxPrice !== null && minPrice > maxPrice);
}

// Aplica os critérios (combinados com "e"; seleções do mesmo filtro com "ou") e ordena por desconto.
export function filterProperties(properties, criteria) {
  const search = normalize(criteria.search);
  const district = normalize(criteria.district);
  return properties.filter(property => {
    const { row } = property;
    return (!search || property.search.includes(search)) &&
      isSet(criteria.ufs, row[COLUMN.UF]) &&
      isSet(criteria.cities, cityKey(row)) &&
      isSet(criteria.districts, districtKey(row)) &&
      (!district || normalize(row[COLUMN.DISTRICT]).includes(district)) &&
      (!criteria.type || property.type === criteria.type) &&
      (!criteria.modality || row[COLUMN.MODALITY] === criteria.modality) &&
      atLeast(criteria.minPrice, property.price) &&
      atMost(criteria.maxPrice, property.price) &&
      atLeast(criteria.minDiscount, property.discount) &&
      atLeast(criteria.minRooms, property.rooms) &&
      (!criteria.financingOnly || normalize(row[COLUMN.FINANCING]) === "SIM") &&
      (!criteria.hideAlerts || !property.alert);
  }).sort((a, b) => (b.discount ?? -Infinity) - (a.discount ?? -Infinity));
}

// Espera a lista já ordenada por desconto (resultado de filterProperties).
export function topDiscounts(sorted, limit = RANKING_SIZE) {
  return sorted.filter(property => property.discount !== null).slice(0, limit);
}
