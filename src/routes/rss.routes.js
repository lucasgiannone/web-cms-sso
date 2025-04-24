const express = require("express");
const router = express.Router();
const rssController = require("../controllers/rss.controller");
const { webAuth } = require("../middleware/auth.middleware");
const { check } = require("express-validator");

// Middleware para verificar autenticação em todas as rotas
router.use(webAuth);

// Validação para adição/edição de fonte RSS
const rssValidation = [
  check("name").trim().notEmpty().withMessage("Nome é obrigatório"),
  check("url").trim().notEmpty().withMessage("URL é obrigatória"),
  check("source").trim().notEmpty().withMessage("Fonte é obrigatória"),
  check("group").trim().notEmpty().withMessage("Grupo é obrigatório"),
];

// Listar todas as fontes RSS
router.get("/", rssController.getAllRSS);

// Adicionar nova fonte RSS
router.get("/add", rssController.getAddRSS);
router.post("/add", rssValidation, rssController.postAddRSS);

// Editar fonte RSS
router.get("/edit/:id", rssController.getEditRSS);
router.post("/update/:id", rssValidation, rssController.postUpdateRSS);

// Excluir fonte RSS
router.delete("/delete/:id", rssController.deleteRSS);

// Detalhes da fonte RSS
router.get("/details/:id", rssController.getRSSDetails);

module.exports = router;
