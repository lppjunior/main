const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

module.exports = {
  HOST: "127.0.0.1",
  PORT: 8000,
  WEB_ROOT: path.join(__dirname, "web"),
  LEAFLET_DIR: path.join(ROOT_DIR, "node_modules", "leaflet", "dist"),
  CAIXA_CSV_URL: "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv",
  CAIXA_CSV_FILE: path.join(DATA_DIR, "lista_imoveis_geral.csv"),
  ALERTS_SOURCE_URL: "https://raw.githubusercontent.com/olucasandre/mapa-faccoes-rio-bairros/" +
    "669cc8a349f41cfe90a67bf481bfd61054e6739f/dados/processados/faccoes_bairro_2010_2022.csv",
  ALERTS_REPORT_FILE: path.join(DATA_DIR, "lista_alertas_historicos.csv"),
  NOMINATIM_URL: process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search",
};
