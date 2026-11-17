const { HOST, PORT } = require("../config");
const { createServer } = require("./create-server");

createServer().listen(PORT, HOST, () => {
  console.log(`Acesse http://localhost:${PORT} (Ctrl+C para encerrar)`);
});
