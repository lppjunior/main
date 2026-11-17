const { parse } = require("csv-parse/sync");
const { CAIXA_HEADER } = require("../domain/columns");

function decode(data) {
  return new TextDecoder("windows-1252", { fatal: true }).decode(data);
}

function assertHeader(metadata, rawHeader) {
  const header = rawHeader.map(cell => cell.trim());
  if (metadata.length < 4 || header.length !== CAIXA_HEADER.length ||
      header.some((column, index) => column !== CAIXA_HEADER[index])) {
    throw new Error("Formato do CSV da Caixa não reconhecido");
  }
}

function parseCsv(data) {
  const rows = parse(decode(data), {
    delimiter: ";",
    relax_column_count: true,
    relax_quotes: true,
  }).filter(row => row.some(cell => cell.trim()));
  if (rows.length < 2) throw new Error("CSV da Caixa incompleto");
  const [metadata, rawHeader, ...dataRows] = rows;
  assertHeader(metadata, rawHeader);
  const imoveis = dataRows.map(row => {
    if (row.length !== CAIXA_HEADER.length) {
      throw new Error("Linha do CSV da Caixa com número inesperado de colunas");
    }
    return row.map(cell => cell.trim());
  });
  return { dataGeracao: metadata[3].trim(), imoveis };
}

module.exports = { parseCsv };
