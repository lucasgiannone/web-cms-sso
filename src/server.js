const { app, server } = require("./app");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const net = require("net");

// Carrega as variáveis de ambiente
dotenv.config();

// Define a porta inicial
const BASE_PORT = process.env.PORT || 3001;
let PORT = BASE_PORT;

// Função para verificar se uma porta está disponível
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.once("close", () => resolve(true)).close();
      })
      .listen(port);
  });
}

// Função para encontrar uma porta disponível
async function findAvailablePort(startPort) {
  let port = startPort;
  let maxAttempts = 10; // Tentar até 10 portas diferentes

  while (maxAttempts > 0) {
    const isAvailable = await isPortAvailable(port);
    if (isAvailable) {
      return port;
    }
    port++;
    maxAttempts--;
  }

  // Se não encontrar nenhuma porta disponível, lançar erro
  throw new Error("Não foi possível encontrar uma porta disponível");
}

// Conecta ao MongoDB e inicia o servidor
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Conectado ao MongoDB");

    try {
      // Encontrar uma porta disponível
      PORT = await findAvailablePort(PORT);

      // Inicia o servidor após conectar ao MongoDB
      server.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error("Erro ao iniciar o servidor:", error.message);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("Erro ao conectar ao MongoDB:", err);
    process.exit(1);
  });
