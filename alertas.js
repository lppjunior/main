const { parse } = require("csv-parse/sync");

const SOURCE_URL = "https://raw.githubusercontent.com/olucasandre/mapa-faccoes-rio-bairros/" +
  "669cc8a349f41cfe90a67bf481bfd61054e6739f/dados/processados/faccoes_bairro_2010_2022.csv";
const GROUPS = ["ADA", "CV", "Milicia", "TCP"];
const FIELDS = ["ano", "codigo_bairro_2010", "bairro", "faccao", "percentual_area_bairro"];

function normalize(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().trim().replace(/\s+/g, " ");
}

function parseAlertData(data) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  const rows = parse(text, { bom: true, relax_column_count: false });
  const header = rows.shift();
  if (!header || !FIELDS.every(field => header.includes(field))) {
    throw new Error("Formato da base histórica não reconhecido");
  }
  const indexes = Object.fromEntries(FIELDS.map(field => [field, header.indexOf(field)]));
  const districts = new Map();
  const seen = new Set();
  for (const row of rows) {
    if (row[indexes.ano] !== "2022") continue;
    const name = row[indexes.bairro].trim();
    const code = row[indexes.codigo_bairro_2010].trim();
    const group = row[indexes.faccao].trim();
    const percentage = row[indexes.percentual_area_bairro].trim();
    const key = normalize(name);
    if (!key || !code || !GROUPS.includes(group)) throw new Error("Registro inválido na base histórica");
    const numericPercentage = Number(percentage);
    if (!percentage || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(percentage) ||
        !Number.isFinite(numericPercentage) || numericPercentage < 0 || numericPercentage > 100) {
      throw new Error("Percentual inválido na base histórica");
    }
    let district = districts.get(key);
    if (!district) {
      district = { nome: name, codigo: code, grupos: [] };
      districts.set(key, district);
    }
    const groupKey = `${key}\0${group}`;
    if (district.codigo !== code || seen.has(groupKey)) {
      throw new Error("Bairro ou grupo duplicado na base histórica");
    }
    seen.add(groupKey);
    if (numericPercentage > 0) {
      district.grupos.push({
        grupo: group,
        percentual: /e/i.test(percentage) ? numericPercentage.toString() : percentage,
      });
    }
  }
  if (!districts.size || [...districts.keys()].some(key => GROUPS.some(group => !seen.has(`${key}\0${group}`)))) {
    throw new Error("Base histórica de 2022 incompleta");
  }
  return districts;
}

async function fetchAlertData() {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Consulta à base histórica falhou: HTTP ${response.status}`);
  return parseAlertData(new Uint8Array(await response.arrayBuffer()));
}

function findAlert(property, districts) {
  if (property[1].trim().toUpperCase() !== "RJ" || normalize(property[2]) !== "RIO DE JANEIRO") return null;
  const district = districts.get(normalize(property[3]));
  return district && district.grupos.length ? district : null;
}

module.exports = { SOURCE_URL, GROUPS, normalize, parseAlertData, fetchAlertData, findAlert };
