const Media = require("../models/media.model");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { getVideoDurationInSeconds } = require("get-video-duration");
const unlinkAsync = promisify(fs.unlink);

// Configuração do diretório de uploads
const uploadDir =
  process.env.UPLOAD_PATH || path.join(__dirname, "..", "..", "uploads");
console.log("Diretório de uploads configurado:", uploadDir);

// Criar diretório de uploads se não existir
if (!fs.existsSync(uploadDir)) {
  console.log("Criando diretório de uploads:", uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Faz upload de uma nova mídia
 */
const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Nenhum arquivo enviado",
      });
    }

    // Determina o tipo de mídia
    let type = "image";
    let duration = req.body.duration || 0;

    if (req.file.mimetype.startsWith("video/")) {
      type = "video";
      try {
        // Extrair a duração do vídeo automaticamente
        duration = await getVideoDurationInSeconds(req.file.path);
        console.log(`Duração do vídeo extraída: ${duration} segundos`);
      } catch (durationError) {
        console.error("Erro ao extrair duração do vídeo:", durationError);
        // Em caso de erro, mantém a duração informada ou 0
      }
    } else if (req.file.mimetype === "text/html") {
      type = "html";
      // Para HTML, usamos a duração fornecida ou um valor padrão (10 segundos)
      duration = req.body.duration || 10;
      console.log(
        `Arquivo HTML detectado. Duração definida: ${duration} segundos`
      );
    }

    // Gera um token de acesso permanente para a mídia
    const jwt = require("jsonwebtoken");
    const mediaToken = jwt.sign(
      {
        type: "media_access",
        group: req.user.group._id || req.user.group,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10y" } // Token válido por 10 anos
    );

    // Gera a URL de download com o token
    const baseUrl =
      process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    const downloadUrl = `${baseUrl}/api/media/download/${req.file.filename}?token=${mediaToken}`;

    // Cria o registro da mídia
    const media = new Media({
      name: req.body.name || req.file.originalname,
      description: req.body.description || "",
      type,
      filePath: req.file.path,
      downloadUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      duration,
      group: req.user.group,
      uploadedBy: req.user._id,
    });

    await media.save();

    res.status(201).json({
      success: true,
      message: "Mídia enviada com sucesso",
      data: media,
    });
  } catch (error) {
    // Se ocorrer um erro, tenta remover o arquivo enviado
    if (req.file && req.file.path) {
      try {
        await unlinkAsync(req.file.path);
      } catch (unlinkError) {
        console.error("Erro ao remover arquivo:", unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Erro ao fazer upload da mídia",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Lista todas as mídias (filtradas por grupo do usuário)
 */
const getMediaList = async (req, res) => {
  try {
    let query = { active: true };

    // Filtra por grupo
    if (req.user.role !== "admin") {
      // Usuários comuns só veem mídias do seu grupo
      query.group = req.user.group;
    } else if (req.query.group) {
      // Admin pode filtrar por grupo
      query.group = req.query.group;
    }

    // Filtra por tipo
    if (req.query.type && ["image", "video"].includes(req.query.type)) {
      query.type = req.query.type;
    }

    const media = await Media.find(query)
      .populate("group", "name")
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: media.length,
      data: media,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao listar mídias",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Obtém uma mídia específica pelo ID
 */
const getMediaById = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)
      .populate("group", "name")
      .populate("uploadedBy", "name");

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Mídia não encontrada",
      });
    }

    // Verifica se o usuário tem permissão para ver esta mídia
    if (req.user.role !== "admin" && req.user.group) {
      const userGroupId = req.user.group._id || req.user.group;
      if (media.group._id.toString() !== userGroupId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Você só pode ver mídias do seu grupo.",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao buscar mídia",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Atualiza uma mídia existente
 */
const updateMedia = async (req, res) => {
  try {
    const { name, description, duration, active } = req.body;

    // Verifica se a mídia existe
    let media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Mídia não encontrada",
      });
    }

    // Verifica se o usuário tem permissão para atualizar esta mídia
    if (req.user.role !== "admin" && req.user.group) {
      const userGroupId = req.user.group._id || req.user.group;
      if (media.group.toString() !== userGroupId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Você só pode atualizar mídias do seu grupo.",
        });
      }
    }

    // Atualiza a mídia
    media.name = name || media.name;
    media.description =
      description !== undefined ? description : media.description;
    media.duration = duration || media.duration;

    // Apenas admin pode desativar
    if (req.user.role === "admin" && active !== undefined) {
      media.active = active;
    }

    await media.save();

    res.status(200).json({
      success: true,
      message: "Mídia atualizada com sucesso",
      data: media,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar mídia",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Remove uma mídia (soft delete)
 */
const deleteMedia = async (req, res) => {
  try {
    // Verifica se a mídia existe
    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Mídia não encontrada",
      });
    }

    // Verifica se o usuário tem permissão para remover esta mídia
    if (req.user.role !== "admin" && req.user.group) {
      const userGroupId = req.user.group._id || req.user.group;
      if (media.group.toString() !== userGroupId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Você só pode remover mídias do seu grupo.",
        });
      }
    }

    // Exclui o arquivo físico se ele existir
    if (media.filePath && fs.existsSync(media.filePath)) {
      try {
        await unlinkAsync(media.filePath);
        console.log(`Arquivo excluído: ${media.filePath}`);
      } catch (unlinkError) {
        console.error(
          `Erro ao excluir arquivo: ${media.filePath}`,
          unlinkError
        );
        // Continua mesmo se não conseguir excluir o arquivo
      }
    }

    // Exclui a miniatura se existir
    if (media.thumbnailPath && fs.existsSync(media.thumbnailPath)) {
      try {
        await unlinkAsync(media.thumbnailPath);
        console.log(`Miniatura excluída: ${media.thumbnailPath}`);
      } catch (unlinkError) {
        console.error(
          `Erro ao excluir miniatura: ${media.thumbnailPath}`,
          unlinkError
        );
        // Continua mesmo se não conseguir excluir a miniatura
      }
    }

    // Exclui o registro do banco de dados permanentemente
    await Media.deleteOne({ _id: media._id });

    res.status(200).json({
      success: true,
      message: "Mídia excluída permanentemente com sucesso",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao excluir mídia",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Serve um arquivo de mídia diretamente
 */
const serveMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);

    if (!media || !media.active) {
      return res.status(404).json({
        success: false,
        message: "Mídia não encontrada",
      });
    }

    // Verifica se o arquivo existe
    if (!media.filePath || !fs.existsSync(media.filePath)) {
      return res.status(404).json({
        success: false,
        message: "Arquivo não encontrado",
      });
    }

    // Configura os headers apropriados
    res.setHeader("Content-Type", media.mimeType);
    res.setHeader("Content-Length", media.fileSize);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache por 1 ano

    // Envia o arquivo
    const fileStream = fs.createReadStream(media.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Erro ao servir mídia:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao servir arquivo",
    });
  }
};

/**
 * Download de mídia com token permanente
 */
const downloadMedia = async (req, res) => {
  try {
    const filename = req.params.filename;
    // Usar o caminho de upload definido nas variáveis de ambiente ou um caminho padrão
    const uploadDir =
      process.env.UPLOAD_PATH || path.join(__dirname, "..", "..", "uploads");
    const filePath = path.join(uploadDir, filename);

    console.log("Tentando acessar arquivo em:", filePath);
    console.log("Upload dir:", uploadDir);
    console.log("Filename:", filename);

    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.log("Arquivo não encontrado em:", filePath);
      // Tentar encontrar o arquivo em subdiretórios
      const files = await findFileInDirectory(uploadDir, filename);
      if (files.length > 0) {
        console.log("Arquivo encontrado em:", files[0]);
        const foundFilePath = files[0];

        // Obtém informações do arquivo
        const stat = fs.statSync(foundFilePath);
        const fileSize = stat.size;
        const mimeType =
          require("mime-types").lookup(foundFilePath) ||
          "application/octet-stream";

        // Configura os headers apropriados
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Length", fileSize);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache por 1 ano

        // Envia o arquivo
        const fileStream = fs.createReadStream(foundFilePath);
        return fileStream.pipe(res);
      }

      return res.status(404).json({
        success: false,
        message: "Arquivo não encontrado",
        debug: {
          searchedPath: filePath,
          uploadDir: uploadDir,
        },
      });
    }

    // Obtém informações do arquivo
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType =
      require("mime-types").lookup(filePath) || "application/octet-stream";

    // Configura os headers apropriados
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache por 1 ano

    // Envia o arquivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Erro ao fazer download da mídia:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao fazer download do arquivo",
      debug:
        process.env.NODE_ENV === "development"
          ? {
              error: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
};

// Função auxiliar para procurar arquivo em subdiretórios
const findFileInDirectory = async (startPath, filename) => {
  let results = [];

  if (!fs.existsSync(startPath)) {
    console.log("Diretório não existe:", startPath);
    return results;
  }

  const files = fs.readdirSync(startPath);
  for (let file of files) {
    const filepath = path.join(startPath, file);
    const stat = fs.statSync(filepath);

    if (stat.isDirectory()) {
      results = results.concat(await findFileInDirectory(filepath, filename));
    } else if (file === filename) {
      results.push(filepath);
    }
  }

  return results;
};

module.exports = {
  uploadMedia,
  getMediaList,
  getMediaById,
  updateMedia,
  deleteMedia,
  serveMedia,
  downloadMedia,
};
