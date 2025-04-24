const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const axios = require("axios");

// Rota para login
router.post("/login", authController.login);

// Rota para registro (apenas admin)
router.post("/register", auth, adminOnly, authController.register);

// Rota para obter perfil do usuário autenticado
router.get("/profile", auth, authController.getProfile);

// Rota para alterar senha
router.post("/change-password", auth, authController.changePassword);

// Rota para processar o login e armazenar na sessão
router.post("/process-login", authController.processLogin);

module.exports = router;
