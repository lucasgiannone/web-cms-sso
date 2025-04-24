const express = require("express");
const router = express.Router();
const samlController = require("../controllers/saml.controller");

// Rota para iniciar o login SAML (redirecionará para o provedor de identidade)
router.get("/login", samlController.initiateLogin);

// Rota para o simulador de IdP local
router.get("/simulated-idp", (req, res) => {
  const callbackUrl = `${req.protocol}://${req.get("host")}/auth/saml/callback`;
  res.render("auth/simulated-idp", { callbackUrl });
});

// Adiciona uma rota específica para simulador que sempre estará disponível
router.get("/dev-login", (req, res) => {
  res.redirect("/simulated-idp");
});

// Rota de callback para receber a resposta SAML do provedor de identidade
router.post("/callback", samlController.handleCallback);

// Rota para o logout
router.get("/logout", samlController.logout);

// Rota para obter os metadados SAML (útil para configurar o provedor de identidade)
router.get("/metadata", samlController.getMetadata);

module.exports = router;
