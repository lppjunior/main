const { parse } = require("csv-parse/sync");
const { ALERTS_SOURCE_URL } = require("../config");
const { normalize } = require("../domain/text");

const GROUPS = ["ADA", "CV", "Milicia", "TCP"];
const FIELDS = ["ano", "codigo_bairro_2010", "bairro", "faccao", "percentual_area_bairro"];
const REFERENCE_YEAR = "2022";
const PERCENTAGE_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function parsePercentage(percentage) {
  const value = Number(percentage);
  if (!percentage || !PERCENTAGE_PATTERN.test(percentage) || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Percentual inválido na base histórica");
  }
  return value;
}

function readRecord(row, indexes) {
  const record = {
    name: row[indexes.bairro].trim(),
    code: row[indexes.codigo_bairro_2010].trim(),
    group: row[indexes.faccao].trim(),
    percentage: row[indexes.percentual_area_bairro].trim(),
  };
  record.key = normalize(record.name);
  if (!record.key || !record.code || !GROUPS.includes(record.group)) throw new Error("Registro inválido na base histórica");
  record.value = parsePercentage(record.percentage);
  return record;
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
    if (row[indexes.ano] !== REFERENCE_YEAR) continue;
    const { name, code, group, percentage, key, value } = readRecord(row, indexes);
    if (!districts.has(key)) districts.set(key, { nome: name, codigo: code, grupos: [] });
    const district = districts.get(key);
    const groupKey = `${key}\0${group}`;
    if (district.codigo !== code || seen.has(groupKey)) {
      throw new Error("Bairro ou grupo duplicado na base histórica");
    }
    seen.add(groupKey);
    if (value > 0) {
      district.grupos.push({ grupo: group, percentual: /e/i.test(percentage) ? value.toString() : percentage });
    }
  }
  const incomplete = [...districts.keys()].some(key => GROUPS.some(group => !seen.has(`${key}\0${group}`)));
  if (!districts.size || incomplete) throw new Error(`Base histórica de ${REFERENCE_YEAR} incompleta`);
  return districts;
}

async function fetchAlertData() {
  const response = await fetch(ALERTS_SOURCE_URL, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Consulta à base histórica falhou: HTTP ${response.status}`);
  return parseAlertData(new Uint8Array(await response.arrayBuffer()));
}

module.exports = { parseAlertData, fetchAlertData };
