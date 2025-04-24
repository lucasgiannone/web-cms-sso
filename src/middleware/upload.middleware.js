const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuração do armazenamento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Cria o diretório do grupo se não existir
    // Verifica se group é um objeto ou um ID
    const groupId = req.user.group._id
      ? req.user.group._id.toString()
      : req.user.group.toString();
    const uploadDir = path.join(process.env.UPLOAD_PATH || "uploads", groupId);

    console.log("Salvando arquivo em:", uploadDir);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Gera um nome único para o arquivo
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
  // Aceita imagens, vídeos e arquivos HTML
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/") ||
    file.mimetype === "text/html"
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Tipo de arquivo não suportado. Apenas imagens, vídeos e HTML são permitidos."
      ),
      false
    );
  }
};

// Configuração do upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Middleware para tratamento de erros do multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Arquivo muito grande. O tamanho máximo permitido é 100MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Erro no upload: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

module.exports = {
  upload,
  handleUploadError,
};
