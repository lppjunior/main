const JSON_TYPE = "application/json; charset=utf-8";
const TEXT_TYPE = "text/plain; charset=utf-8";

function send(response, status, contentType, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

const sendJson = (response, status, payload) => send(response, status, JSON_TYPE, JSON.stringify(payload));
const sendText = (response, status, message) => send(response, status, TEXT_TYPE, message);

module.exports = { send, sendJson, sendText };
