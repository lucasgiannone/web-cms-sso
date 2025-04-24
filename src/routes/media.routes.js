const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/media.controller");
const { auth, sameGroupOrAdmin } = require("../middleware/auth.middleware");
const {
  upload,
  handleUploadError,
} = require("../middleware/upload.middleware");

// Rotas públicas (sem autenticação)
// Servir arquivo de mídia
router.get("/:id/file", mediaController.serveMedia);

// Download direto de mídia com token
router.get("/download/:filename", mediaController.downloadMedia);

// Rotas protegidas (com autenticação)
// Upload de mídia
router.post(
  "/",
  auth,
  upload.single("file"),
  handleUploadError,
  mediaController.uploadMedia
);

// Listar todas as mídias (filtradas por grupo)
router.get("/", auth, mediaController.getMediaList);

// Obter uma mídia específica
router.get("/:id", auth, sameGroupOrAdmin, mediaController.getMediaById);

// Atualizar uma mídia
router.put("/:id", auth, sameGroupOrAdmin, mediaController.updateMedia);

// Remover uma mídia
router.delete("/:id", auth, sameGroupOrAdmin, mediaController.deleteMedia);

// Remover múltiplas mídias
router.post("/delete-multiple", auth, async (req, res) => {
  try {
    const Media = require("../models/media.model");
    const User = require("../models/user.model");
    const fs = require("fs");
    const path = require("path");
    const mongoose = require("mongoose");

    const { mediaIds } = req.body;

    // Validar entrada
    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "IDs de mídia inválidos ou não fornecidos",
      });
    }

    // Filtrar apenas IDs válidos
    const validMediaIds = mediaIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validMediaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nenhum ID de mídia válido fornecido",
      });
    }

    // Registrar se houve IDs inválidos
    const invalidCount = mediaIds.length - validMediaIds.length;
    if (invalidCount > 0) {
      console.warn(`${invalidCount} IDs de mídia inválidos foram ignorados`);
    }

    // Obter informações do usuário
    const user = await User.findById(req.user._id).populate("group");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
      });
    }

    // Filtro para verificar permissões
    let deleteFilter = { _id: { $in: validMediaIds } };
    if (user.role !== "admin") {
      // Usuários não-admin só podem excluir mídias do seu grupo
      deleteFilter.group = user.group._id;
    }

    // Buscar as mídias para excluir os arquivos físicos
    const mediasToDelete = await Media.find(deleteFilter);

    // Excluir arquivos físicos
    const deleteErrors = [];
    for (const media of mediasToDelete) {
      try {
        const uploadsDir =
          process.env.UPLOAD_PATH || "./src/public/uploads/media";

        // Verificar se o filename existe antes de tentar excluir o arquivo
        if (media.filename) {
          const filePath = path.join(uploadsDir, media.filename);

          // Verificar se o arquivo existe antes de tentar excluir
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          } else {
            console.warn(
              `Arquivo não encontrado para mídia ID ${media._id}: ${filePath}`
            );
          }
        } else {
          console.warn(
            `Mídia ID ${media._id} não possui um filename definido, pulando exclusão de arquivo físico`
          );
        }
      } catch (fileError) {
        console.error(
          `Erro ao excluir arquivo da mídia ID ${media._id}:`,
          fileError
        );
        deleteErrors.push(`Erro ao excluir arquivo: ${media._id}`);
        // Continuar para a próxima mídia mesmo com erro
      }
    }

    // Registrar erros de exclusão de arquivos, se houver
    if (deleteErrors.length > 0) {
      console.warn(
        `Ocorreram ${deleteErrors.length} erros durante a exclusão de arquivos físicos:`,
        deleteErrors
      );
    }

    // Excluir do banco de dados
    const result = await Media.deleteMany(deleteFilter);

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} mídia(s) excluída(s) com sucesso`,
      deleted: result.deletedCount,
      fileErrors: deleteErrors.length > 0 ? deleteErrors : undefined,
    });
  } catch (error) {
    console.error("Erro ao excluir múltiplas mídias:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao excluir mídias",
      error: error.message,
    });
  }
});

module.exports = router;
