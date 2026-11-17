import { COLUMN } from "./columns.js";
import { normalize, parseBrazilianNumber } from "./text.js";

const CAIXA_HOST = "venda-imoveis.caixa.gov.br";
const AREA_KINDS = ["privativa", "total", "do terreno"];

function extractArea(description) {
  const areas = [...description.matchAll(/([\d.,]+)\s+de área (privativa|total|do terreno)/gi)];
  for (const kind of AREA_KINDS) {
    const match = areas.find(item => normalize(item[2]) === normalize(kind));
    const value = match ? Number(match[1].replace(",", ".")) : null;
    if (value > 0) return value;
  }
  return null;
}

function parseDiscount(value) {
  const number = Number(value.replace(",", "."));
  return value !== "" && Number.isFinite(number) ? number : null;
}

// Enriquece a linha do CSV com os campos derivados usados na interface.
export function createProperty(row, alert) {
  const description = row[COLUMN.DESCRIPTION];
  const rooms = description.match(/(\d+)\s+(?:qto|quarto)(?:\(s\)|s)?/i);
  return {
    row,
    alert,
    type: description.split(",")[0].trim(),
    area: extractArea(description),
    rooms: rooms ? Number(rooms[1]) : null,
    price: parseBrazilianNumber(row[COLUMN.PRICE]),
    discount: parseDiscount(row[COLUMN.DISCOUNT]),
    search: normalize([row[COLUMN.ID], row[COLUMN.CITY], row[COLUMN.DISTRICT], row[COLUMN.ADDRESS], description].join(" ")),
  };
}

export function alertText({ alert }) {
  const groups = alert.grupos.map(group => `${group.grupo}: ${group.percentual.replace(".", ",")}%`).join("; ");
  return `No bairro ${alert.nome}, parte da área foi mapeada como controlada por grupos armados em 2022 (${groups} da área total do bairro). O alerta não confirma risco no endereço nem a situação atual.`;
}

// Só aceita links HTTPS do domínio oficial da Caixa.
export function caixaUrl({ row }) {
  try {
    const url = new URL(row[COLUMN.LINK]);
    return url.protocol === "https:" && url.hostname === CAIXA_HOST ? url.href : null;
  } catch {
    return null;
  }
}

export function googleMapsUrl({ row }) {
  const address = row[COLUMN.ADDRESS].trim();
  const city = row[COLUMN.CITY].trim();
  const uf = row[COLUMN.UF].trim();
  if (!address || !city || !uf) return null;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", [address, row[COLUMN.DISTRICT], city, uf, "Brasil"].filter(Boolean).join(", "));
  return url.href;
}
