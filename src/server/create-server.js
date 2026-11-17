const http = require("node:http");
const { loadProperties } = require("../data/caixa-repository");
const { fetchAlertData } = require("../data/alert-source");
const { createLocator } = require("../data/nominatim-geocoder");
const { sendText } = require("./http");
const { serveStatic } = require("./static-files");
const apiRoutes = require("./routes/properties");

function matchRoute(routes, pathname) {
  for (const route of routes) {
    const match = route.pattern.exec(pathname);
    if (match) return { handler: route.handler, params: match.groups ?? {} };
  }
  return null;
}

function createServer({ loadProperties: load = loadProperties, fetchAlertData: fetchAlerts = fetchAlertData, locate = createLocator() } = {}) {
  const deps = { loadProperties: load, fetchAlertData: fetchAlerts, locate };
  return http.createServer(async (request, response) => {
    if (request.method !== "GET") {
      sendText(response, 405, "Método não permitido");
      return;
    }
    const url = new URL(request.url, "http://localhost");
    const route = matchRoute(apiRoutes, url.pathname);
    if (route) {
      await route.handler({ request, response, url, params: route.params, deps });
    } else if (!(await serveStatic(url.pathname, response))) {
      sendText(response, 404, "Página não encontrada");
    }
  });
}

module.exports = { createServer };
