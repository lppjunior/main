const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { WEB_ROOT, LEAFLET_DIR } = require("../config");
const { send, sendText } = require("./http");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const VENDOR_FILES = {
  "/leaflet.js": path.join(LEAFLET_DIR, "leaflet.js"),
  "/leaflet.css": path.join(LEAFLET_DIR, "leaflet.css"),
};

// Resolve a URL para um arquivo em WEB_ROOT, rejeitando qualquer caminho que escape dele.
function resolveFile(pathname) {
  if (Object.hasOwn(VENDOR_FILES, pathname)) return VENDOR_FILES[pathname];
  let decoded;
  try {
    decoded = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    return null;
  }
  const file = path.resolve(WEB_ROOT, `.${decoded}`);
  const inside = file.startsWith(WEB_ROOT + path.sep);
  return inside && Object.hasOwn(CONTENT_TYPES, path.extname(file)) ? file : null;
}

async function serveStatic(pathname, response) {
  const file = resolveFile(pathname);
  if (!file) return false;
  let content;
  try {
    content = await readFile(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return false;
    console.error(`Não foi possível carregar ${file}:`, error);
    sendText(response, 500, "Erro ao carregar a página.");
    return true;
  }
  send(response, 200, CONTENT_TYPES[path.extname(file)], content);
  return true;
}

module.exports = { serveStatic };
