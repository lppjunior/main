const { writeFile } = require("node:fs/promises");
const { stringify } = require("csv-stringify/sync");
const { ALERTS_REPORT_FILE, ALERTS_SOURCE_URL } = require("../config");
const { loadProperties } = require("../data/caixa-repository");
const { fetchAlertData } = require("../data/alert-source");
const { buildAlertReport } = require("../domain/alert-report");

async function generate(properties, districts, output) {
  const rows = buildAlertReport(properties, districts, ALERTS_SOURCE_URL);
  await writeFile(output, stringify(rows, { delimiter: ";", record_delimiter: "\r\n", bom: true }), "utf8");
  return rows.length - 1;
}

async function main() {
  const properties = await loadProperties();
  const districts = await fetchAlertData();
  const count = await generate(properties, districts, ALERTS_REPORT_FILE);
  console.log(`${count} alertas históricos em ${ALERTS_REPORT_FILE}; lista da Caixa de ${properties.dataGeracao}.`);
  console.log("Os demais endereços não foram avaliados; ausência de alerta não significa segurança.");
}

if (require.main === module) {
  main().catch(error => {
    console.error("Não foi possível gerar a lista de alertas:", error);
    process.exitCode = 1;
  });
}

module.exports = { generate };
