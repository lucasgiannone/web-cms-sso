const { app, server } = require("./app");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Carrega as variáveis de ambiente
dotenv.config();

// Define a porta fixa 3001
const PORT = 3001;

// Conecta ao MongoDB e inicia o servidor
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Conectado ao MongoDB");

    // Inicia o servidor após conectar ao MongoDB
    server.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Acesse: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erro ao conectar ao MongoDB:", err);
    process.exit(1);
  });
