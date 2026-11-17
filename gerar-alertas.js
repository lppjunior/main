const { writeFile } = require("node:fs/promises");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");
const caixa = require("./caixa");
const alertas = require("./alertas");

const OUTPUT = path.join(__dirname, "lista_alertas_historicos.csv");

function spreadsheetSafe(value) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

async function generate(properties, districts, output) {
  const rows = [[
    "numero_imovel", "uf", "cidade", "bairro_caixa", "endereco",
    "bairro_censo_2010", "grupos_e_percentual_bairro_2022",
    "aviso", "data_lista_caixa", "fonte",
  ]];
  for (const property of properties.imoveis) {
    const alert = alertas.findAlert(property, districts);
    if (!alert) continue;
    const groups = alert.grupos.map(group => `${group.grupo}: ${group.percentual}%`).join(" | ");
    const values = [
      ...property.slice(0, 5), alert.nome, groups,
      "Parte do bairro mapeada em 2022; endereço e situação atual não verificados",
      properties.dataGeracao, alertas.SOURCE_URL,
    ];
    rows.push(values.map(spreadsheetSafe));
  }
  const csv = stringify(rows, { delimiter: ";", record_delimiter: "\r\n", bom: true });
  await writeFile(output, csv, "utf8");
  return rows.length - 1;
}

async function main() {
  const properties = await caixa.loadProperties();
  const districts = await alertas.fetchAlertData();
  const count = await generate(properties, districts, OUTPUT);
  console.log(`${count} alertas históricos em ${OUTPUT}; lista da Caixa de ${properties.dataGeracao}.`);
  console.log("Os demais endereços não foram avaliados; ausência de alerta não significa segurança.");
}

if (require.main === module) {
  main().catch(error => {
    console.error("Não foi possível gerar a lista de alertas:", error);
    process.exitCode = 1;
  });
}

module.exports = { generate };
