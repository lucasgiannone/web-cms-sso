const express = require("express");
const router = express.Router();
const templateController = require("../controllers/template.controller");
const { webAuth } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload");

// Configuração do multer para upload de arquivos HTML
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, "..", "public", "uploads", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, `template-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === "text/html") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos HTML são permitidos."), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // Aumentado para 10MB
});

// Middleware para verificar autenticação em todas as rotas
router.use(webAuth);

// Configuração para upload de imagens na criação de mensagens
const fileUploadMiddleware = fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  abortOnLimit: true,
  createParentPath: true,
});

// Rota para visualizar a prévia de um template (NOVA ROTA)
router.get("/preview/:id", templateController.previewTemplate);

// Rota principal - lista todos os templates
router.get("/", templateController.list);

// Rotas para criar template
router.get("/create", templateController.createForm);
router.post("/create", upload.single("htmlFile"), templateController.create);

// Rotas para criar nova mensagem a partir de template
router.get("/create-message/:id", templateController.createMessageForm);
router.post(
  "/create-message/:id",
  fileUploadMiddleware,
  templateController.createMessage
);
// Rota para processar a prévia da mensagem
router.post(
  "/create-message/:id/preview",
  fileUploadMiddleware,
  templateController.previewMessage
);

// Alias para criar mensagem (manter compatibilidade com frontend)
router.get("/message/:id", templateController.createMessageForm);
router.post(
  "/message/:id",
  fileUploadMiddleware,
  templateController.createMessage
);
// Alias para a prévia da mensagem
router.post(
  "/message/:id/preview",
  fileUploadMiddleware,
  templateController.previewMessage
);

// Rotas para gerenciar variáveis dinâmicas
router.get("/variables/:id", templateController.editVariables);
router.post("/variables/:id", templateController.updateVariables);

// Rotas para editar template
router.get("/edit/:id", templateController.editForm);
router.post("/edit/:id", upload.single("htmlFile"), templateController.update);

// Rota para excluir template
router.post("/delete/:id", templateController.delete);

// Rotas para visualizar detalhes do template - deve vir por último para não conflitar com outras rotas que usam :id
router.get("/:id", templateController.details);

module.exports = router;
