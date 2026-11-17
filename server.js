const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const caixa = require("./caixa");
const alertas = require("./alertas");

const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

function send(response, status, contentType, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function createServer({ loadProperties = caixa.loadProperties, fetchAlertData = alertas.fetchAlertData } = {}) {
  return http.createServer(async (request, response) => {
    if (request.method !== "GET") {
      send(response, 405, "text/plain; charset=utf-8", "Método não permitido");
      return;
    }
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;
    if (pathname === "/api/imoveis") {
      let data;
      try {
        data = await loadProperties(undefined, { downloadIfMissing: url.searchParams.get("local") !== "1" });
      } catch (error) {
        console.error("Não foi possível carregar o CSV da Caixa:", error);
        send(response, 502, "application/json; charset=utf-8",
          JSON.stringify({ erro: "Não foi possível carregar a lista da Caixa. Tente novamente." }));
        return;
      }
      try {
        const districts = await fetchAlertData();
        data.alertas = data.imoveis.map(property => alertas.findAlert(property, districts));
      } catch (error) {
        console.error("Não foi possível carregar a base histórica de alertas:", error);
        data.alertas = null;
      }
      send(response, 200, "application/json; charset=utf-8", JSON.stringify(data));
    } else if (Object.hasOwn(STATIC_FILES, pathname)) {
      const [filename, contentType] = STATIC_FILES[pathname];
      try {
        send(response, 200, contentType, await readFile(path.join(__dirname, filename)));
      } catch (error) {
        console.error(`Não foi possível carregar ${filename}:`, error);
        send(response, 500, "text/plain; charset=utf-8", "Erro ao carregar a página.");
      }
    } else {
      send(response, 404, "text/plain; charset=utf-8", "Página não encontrada");
    }
  });
}

if (require.main === module) {
  createServer().listen(8000, "127.0.0.1", () => {
    console.log("Acesse http://localhost:8000 (Ctrl+C para encerrar)");
  });
}

module.exports = { createServer };
