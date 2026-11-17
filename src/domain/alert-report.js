const { findAlert } = require("./alert-matcher");

const REPORT_HEADER = [
  "numero_imovel", "uf", "cidade", "bairro_caixa", "endereco",
  "bairro_censo_2010", "grupos_e_percentual_bairro_2022",
  "aviso", "data_lista_caixa", "fonte",
];
const REPORT_NOTICE = "Parte do bairro mapeada em 2022; endereço e situação atual não verificados";

// Evita que planilhas interpretem textos iniciados por operadores como fórmulas.
function spreadsheetSafe(value) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function buildAlertReport({ imoveis, dataGeracao }, districts, sourceUrl) {
  const rows = [REPORT_HEADER];
  for (const property of imoveis) {
    const alert = findAlert(property, districts);
    if (!alert) continue;
    const groups = alert.grupos.map(group => `${group.grupo}: ${group.percentual}%`).join(" | ");
    const values = [...property.slice(0, 5), alert.nome, groups, REPORT_NOTICE, dataGeracao, sourceUrl];
    rows.push(values.map(spreadsheetSafe));
  }
  return rows;
}

module.exports = { buildAlertReport };
