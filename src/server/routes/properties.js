const { sendJson } = require("../http");
const { findAlert } = require("../../domain/alert-matcher");
const { COLUMN } = require("../../domain/columns");

async function withAlerts(data, fetchAlertData) {
  try {
    const districts = await fetchAlertData();
    return { ...data, alertas: data.imoveis.map(property => findAlert(property, districts)) };
  } catch (error) {
    console.error("Não foi possível carregar a base histórica de alertas:", error);
    return { ...data, alertas: null };
  }
}

async function listProperties({ url, response, deps }) {
  let data;
  try {
    data = await deps.loadProperties(undefined, { downloadIfMissing: url.searchParams.get("local") !== "1" });
  } catch (error) {
    console.error("Não foi possível carregar o CSV da Caixa:", error);
    sendJson(response, 502, { erro: "Não foi possível carregar a lista da Caixa. Tente novamente." });
    return;
  }
  sendJson(response, 200, await withAlerts(data, deps.fetchAlertData));
}

async function locateProperty({ params, response, deps }) {
  try {
    const data = await deps.loadProperties(undefined, { downloadIfMissing: false });
    const property = data.imoveis.find(row => row[COLUMN.ID] === params.id);
    if (!property) {
      sendJson(response, 404, { erro: "Imóvel não encontrado na lista local." });
      return;
    }
    sendJson(response, 200, { localizacao: await deps.locate(property) });
  } catch (error) {
    console.error("Não foi possível consultar a localização:", error);
    sendJson(response, 502, { erro: "Não foi possível consultar a localização." });
  }
}

module.exports = [
  { pattern: /^\/api\/imoveis$/, handler: listProperties },
  { pattern: /^\/api\/imoveis\/(?<id>\d+)\/localizacao$/, handler: locateProperty },
];
