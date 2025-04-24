const express = require("express");
const router = express.Router();
const axios = require("axios");
const {
  webAuth,
  webAdminOnly,
  webSameGroupOrAdmin,
} = require("../middleware/auth.middleware");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");
const multer = require("multer");
const mongoose = require("mongoose");

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, "..", "public", "uploads", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype === "text/html"
    ) {
      cb(null, true);
    } else {
      cb(
        new Error("Apenas arquivos de imagem, vídeo e HTML são permitidos."),
        false
      );
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Controlador de players
const playerController = require("../controllers/web/player.controller");

// Rota para a página inicial
router.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.redirect("/auth/login");
});

// Rotas de autenticação
router.get("/auth/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.render("auth/login", { title: "Login" });
});

router.get("/auth/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Rota para o dashboard
router.get("/dashboard", webAuth, async (req, res) => {
  try {
    const User = require("../models/user.model");
    const Media = require("../models/media.model");
    const Playlist = require("../models/playlist.model");
    const Player = require("../models/player.model");
    const Group = require("../models/group.model");

    // Verificar se o usuário está populado corretamente
    let currentUser = req.session.user;
    if (!currentUser.group || typeof currentUser.group === "string") {
      // Buscar o usuário completo do banco de dados
      currentUser = await User.findById(currentUser._id).populate("group");
      if (currentUser) {
        req.session.user = currentUser;
      }
    }

    // Determinar se o usuário é admin
    const isAdmin = currentUser.role === "admin";

    // Filtro para usuários não-admin (apenas ver itens do seu grupo)
    const filter =
      !isAdmin && currentUser.group ? { group: currentUser.group._id } : {};

    // Obter estatísticas
    const stats = {
      userCount: await User.countDocuments(filter),
      mediaCount: await Media.countDocuments(filter),
      playlistCount: await Playlist.countDocuments(filter),
      playerCount: await Player.countDocuments(filter),
      groupCount: await Group.countDocuments(),
    };

    // Obter itens recentes
    const recentMedia = await Media.find(filter)
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("group");

    const recentPlaylists = await Playlist.find({
      ...filter,
      active: true,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("group");

    const players = await Player.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("playlist");

    res.render("dashboard", {
      title: "Dashboard",
      stats,
      recentMedia,
      recentPlaylists,
      players,
      active: "dashboard",
    });
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    res.render("dashboard", {
      title: "Dashboard",
      error: "Erro ao carregar dados do dashboard",
      active: "dashboard",
    });
  }
});

// Rotas para usuários
router.get("/users", webAuth, webAdminOnly, async (req, res) => {
  try {
    const User = require("../models/user.model");
    const Group = require("../models/group.model");

    // Buscar todos os usuários
    const users = await User.find().populate("group").sort({ name: 1 });

    // Buscar todos os grupos
    const groups = await Group.find().sort({ name: 1 });

    res.render("users/index", {
      title: "Usuários",
      users,
      groups,
      active: "users",
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.render("users/index", {
      title: "Usuários",
      users: [],
      error: "Erro ao listar usuários",
    });
  }
});

router.get("/users/new", webAuth, webAdminOnly, async (req, res) => {
  try {
    const Group = require("../models/group.model");
    // Buscar todos os grupos ativos
    const groups = await Group.find({ active: true }).sort({ name: 1 });

    res.render("users/form", {
      title: "Novo Usuário",
      groups,
      active: "users",
    });
  } catch (error) {
    console.error("Erro ao carregar grupos:", error);
    res.render("users/form", {
      title: "Novo Usuário",
      user: {},
      groups: [],
      error: "Erro ao carregar grupos",
    });
  }
});

router.get("/users/:id", webAuth, webAdminOnly, async (req, res) => {
  try {
    const User = require("../models/user.model");

    // Buscar o usuário
    const user = await User.findById(req.params.id).populate("group");

    if (!user) {
      req.flash("error", "Usuário não encontrado");
      return res.redirect("/users");
    }

    res.render("users/view", {
      title: `Usuário - ${user.name}`,
      user,
      userId: req.params.id,
      active: "users",
    });
  } catch (error) {
    console.error("Erro ao carregar detalhes do usuário:", error);
    req.flash("error", "Erro ao carregar detalhes do usuário");
    res.redirect("/users");
  }
});

router.get("/users/:id/edit", webAuth, webAdminOnly, async (req, res) => {
  try {
    const User = require("../models/user.model");
    const Group = require("../models/group.model");

    // Buscar o usuário
    const user = await User.findById(req.params.id).populate("group");

    if (!user) {
      req.flash("error", "Usuário não encontrado");
      return res.redirect("/users");
    }

    // Buscar todos os grupos ativos
    const groups = await Group.find({ active: true }).sort({ name: 1 });

    res.render("users/form", {
      title: "Editar Usuário",
      user,
      groups,
      active: "users",
    });
  } catch (error) {
    console.error("Erro ao carregar usuário para edição:", error);
    req.flash("error", "Erro ao carregar usuário para edição");
    res.redirect("/users");
  }
});

// Rota para processar o formulário de criação de usuário
router.post("/users/create", webAuth, webAdminOnly, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, group, isAdmin, active } =
      req.body;

    // Verificar se as senhas coincidem
    if (password !== confirmPassword) {
      req.flash("error", "As senhas não coincidem");
      return res.redirect("/users/new");
    }

    // Prepara os dados para enviar para a API
    const data = {
      name,
      email,
      password,
      group: group || null,
      isAdmin: isAdmin === "on",
      active: active === "on",
    };

    // Faz a requisição para a API
    const response = await axios.post(
      `${process.env.API_URL || "http://177.71.165.181"}/api/users`,
      data,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    req.flash("success", "Usuário criado com sucesso");
    res.redirect("/users");
  } catch (error) {
    console.error(
      "Erro ao criar usuário:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Erro ao criar usuário"
    );
    res.redirect("/users/new");
  }
});

// Rota para processar o formulário de atualização de usuário
router.post("/users/:id/update", webAuth, webAdminOnly, async (req, res) => {
  try {
    const { name, email, group, isAdmin, active } = req.body;

    // Prepara os dados para enviar para a API
    const data = {
      name,
      email,
      group: group || null,
      isAdmin: isAdmin === "on",
      active: active === "on",
    };

    // Faz a requisição para a API
    const response = await axios.put(
      `${process.env.API_URL || "http://177.71.165.181"}/api/users/${
        req.params.id
      }`,
      data,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    req.flash("success", "Usuário atualizado com sucesso");
    res.redirect(`/users/${req.params.id}`);
  } catch (error) {
    console.error(
      "Erro ao atualizar usuário:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Erro ao atualizar usuário"
    );
    res.redirect(`/users/${req.params.id}/edit`);
  }
});

// Rota para desativar um usuário
router.post("/users/:id/delete", webAuth, webAdminOnly, async (req, res) => {
  try {
    // Faz a requisição para a API
    const response = await axios.delete(
      `${process.env.API_URL || "http://177.71.165.181"}/api/users/${
        req.params.id
      }`,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    req.flash("success", "Usuário desativado com sucesso");
    res.redirect("/users");
  } catch (error) {
    console.error(
      "Erro ao desativar usuário:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Erro ao desativar usuário"
    );
    res.redirect(`/users/${req.params.id}`);
  }
});

// Rota para redefinir a senha de um usuário
router.post(
  "/users/:id/reset-password",
  webAuth,
  webAdminOnly,
  async (req, res) => {
    try {
      const { newPassword, confirmNewPassword } = req.body;

      // Verificar se as senhas coincidem
      if (newPassword !== confirmNewPassword) {
        req.flash("error", "As senhas não coincidem");
        return res.redirect(`/users/${req.params.id}`);
      }

      // Faz a requisição para a API
      const response = await axios.post(
        `${process.env.API_URL || "http://177.71.165.181"}/api/users/${
          req.params.id
        }/reset-password`,
        { newPassword },
        {
          headers: {
            Authorization: `Bearer ${req.session.token}`,
          },
        }
      );

      req.flash("success", "Senha redefinida com sucesso");
      res.redirect(`/users/${req.params.id}`);
    } catch (error) {
      console.error(
        "Erro ao redefinir senha:",
        error.response?.data || error.message
      );
      req.flash(
        "error",
        error.response?.data?.message || "Erro ao redefinir senha"
      );
      res.redirect(`/users/${req.params.id}`);
    }
  }
);

// Rota GET para excluir um usuário
router.get("/users/:id/delete", webAuth, webAdminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    // Faz a requisição para a API para excluir o usuário
    const response = await axios.delete(`/api/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${req.session.token}`,
      },
      baseURL: `http://localhost:${process.env.PORT || 3000}`,
    });

    if (response.data.success) {
      req.flash("success", "Usuário desativado com sucesso");
    } else {
      req.flash("error", response.data.message || "Erro ao desativar usuário");
    }

    return res.redirect("/users");
  } catch (error) {
    console.error(
      "Erro ao desativar usuário:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Não foi possível desativar o usuário."
    );
    return res.redirect("/users");
  }
});

// Rotas para grupos
router.get("/groups", webAuth, webAdminOnly, async (req, res) => {
  try {
    const Group = require("../models/group.model");
    const User = require("../models/user.model");
    const Media = require("../models/media.model");
    const Playlist = require("../models/playlist.model");
    const Player = require("../models/player.model");

    // Obter todos os grupos
    const groups = await Group.find().sort({ name: 1 });

    // Adicionar estatísticas a cada grupo
    for (const group of groups) {
      group.userCount = await User.countDocuments({ group: group._id });
      group.mediaCount = await Media.countDocuments({ group: group._id });
      group.playlistCount = await Playlist.countDocuments({ group: group._id });
      group.playerCount = await Player.countDocuments({ group: group._id });
    }

    res.render("groups/index", {
      title: "Grupos",
      groups,
      active: "groups",
    });
  } catch (error) {
    console.error("Erro ao listar grupos:", error);
    req.flash("error", "Erro ao listar grupos");
    res.render("groups/index", {
      title: "Grupos",
      error: "Erro ao listar grupos",
    });
  }
});

router.get("/groups/new", webAuth, webAdminOnly, (req, res) => {
  res.render("groups/form", { title: "Novo Grupo", active: "groups" });
});

router.get("/groups/:id", webAuth, webAdminOnly, async (req, res) => {
  try {
    const Group = require("../models/group.model");
    const User = require("../models/user.model");
    const Media = require("../models/media.model");
    const Playlist = require("../models/playlist.model");
    const Player = require("../models/player.model");

    const group = await Group.findById(req.params.id);

    if (!group) {
      req.flash("error", "Grupo não encontrado");
      return res.redirect("/groups");
    }

    // Obter estatísticas do grupo
    const userCount = await User.countDocuments({ group: group._id });
    const mediaCount = await Media.countDocuments({ group: group._id });
    const playlistCount = await Playlist.countDocuments({ group: group._id });
    const playerCount = await Player.countDocuments({ group: group._id });

    // Adicionar estatísticas ao objeto do grupo
    group.userCount = userCount;
    group.mediaCount = mediaCount;
    group.playlistCount = playlistCount;
    group.playerCount = playerCount;

    // Obter usuários e players do grupo (limitado a 5 para exibição)
    const users = await User.find({ group: group._id }).limit(5);
    const players = await Player.find({ group: group._id }).limit(5);

    res.render("groups/view", {
      title: `Grupo - ${group.name}`,
      group,
      users,
      active: "groups",
    });
  } catch (error) {
    console.error("Erro ao buscar grupo:", error);
    req.flash("error", "Erro ao buscar grupo");
    res.redirect("/groups");
  }
});

router.get("/groups/:id/edit", webAuth, webAdminOnly, async (req, res) => {
  try {
    const Group = require("../models/group.model");
    const group = await Group.findById(req.params.id);

    if (!group) {
      req.flash("error", "Grupo não encontrado");
      return res.redirect("/groups");
    }

    res.render("groups/form", {
      title: "Editar Grupo",
      group,
      active: "groups",
    });
  } catch (error) {
    console.error("Erro ao buscar grupo para edição:", error);
    req.flash("error", "Erro ao buscar grupo para edição");
    res.redirect("/groups");
  }
});

// Rota para processar o formulário de criação de grupo
router.post("/groups/create", webAuth, webAdminOnly, async (req, res) => {
  try {
    const { name, description, active, permissions } = req.body;

    // Prepara os dados para enviar para a API
    const data = {
      name,
      description,
      active: active === "on",
      permissions: {
        canManageUsers: permissions && permissions.canManageUsers === "on",
        canManageMedia: permissions && permissions.canManageMedia === "on",
        canManagePlaylists:
          permissions && permissions.canManagePlaylists === "on",
        canManagePlayers: permissions && permissions.canManagePlayers === "on",
        isAdmin: permissions && permissions.isAdmin === "on",
      },
    };

    // Faz a requisição para a API
    const response = await axios.post(
      `${process.env.API_URL || "http://177.71.165.181"}/api/groups`,
      data,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    req.flash("success", "Grupo criado com sucesso");
    res.redirect("/groups");
  } catch (error) {
    console.error(
      "Erro ao criar grupo:",
      error.response?.data || error.message
    );
    req.flash("error", error.response?.data?.message || "Erro ao criar grupo");
    res.redirect("/groups/new");
  }
});

// Rota para processar o formulário de atualização de grupo
router.post("/groups/:id/update", webAuth, webAdminOnly, async (req, res) => {
  try {
    const { name, description, active, permissions } = req.body;

    // Prepara os dados para enviar para a API
    const data = {
      name,
      description,
      active: active === "on",
      permissions: {
        canManageUsers: permissions && permissions.canManageUsers === "on",
        canManageMedia: permissions && permissions.canManageMedia === "on",
        canManagePlaylists:
          permissions && permissions.canManagePlaylists === "on",
        canManagePlayers: permissions && permissions.canManagePlayers === "on",
        isAdmin: permissions && permissions.isAdmin === "on",
      },
    };

    // Faz a requisição para a API
    const response = await axios.put(
      `${process.env.API_URL || "http://177.71.165.181"}/api/groups/${
        req.params.id
      }`,
      data,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    req.flash("success", "Grupo atualizado com sucesso");
    res.redirect(`/groups/${req.params.id}`);
  } catch (error) {
    console.error(
      "Erro ao atualizar grupo:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Erro ao atualizar grupo"
    );
    res.redirect(`/groups/${req.params.id}/edit`);
  }
});

// Rota para excluir um grupo
router.get("/groups/:id/delete", webAuth, webAdminOnly, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Faz a requisição para a API para excluir o grupo
    const response = await axios.delete(`/api/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${req.session.token}`,
      },
      baseURL: `http://localhost:${process.env.PORT || 3000}`,
    });

    if (response.data.success) {
      req.flash("success", "Grupo excluído com sucesso");
    } else {
      req.flash("error", response.data.message || "Erro ao excluir grupo");
    }

    return res.redirect("/groups");
  } catch (error) {
    console.error(
      "Erro ao excluir grupo:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message ||
        "Não foi possível excluir o grupo. Verifique se não há usuários associados a ele."
    );
    return res.redirect("/groups");
  }
});

// Rota para listar todas as mídias
router.get("/media", webAuth, async (req, res) => {
  try {
    const Media = require("../models/media.model");
    const Group = require("../models/group.model");
    const Playlist = require("../models/playlist.model");

    // Parâmetros de paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Filtros de grupo para usuários não admin
    let groupFilter = {};
    if (req.session.user.role !== "admin") {
      groupFilter = { group: req.session.user.group };
    }

    // Buscar mídias disponíveis para o usuário
    const [media, total, groups, playlists] = await Promise.all([
      Media.find(groupFilter)
        .populate("group")
        .populate("uploadedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Media.countDocuments(groupFilter),
      Group.find({ active: true }).sort({ name: 1 }),
      // Buscar playlists disponíveis para o usuário (apenas ativas)
      Playlist.find({
        ...(req.session.user.role === "admin"
          ? {}
          : { group: req.session.user.group }),
        active: true, // Adicionar filtro para apenas playlists ativas
      }).sort({ name: 1 }),
    ]);

    // Calcular páginas para paginação
    const totalPages = Math.ceil(total / limit);

    res.render("media/index", {
      title: "Biblioteca de Mídias",
      media: media,
      groups: groups,
      playlists: playlists, // Passar as playlists para o template
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: total,
      },
      active: "media",
    });
  } catch (error) {
    console.error("Erro ao listar mídias:", error);
    req.flash("error", "Erro ao carregar biblioteca de mídias");
    res.redirect("/dashboard");
  }
});

router.get("/media/new", webAuth, async (req, res) => {
  try {
    const Group = require("../models/group.model");

    // Buscar grupos disponíveis (apenas admin pode ver todos os grupos)
    let groups = [];
    if (req.session.user.role === "admin") {
      groups = await Group.find({ active: true }).sort({ name: 1 });
    } else {
      groups = await Group.find({ _id: req.session.user.group, active: true });
    }

    res.render("media/form", {
      title: "Nova Mídia",
      groups: groups,
      active: "media",
    });
  } catch (error) {
    console.error("Erro ao carregar formulário de mídia:", error);
    req.flash("error", "Erro ao carregar formulário");
    res.redirect("/media");
  }
});

// Rota para processar o upload de mídia
router.post(
  "/media/upload",
  webAuth,
  upload.array("mediaFile", 10), // Permite até 10 arquivos
  async (req, res) => {
    try {
      const { description, group } = req.body;

      // Verificar se arquivos foram enviados
      if (!req.files || req.files.length === 0) {
        req.flash("error", "Nenhum arquivo enviado");
        return res.redirect("/media/new");
      }

      // Usar Promise.all para processar todos os uploads em paralelo
      const uploadPromises = req.files.map(async (file) => {
        try {
          // Determinar o tipo de mídia (imagem, vídeo ou HTML)
          const isImage = file.mimetype.startsWith("image/");
          const isVideo = file.mimetype.startsWith("video/");
          const isHtml = file.mimetype === "text/html";
          const mediaType = isImage
            ? "image"
            : isVideo
            ? "video"
            : isHtml
            ? "html"
            : "unknown";

          if (mediaType === "unknown") {
            // Remover o arquivo temporário
            fs.unlinkSync(file.path);
            return {
              success: false,
              message: `Arquivo "${file.originalname}" não suportado. Apenas imagens, vídeos e HTML são permitidos.`,
            };
          }

          // Ler o arquivo como um buffer
          const fileBuffer = fs.readFileSync(file.path);

          // Criar um FormData para enviar para a API
          const formData = new FormData();
          // Usar o nome do arquivo sem a extensão como nome da mídia
          const mediaName = file.originalname.split(".").slice(0, -1).join(".");
          formData.append("name", mediaName);
          formData.append("description", description || "");

          // Extrair o ID do grupo corretamente
          let groupId;
          if (group) {
            groupId = group;
          } else if (req.session.user.group) {
            groupId = req.session.user.group._id
              ? req.session.user.group._id.toString()
              : req.session.user.group.toString();
          }

          formData.append("group", groupId);
          formData.append("type", mediaType);

          // Adicionar o arquivo como um buffer
          formData.append("file", fileBuffer, {
            filename: file.originalname,
            contentType: file.mimetype,
          });

          // Fazer a requisição para a API com timeout ampliado
          const response = await axios.post("/api/media", formData, {
            headers: {
              Authorization: `Bearer ${req.session.token}`,
              ...formData.getHeaders(),
            },
            baseURL: `http://localhost:${process.env.PORT || 3000}`,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 30000, // Timeout de 30 segundos para evitar problemas de conexão
          });

          // Remover o arquivo temporário após o upload
          fs.unlinkSync(file.path);

          return {
            success: true,
            message: `Mídia "${mediaName}" enviada com sucesso`,
          };
        } catch (error) {
          console.error("Erro no upload:", error.message);
          // Remover o arquivo temporário em caso de erro
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          return {
            success: false,
            message: `Erro ao enviar "${file.originalname}": ${
              error.response?.data?.message || error.message
            }`,
          };
        }
      });

      // Aguardar todos os uploads terminarem
      const results = await Promise.all(uploadPromises);

      // Contar sucessos e falhas
      const successes = results.filter((r) => r.success).length;
      const failures = results.filter((r) => !r.success).length;

      // Preparar mensagem de feedback
      if (failures === 0) {
        req.flash(
          "success",
          `${successes} mídia${successes !== 1 ? "s" : ""} enviada${
            successes !== 1 ? "s" : ""
          } com sucesso`
        );
      } else if (successes === 0) {
        req.flash(
          "error",
          `Falha ao enviar ${failures} mídia${failures !== 1 ? "s" : ""}`
        );
      } else {
        req.flash(
          "warning",
          `${successes} mídia${successes !== 1 ? "s" : ""} enviada${
            successes !== 1 ? "s" : ""
          } com sucesso, ${failures} falha${failures !== 1 ? "s" : ""}`
        );
      }

      // Adicionar detalhes das falhas se houver
      const failureMessages = results
        .filter((r) => !r.success)
        .map((r) => r.message);
      if (failureMessages.length > 0) {
        req.flash("error", failureMessages.join("\n"));
      }

      res.redirect("/media");
    } catch (error) {
      console.error("Erro ao fazer upload de mídia:", error);

      // Remover os arquivos temporários em caso de erro
      if (req.files) {
        req.files.forEach((file) => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      req.flash(
        "error",
        error.response?.data?.message || "Erro ao fazer upload de mídia"
      );
      res.redirect("/media/new");
    }
  }
);

router.get("/media/:id", webAuth, webSameGroupOrAdmin, async (req, res) => {
  try {
    const Media = require("../models/media.model");

    // Buscar a mídia
    const media = await Media.findById(req.params.id)
      .populate("group")
      .populate("uploadedBy");

    if (!media) {
      req.flash("error", "Mídia não encontrada");
      return res.redirect("/media");
    }

    // Adicionar a URL da mídia para visualização
    const baseUrl =
      process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
    media.url = `${baseUrl}/api/media/${media._id}/file`;

    res.render("media/view", {
      title: `Mídia - ${media.name}`,
      media: media,
    });
  } catch (error) {
    console.error("Erro ao buscar mídia:", error);
    req.flash("error", "Erro ao buscar mídia");
    res.redirect("/media");
  }
});

router.get(
  "/media/:id/edit",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Media = require("../models/media.model");
      const Group = require("../models/group.model");

      // Buscar a mídia
      const media = await Media.findById(req.params.id).populate("group");

      if (!media) {
        req.flash("error", "Mídia não encontrada");
        return res.redirect("/media");
      }

      // Buscar grupos disponíveis (apenas admin pode ver todos os grupos)
      let groups = [];
      if (req.session.user.role === "admin") {
        groups = await Group.find({ active: true }).sort({ name: 1 });
      } else {
        groups = await Group.find({
          _id: req.session.user.group,
          active: true,
        });
      }

      res.render("media/form", {
        title: "Editar Mídia",
        mediaId: req.params.id,
        media: media,
        groups: groups,
      });
    } catch (error) {
      console.error("Erro ao buscar mídia para edição:", error);
      req.flash("error", "Erro ao buscar mídia para edição");
      res.redirect("/media");
    }
  }
);

// Rota para atualizar mídia
router.post(
  "/media/:id/update",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const { name, description, group } = req.body;

      // Prepara os dados para enviar para a API
      const data = {
        name,
        description: description || "",
        group: group || req.session.user.group._id,
      };

      // Faz a requisição para a API
      const response = await axios.put(
        `${process.env.API_URL || "http://177.71.165.181"}/api/media/${
          req.params.id
        }`,
        data,
        {
          headers: {
            Authorization: `Bearer ${req.session.token}`,
          },
        }
      );

      req.flash("success", "Mídia atualizada com sucesso");
      res.redirect(`/media/${req.params.id}`);
    } catch (error) {
      console.error(
        "Erro ao atualizar mídia:",
        error.response?.data || error.message
      );
      req.flash(
        "error",
        error.response?.data?.message || "Erro ao atualizar mídia"
      );
      res.redirect(`/media/${req.params.id}/edit`);
    }
  }
);

// Rota para excluir mídia
router.get(
  "/media/:id/delete",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const mediaId = req.params.id;

      // Faz a requisição para a API para excluir a mídia
      const response = await axios.delete(`/api/media/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
        baseURL:
          process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`,
        timeout: 15000, // Timeout de 15 segundos
      });

      if (response.data.success) {
        req.flash("success", "Mídia excluída com sucesso");
      } else {
        req.flash("error", response.data.message || "Erro ao excluir mídia");
      }

      return res.redirect("/media");
    } catch (error) {
      console.error(
        "Erro ao excluir mídia:",
        error.response?.data || error.message
      );
      req.flash(
        "error",
        error.response?.data?.message || "Não foi possível excluir a mídia."
      );
      return res.redirect("/media");
    }
  }
);

// Rotas para playlists
router.get("/playlists", webAuth, async (req, res) => {
  try {
    const Playlist = require("../models/playlist.model");
    const Group = require("../models/group.model");

    // Filtro para usuários não-admin (apenas ver itens do seu grupo)
    const filter =
      req.session.user.role !== "admin" && req.session.user.group
        ? { group: req.session.user.group._id }
        : {};

    // Buscar todas as playlists (incluindo ativas e inativas)
    const playlists = await Playlist.find(filter)
      .populate("group")
      .populate("thumbnail")
      .populate({
        path: "items.media",
        model: "Media",
      })
      .populate({
        path: "items.subPlaylist",
        select: "name description items",
      })
      .populate({
        path: "items.rss",
        select: "name url active",
      })
      .sort({ createdAt: -1 });

    // Filtra itens com referências inválidas
    for (const playlist of playlists) {
      playlist.items = playlist.items.filter(
        (item) =>
          (item.type === "media" && item.media) ||
          (item.type === "playlist" && item.subPlaylist) ||
          (item.type === "rss" && item.rss)
      );
    }

    // Buscar todos os grupos para o filtro
    const groups = await Group.find({ active: true }).sort({ name: 1 });

    res.render("playlists/index", {
      title: "Playlists",
      playlists: playlists,
      groups: groups,
      active: "playlists",
    });
  } catch (error) {
    console.error("Erro ao listar playlists:", error);
    res.render("playlists/index", {
      title: "Playlists",
      error: "Erro ao carregar playlists",
      playlists: [],
      groups: [],
      active: "playlists",
    });
  }
});

router.get("/playlists/new", webAuth, async (req, res) => {
  try {
    const Group = require("../models/group.model");
    const Media = require("../models/media.model");

    // Buscar grupos disponíveis (apenas admin pode ver todos os grupos)
    let groups = [];
    if (req.session.user.role === "admin") {
      groups = await Group.find({ active: true }).sort({ name: 1 });
    } else {
      groups = await Group.find({ _id: req.session.user.group, active: true });
    }

    // Buscar imagens disponíveis para thumbnails
    let mediaQuery = { type: "image", active: true };
    if (req.session.user.role !== "admin") {
      mediaQuery.group = req.session.user.group._id;
    }
    const mediaItems = await Media.find(mediaQuery).sort({ name: 1 });

    res.render("playlists/form", {
      title: "Nova Playlist",
      groups: groups,
      active: "playlists",
    });
  } catch (error) {
    console.error("Erro ao carregar formulário de playlist:", error);
    req.flash("error", "Erro ao carregar formulário");
    res.redirect("/playlists");
  }
});

// Rota específica para /playlists/add (deve vir antes da rota /:id)
router.get("/playlists/add", webAuth, async (req, res) => {
  try {
    const Group = require("../models/group.model");
    const RSS = require("../models/rss.model");

    // Verificar se há rssId como parâmetro de consulta
    const rssId = req.query.rssId;
    let rssItem = null;

    if (rssId) {
      // Se houver rssId, buscar a fonte RSS
      rssItem = await RSS.findById(rssId);

      if (!rssItem) {
        req.flash("error", "Fonte RSS não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem acesso ao grupo da fonte RSS
      if (!req.user.groups.includes(rssItem.group.toString())) {
        req.flash("error", "Você não tem permissão para usar esta fonte RSS");
        return res.redirect("/playlists");
      }
    }

    // Buscar grupos do usuário
    const groups = await Group.find({ _id: { $in: req.user.groups } });

    res.render("playlists/add", {
      title: "Nova Playlist",
      groups,
      user: req.user,
      rssItem, // Passar a fonte RSS para a view, se existir
    });
  } catch (error) {
    console.error("Erro ao exibir formulário de nova playlist:", error);
    req.flash(
      "error",
      "Erro ao carregar o formulário. Por favor, tente novamente."
    );
    res.redirect("/playlists");
  }
});

router.get("/playlists/:id", webAuth, webSameGroupOrAdmin, async (req, res) => {
  try {
    const Playlist = require("../models/playlist.model");
    const Player = require("../models/player.model");

    // Buscar a playlist
    const playlist = await Playlist.findById(req.params.id)
      .populate("group")
      .populate("thumbnail")
      .populate({
        path: "items.media",
        select: "name type duration filePath",
      })
      .populate({
        path: "items.subPlaylist",
        select: "name description items",
      })
      .populate({
        path: "items.rss",
        select: "name url active",
      });

    if (!playlist) {
      req.flash("error", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Buscar players associados a esta playlist
    const players = await Player.find({ playlist: playlist._id });

    // Filtrar itens com mídia nula (excluída)
    const originalItemsCount = playlist.items.length;
    playlist.items = playlist.items.filter(
      (item) =>
        (item.type === "media" && item.media) ||
        (item.type === "playlist" && item.subPlaylist) ||
        (item.type === "rss" && item.rss)
    );

    // Se foram removidos itens, mostrar mensagem
    if (originalItemsCount > playlist.items.length) {
      req.flash(
        "warning",
        `${
          originalItemsCount - playlist.items.length
        } item(s) com mídia excluída foram removidos da visualização.`
      );
    }

    res.render("playlists/view", {
      title: `Playlist - ${playlist.name}`,
      playlist: playlist,
      active: "playlists",
    });
  } catch (error) {
    console.error("Erro ao buscar playlist:", error);
    req.flash("error", "Erro ao buscar playlist");
    res.redirect("/playlists");
  }
});

router.get(
  "/playlists/:id/edit",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");
      const Group = require("../models/group.model");
      const Media = require("../models/media.model");
      const RSS = require("../models/rss.model");

      // Buscar a playlist
      const playlist = await Playlist.findById(req.params.id)
        .populate("group")
        .populate("thumbnail")
        .populate({
          path: "items.media",
          select: "name type duration filePath",
        })
        .populate({
          path: "items.subPlaylist",
          select: "name description items",
        })
        .populate({
          path: "items.rss",
          select: "name url active",
        });

      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Filtrar itens com referências inválidas
      playlist.items = playlist.items.filter(
        (item) =>
          (item.type === "media" && item.media) ||
          (item.type === "playlist" && item.subPlaylist) ||
          (item.type === "rss" && item.rss)
      );

      // Buscar grupos disponíveis (apenas admin pode ver todos os grupos)
      let groups = [];
      if (req.session.user.role === "admin") {
        groups = await Group.find({ active: true }).sort({ name: 1 });
      } else {
        groups = await Group.find({
          _id: req.session.user.group,
          active: true,
        });
      }

      // Buscar imagens disponíveis para thumbnails
      let mediaQuery = { type: "image", active: true };
      if (req.session.user.role !== "admin") {
        mediaQuery.group = req.session.user.group._id;
      }
      const mediaItems = await Media.find(mediaQuery).sort({ name: 1 });

      res.render("playlists/form", {
        title: "Editar Playlist",
        playlist: playlist,
        groups: groups,
        active: "playlists",
      });
    } catch (error) {
      console.error("Erro ao buscar playlist para edição:", error);
      req.flash("error", "Erro ao buscar playlist para edição");
      res.redirect("/playlists");
    }
  }
);

// Rota para criar uma playlist
router.post(
  "/playlists/create",
  webAuth,
  upload.single("thumbnail"),
  async (req, res) => {
    try {
      const { name, description, group, remove_thumbnail } = req.body;

      // Prepara os dados para enviar para a API
      const data = {
        name,
        description: description || "",
        group: group || req.session.user.group._id,
      };

      // Se o usuário fez upload de uma imagem, processar
      if (req.file) {
        try {
          // Ler o arquivo como um buffer
          const fileBuffer = fs.readFileSync(req.file.path);

          // Criar um FormData para enviar o arquivo para a API
          const formData = new FormData();
          formData.append("name", `Thumbnail-${name}-${Date.now()}`);
          formData.append("description", `Thumbnail para a playlist ${name}`);
          formData.append("type", "image");
          formData.append("group", data.group);

          // Adicionar o arquivo como um buffer - usando o nome de campo correto
          formData.append("file", fileBuffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
          });

          // Enviar arquivo para a API de mídia
          const mediaResponse = await axios.post(
            `${process.env.API_URL || "http://177.71.165.181"}/api/media`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${req.session.token}`,
                ...formData.getHeaders(),
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
            }
          );

          // Adicionar ID da mídia como thumbnail da playlist
          if (mediaResponse.data && mediaResponse.data.data) {
            data.thumbnail = mediaResponse.data.data._id;
          }

          // Remover arquivo temporário
          fs.unlinkSync(req.file.path);
        } catch (mediaError) {
          console.error("Erro ao processar thumbnail:", mediaError);
          req.flash(
            "warning",
            "Erro ao processar a imagem de thumbnail, a playlist será criada sem imagem."
          );
        }
      }

      // Faz a requisição para a API
      const response = await axios.post(
        `${process.env.API_URL || "http://177.71.165.181"}/api/playlists`,
        data,
        {
          headers: {
            Authorization: `Bearer ${req.session.token}`,
          },
        }
      );

      req.flash("success", "Playlist criada com sucesso");
      res.redirect(`/playlists/${response.data.data._id}`);
    } catch (error) {
      console.error(
        "Erro ao criar playlist:",
        error.response?.data || error.message
      );

      // Limpar arquivo temporário se existir
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Erro ao remover arquivo temporário:", unlinkError);
        }
      }

      req.flash(
        "error",
        error.response?.data?.message || "Erro ao criar playlist"
      );
      res.redirect("/playlists/new");
    }
  }
);

// Rota para atualizar uma playlist
router.post(
  "/playlists/:id/update",
  webAuth,
  webSameGroupOrAdmin,
  upload.single("thumbnail"),
  async (req, res) => {
    try {
      const {
        name,
        description,
        group,
        remove_thumbnail,
        keep_existing_thumbnail,
      } = req.body;

      // Prepara os dados para enviar para a API
      const data = {
        name,
        description: description || "",
        group: group || req.session.user.group._id,
      };

      // Se o usuário quer remover a thumbnail
      if (remove_thumbnail === "true") {
        data.thumbnail = null;
      }
      // Se o usuário fez upload de uma imagem nova
      else if (req.file) {
        try {
          // Ler o arquivo como um buffer
          const fileBuffer = fs.readFileSync(req.file.path);

          // Criar um FormData para enviar o arquivo para a API
          const formData = new FormData();
          formData.append("name", `Thumbnail-${name}-${Date.now()}`);
          formData.append("description", `Thumbnail para a playlist ${name}`);
          formData.append("type", "image");
          formData.append("group", data.group);

          // Adicionar o arquivo como um buffer - usando o nome de campo correto
          formData.append("file", fileBuffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
          });

          // Enviar arquivo para a API de mídia
          const mediaResponse = await axios.post(
            `${process.env.API_URL || "http://177.71.165.181"}/api/media`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${req.session.token}`,
                ...formData.getHeaders(),
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
            }
          );

          // Adicionar ID da mídia como thumbnail da playlist
          if (mediaResponse.data && mediaResponse.data.data) {
            data.thumbnail = mediaResponse.data.data._id;
          }

          // Remover arquivo temporário
          fs.unlinkSync(req.file.path);
        } catch (mediaError) {
          console.error("Erro ao processar thumbnail:", mediaError);
          req.flash(
            "warning",
            "Erro ao processar a imagem de thumbnail, a playlist será atualizada sem alterar a imagem."
          );
        }
      }
      // Se o usuário não quer manter a thumbnail existente (e não enviou uma nova)
      else if (keep_existing_thumbnail === "false" && !req.file) {
        data.thumbnail = null;
      }
      // Caso contrário, não incluir thumbnail no payload (manter a existente)

      // Faz a requisição para a API
      const response = await axios.put(
        `${process.env.API_URL || "http://177.71.165.181"}/api/playlists/${
          req.params.id
        }`,
        data,
        {
          headers: {
            Authorization: `Bearer ${req.session.token}`,
          },
        }
      );

      req.flash("success", "Playlist atualizada com sucesso");
      res.redirect(`/playlists/${req.params.id}`);
    } catch (error) {
      console.error(
        "Erro ao atualizar playlist:",
        error.response?.data || error.message
      );

      // Limpar arquivo temporário se existir
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Erro ao remover arquivo temporário:", unlinkError);
        }
      }

      req.flash(
        "error",
        error.response?.data?.message || "Erro ao atualizar playlist"
      );
      res.redirect(`/playlists/${req.params.id}/edit`);
    }
  }
);

// Rota para excluir uma playlist
router.post(
  "/playlists/:id/delete",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const playlistId = req.params.id;

      // Faz a requisição para a API para excluir a playlist
      const response = await axios.delete(`/api/playlists/${playlistId}`, {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
        baseURL: `http://localhost:${process.env.PORT || 3000}`,
      });

      if (response.data.success) {
        req.flash("success", "Playlist excluída com sucesso");
        return res.redirect("/playlists");
      } else {
        req.flash("error", response.data.message || "Erro ao excluir playlist");
        return res.redirect(`/playlists/${playlistId}`);
      }
    } catch (error) {
      console.error("Erro ao excluir playlist:", error);
      req.flash("error", "Erro ao excluir playlist");
      return res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para adicionar item à playlist - IMPLEMENTAÇÃO DIRETA
router.post(
  "/playlists/:id/items",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const playlistId = req.params.id;
      const {
        mediaId,
        duration,
        existingItems,
        startDateTime,
        endDateTime,
        order,
      } = req.body;

      // Validar dados
      if (!mediaId) {
        req.flash("error", "Mídia não selecionada");
        return res.redirect(`/playlists/${playlistId}/items/add`);
      }

      // Carregar os modelos necessários
      const Playlist = require("../models/playlist.model");
      const Media = require("../models/media.model");

      // Verificar se a playlist existe
      const playlist = await Playlist.findById(playlistId);
      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se a mídia existe
      const media = await Media.findById(mediaId);
      if (!media) {
        req.flash("error", "Mídia não encontrada");
        return res.redirect(`/playlists/${playlistId}/items/add`);
      }

      // Converter para número se não for undefined
      const durationNum = duration ? parseInt(duration, 10) : undefined;
      const orderNum = order ? parseInt(order, 10) : undefined;

      // Calcular duração apropriada se não fornecida
      let itemDuration = durationNum;
      if (!itemDuration) {
        if (media.type === "video" && media.duration) {
          itemDuration = media.duration;
        } else if (media.type === "image") {
          itemDuration = 10; // Padrão para imagens: 10 segundos
        } else {
          itemDuration = 30; // Padrão para outros tipos: 30 segundos
        }
      }

      // Calcular o próximo order se não especificado
      let itemOrder = orderNum;
      if (!itemOrder && itemOrder !== 0) {
        const lastOrder =
          playlist.items.length > 0
            ? Math.max(
                ...playlist.items.map((item) =>
                  typeof item.order === "number" ? item.order : 0
                )
              )
            : -1;
        itemOrder = lastOrder + 1;
      }

      // Criar o novo item
      const newItem = {
        media: media._id,
        duration: itemDuration,
        order: itemOrder,
        type: "media",
      };

      // Adicionar data e hora de início e fim se fornecidos
      if (startDateTime) {
        newItem.startDateTime = new Date(startDateTime);
      }

      if (endDateTime) {
        newItem.endDateTime = new Date(endDateTime);
      }

      // Adicionar o novo item à playlist
      playlist.items.push(newItem);

      // Registrar o usuário que fez a modificação
      playlist.lastModifiedBy = req.session.user._id;

      // Salvar a playlist atualizada
      await playlist.save();

      // Notificar players sobre a atualização (se houver esse serviço)
      try {
        const notifyPlayersService = require("../services/notifyPlayers.service");
        await notifyPlayersService.notifyPlaylistUpdate(playlistId);
      } catch (error) {
        console.warn(
          "Não foi possível notificar os players sobre a atualização:",
          error.message
        );
      }

      req.flash("success", "Item adicionado à playlist com sucesso");
      return res.redirect(`/playlists/${playlistId}`);
    } catch (error) {
      console.error("Erro ao adicionar item à playlist:", error);
      req.flash("error", "Erro ao adicionar item à playlist: " + error.message);
      return res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para editar um item da playlist
router.get(
  "/playlists/:id/items/:itemId/edit",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");
      const Media = require("../models/media.model");

      // Buscar a playlist
      const playlist = await Playlist.findById(req.params.id)
        .populate("group")
        .populate({
          path: "items.media",
          select: "name type",
        });

      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem permissão para editar esta playlist
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group._id.toString()
      ) {
        req.flash("error", "Você não tem permissão para editar esta playlist");
        return res.redirect("/playlists");
      }

      // Buscar o item específico
      const item = playlist.items.find(
        (item) => item._id.toString() === req.params.itemId
      );

      if (!item) {
        req.flash("error", "Item não encontrado");
        return res.redirect(`/playlists/${req.params.id}`);
      }

      // Buscar a mídia completa para exibir na pré-visualização
      const media = await Media.findById(item.media);
      if (!media) {
        req.flash("error", "Mídia do item não encontrada");
        return res.redirect(`/playlists/${req.params.id}`);
      }

      // Criar uma cópia do item para não modificar o original
      const itemWithFullMedia = {
        ...item.toObject(),
        media: media,
      };

      res.render("playlists/edit-item", {
        title: "Editar Item da Playlist",
        playlistId: req.params.id,
        item: itemWithFullMedia,
      });
    } catch (error) {
      console.error("Erro ao carregar formulário de edição de item:", error);
      req.flash("error", "Erro ao carregar formulário de edição de item");
      res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para atualizar um item da playlist
router.post(
  "/playlists/:id/items/:itemId/update",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const { duration, order, startDateTime, endDateTime, clearSchedule } =
        req.body;
      const playlistId = req.params.id;
      const itemId = req.params.itemId;

      console.log("Atualizando item da playlist com dados:", {
        itemId,
        duration,
        order,
        startDateTime,
        endDateTime,
        clearSchedule,
      });

      // Preparar os dados para atualização do item
      const updateData = {
        duration: parseInt(duration) || 0,
        order: parseInt(order) || 0,
      };

      // Processar agendamento
      if (clearSchedule) {
        // Se a opção de limpar agendamento estiver marcada, enviar valores nulos
        updateData.startDateTime = null;
        updateData.endDateTime = null;
        console.log("Removendo agendamento do item");
      } else {
        // Caso contrário, atualizar com os valores fornecidos
        if (startDateTime) {
          updateData.startDateTime = new Date(startDateTime);
          console.log("Definindo data de início:", updateData.startDateTime);
        }
        if (endDateTime) {
          updateData.endDateTime = new Date(endDateTime);
          console.log("Definindo data de fim:", updateData.endDateTime);
        }
      }

      // Faz a requisição para a API de atualização de item específico em vez da playlist inteira
      const response = await axios.put(
        `${
          process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`
        }/api/playlists/${playlistId}/items/${itemId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${req.session.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Resposta da API ao atualizar item:", response.data);
      req.flash("success", "Item atualizado com sucesso");
      res.redirect(`/playlists/${playlistId}`);
    } catch (error) {
      console.error("Erro ao atualizar item da playlist:", error);
      req.flash(
        "error",
        error.response?.data?.message || "Erro ao atualizar item da playlist"
      );
      res.redirect(
        `/playlists/${req.params.id}/items/${req.params.itemId}/edit`
      );
    }
  }
);

// Rota para excluir um item da playlist (método GET)
router.get(
  "/playlists/:id/items/:itemId/delete",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const playlistId = req.params.id;
      const itemId = req.params.itemId;

      // Buscar a playlist atual para obter os itens existentes
      const Playlist = require("../models/playlist.model");
      const playlist = await Playlist.findById(playlistId).populate("group");

      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem permissão para editar esta playlist
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group._id.toString()
      ) {
        req.flash("error", "Você não tem permissão para editar esta playlist");
        return res.redirect("/playlists");
      }

      // Remover o item específico
      const updatedItems = playlist.items.filter(
        (item) => item._id.toString() !== itemId
      );

      // Faz a requisição para a API
      const response = await axios.put(
        `${
          process.env.API_URL || "http://177.71.165.181"
        }/api/playlists/${playlistId}`,
        {
          items: updatedItems,
        },
        {
          headers: {
            Authorization: `Bearer ${req.session.token}`,
          },
        }
      );

      req.flash("success", "Item removido com sucesso");
      res.redirect(`/playlists/${playlistId}`);
    } catch (error) {
      console.error("Erro ao remover item da playlist:", error);
      req.flash(
        "error",
        error.response?.data?.message || "Erro ao remover item da playlist"
      );
      res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para excluir um item da playlist (método POST)
router.post(
  "/playlists/:id/items/:itemId/delete",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const playlistId = req.params.id;
      const itemId = req.params.itemId;

      // Buscar a playlist atual para obter os itens existentes
      const Playlist = require("../models/playlist.model");
      const playlist = await Playlist.findById(playlistId).populate("group");

      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem permissão para editar esta playlist
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group._id.toString()
      ) {
        req.flash("error", "Você não tem permissão para editar esta playlist");
        return res.redirect("/playlists");
      }

      // Remover o item específico
      const updatedItems = playlist.items.filter(
        (item) => item._id.toString() !== itemId
      );

      // Atualizar playlist no banco de dados
      playlist.items = updatedItems;
      playlist.lastModifiedBy = req.session.user._id;
      await playlist.save();

      // Notificar players sobre a atualização
      try {
        const notifyPlayersService = require("../services/notifyPlayers.service");
        await notifyPlayersService.notifyPlaylistUpdate(playlistId);
      } catch (error) {
        console.warn(
          "Não foi possível notificar os players sobre a atualização:",
          error.message
        );
      }

      req.flash("success", "Item removido com sucesso");
      res.redirect(`/playlists/${playlistId}`);
    } catch (error) {
      console.error("Erro ao remover item da playlist:", error);
      req.flash(
        "error",
        error.response?.data?.message || "Erro ao remover item da playlist"
      );
      res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para exportar a playlist
router.get(
  "/playlists/:id/export",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const playlistId = req.params.id;

      // Verificar se a playlist existe e se o usuário tem permissão
      const Playlist = require("../models/playlist.model");
      const playlist = await Playlist.findById(playlistId).populate("group");

      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem permissão para acessar esta playlist
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group._id.toString()
      ) {
        req.flash("error", "Você não tem permissão para acessar esta playlist");
        return res.redirect("/playlists");
      }

      // Faz a requisição para a API
      const response = await axios.get(`/api/playlists/${playlistId}/export`, {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
        baseURL: `http://localhost:${process.env.PORT || 3000}`,
      });

      // Retorna os dados da playlist exportada
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="playlist-${playlistId}.json"`
      );
      res.send(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error("Erro ao exportar playlist:", error);
      req.flash(
        "error",
        error.response?.data?.message || "Erro ao exportar playlist"
      );
      res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para visualizar a playlist (preview)
router.get(
  "/playlists/:id/preview",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");

      // Buscar a playlist com os itens
      const playlist = await Playlist.findById(req.params.id)
        .populate("group")
        .populate({
          path: "items.media",
          select: "name type duration filePath",
        })
        .populate({
          path: "items.subPlaylist",
          select: "name description items",
        });

      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem permissão para visualizar esta playlist
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group._id.toString()
      ) {
        req.flash(
          "error",
          "Você não tem permissão para visualizar esta playlist"
        );
        return res.redirect("/playlists");
      }

      // Filtrar itens com mídia nula (excluída)
      const originalItemsCount = playlist.items.length;
      playlist.items = playlist.items.filter((item) => item.media);

      // Se foram removidos itens, mostrar mensagem
      if (originalItemsCount > playlist.items.length) {
        req.flash(
          "warning",
          `${
            originalItemsCount - playlist.items.length
          } item(s) com mídia excluída foram removidos da visualização.`
        );
      }

      // Se não houver itens válidos, redirecionar
      if (playlist.items.length === 0) {
        req.flash(
          "error",
          "Esta playlist não contém itens válidos para visualização. Todas as mídias foram excluídas."
        );
        return res.redirect(`/playlists/${playlist._id}`);
      }

      res.render("playlists/preview", {
        title: `Visualizando: ${playlist.name}`,
        playlist: playlist,
      });
    } catch (error) {
      console.error("Erro ao visualizar playlist:", error);
      req.flash("error", "Erro ao visualizar playlist");
      res.redirect(`/playlists`);
    }
  }
);

// Rota para reinicializar índices do Player
router.get("/reset-player-indexes", webAuth, webAdminOnly, async (req, res) => {
  try {
    const Player = require("../models/player.model");

    // Remove todos os índices
    await Player.collection.dropIndexes();

    // Recria os índices necessários
    await Player.collection.createIndex({ player_key: 1 }, { unique: true });
    await Player.collection.createIndex(
      { hardware_id: 1 },
      { unique: true, sparse: true }
    );
    await Player.collection.createIndex({ group: 1 });
    await Player.collection.createIndex({ status: 1 });
    await Player.collection.createIndex({ active: 1 });

    req.flash("success", "Índices reinicializados com sucesso");
    res.redirect("/players");
  } catch (error) {
    console.error("Erro ao reinicializar índices:", error);
    req.flash("error", "Erro ao reinicializar índices");
    res.redirect("/players");
  }
});

// Rotas de players
router.get("/players", webAuth, playerController.listPlayers);
router.get("/players/new", webAuth, playerController.newPlayerForm);
router.post("/players/create", webAuth, playerController.createPlayer);
router.get(
  "/players/:id",
  webAuth,
  webSameGroupOrAdmin,
  playerController.viewPlayer
);
router.get(
  "/players/:id/edit",
  webAuth,
  webSameGroupOrAdmin,
  playerController.editPlayerForm
);
router.post(
  "/players/:id/update",
  webAuth,
  webSameGroupOrAdmin,
  playerController.updatePlayer
);
router.post(
  "/players/:id/assign-playlist",
  webAuth,
  webSameGroupOrAdmin,
  playerController.assignPlaylist
);

// Rota para deletar player
router.post(
  "/players/:id/delete",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Player = require("../models/player.model");
      const playerId = req.params.id;

      // Buscar o player para verificar permissões
      const player = await Player.findById(playerId);
      if (!player) {
        req.flash("error", "Player não encontrado");
        return res.redirect("/players");
      }

      // Deletar o player
      await Player.findByIdAndDelete(playerId);

      req.flash("success", "Player excluído com sucesso");
      res.redirect("/players");
    } catch (error) {
      console.error("Erro ao excluir player:", error);
      req.flash("error", "Erro ao excluir player");
      res.redirect("/players");
    }
  }
);

// Rota para gerar nova chave de player
router.post(
  "/players/generate-key",
  webAuth,
  webAdminOnly,
  async (req, res) => {
    try {
      // Gerar uma nova chave aleatória
      const crypto = require("crypto");
      const newKey = crypto.randomBytes(32).toString("hex");

      // Obter dados do formulário
      const { name, description, group, playlist, authorized } = req.body;

      // Validar dados obrigatórios
      if (!name || !group) {
        req.flash("error", "Nome e grupo são obrigatórios");
        return res.redirect("/players");
      }

      // Salvar a chave no banco de dados
      const Player = require("../models/player.model");
      const player = new Player({
        name,
        description,
        player_key: newKey,
        group,
        playlist: playlist || null,
        authorized: authorized === "on",
        created_by: req.session.user._id,
      });

      await player.save();

      req.flash("success", "Nova chave de player gerada com sucesso");
      res.redirect("/players");
    } catch (error) {
      console.error("Erro ao gerar nova chave:", error);
      req.flash("error", "Erro ao gerar nova chave de player");
      res.redirect("/players");
    }
  }
);

// Rota para o perfil do usuário
router.get("/profile", webAuth, async (req, res) => {
  try {
    const User = require("../models/user.model");

    // Buscar o usuário com dados atualizados
    const user = await User.findById(req.session.user._id).populate("group");

    if (!user) {
      req.flash("error", "Usuário não encontrado");
      return res.redirect("/dashboard");
    }

    res.render("profile", {
      title: "Meu Perfil",
      user: user,
    });
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    req.flash("error", "Erro ao carregar perfil");
    res.redirect("/dashboard");
  }
});

// Rota para atualizar o perfil
router.post("/profile/update", webAuth, async (req, res) => {
  try {
    const { name, email } = req.body;

    // Faz a requisição para a API
    const response = await axios.put(
      `${process.env.API_URL || "http://177.71.165.181"}/api/users/${
        req.session.user._id
      }`,
      { name, email },
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    // Atualiza os dados do usuário na sessão
    req.session.user.name = name;
    req.session.user.email = email;

    req.flash("success", "Perfil atualizado com sucesso");
    res.redirect("/profile");
  } catch (error) {
    console.error(
      "Erro ao atualizar perfil:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Erro ao atualizar perfil"
    );
    res.redirect("/profile");
  }
});

// Rota para alterar a senha
router.post("/profile/change-password", webAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Verificar se as senhas coincidem
    if (newPassword !== confirmNewPassword) {
      req.flash("error", "As senhas não coincidem");
      return res.redirect("/profile");
    }

    // Faz a requisição para a API
    const response = await axios.post(
      `${
        process.env.API_URL || "http://177.71.165.181"
      }/api/auth/change-password`,
      { currentPassword, newPassword },
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      }
    );

    req.flash("success", "Senha alterada com sucesso");
    res.redirect("/profile");
  } catch (error) {
    console.error(
      "Erro ao alterar senha:",
      error.response?.data || error.message
    );
    req.flash(
      "error",
      error.response?.data?.message || "Erro ao alterar senha"
    );
    res.redirect("/profile");
  }
});

// Rota para desativar uma playlist (soft delete)
router.get(
  "/api/playlists/:id/delete",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const playlistId = req.params.id;

      // Faz a requisição para a API
      const response = await axios({
        method: "delete",
        url: `http://localhost:${
          process.env.PORT || 3000
        }/api/playlists/${playlistId}`,
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
      });

      req.flash("success", "Playlist desativada com sucesso");
      res.redirect("/playlists");
    } catch (error) {
      console.error("Erro ao desativar playlist:", error.message);
      req.flash("error", "Erro ao desativar playlist");
      res.redirect("/playlists");
    }
  }
);

// Rota para reativar uma playlist
router.get(
  "/api/playlists/:id/reactivate",
  webAuth,
  webAdminOnly,
  async (req, res) => {
    try {
      const playlistId = req.params.id;

      // Faz a requisição para a API para atualizar a playlist
      const response = await axios({
        method: "put",
        url: `http://localhost:${
          process.env.PORT || 3000
        }/api/playlists/${playlistId}`,
        headers: {
          Authorization: `Bearer ${req.session.token}`,
        },
        data: {
          active: true,
        },
      });

      req.flash("success", "Playlist reativada com sucesso");
      res.redirect("/playlists");
    } catch (error) {
      console.error("Erro ao reativar playlist:", error.message);
      req.flash("error", "Erro ao reativar playlist");
      res.redirect("/playlists");
    }
  }
);

// Rota para reordenar itens de uma playlist
router.post(
  "/api/playlists/:id/reorder",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");
      const playlistId = req.params.id;
      const { itemIds } = req.body;

      // Validações básicas
      if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
        return res.status(400).json({
          success: false,
          message: "ID da playlist inválido",
        });
      }

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Dados de ordenação inválidos",
        });
      }

      // Buscar a playlist
      const playlist = await Playlist.findById(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: "Playlist não encontrada",
        });
      }

      // Verificar permissão
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para editar esta playlist",
        });
      }

      // Criar um mapa dos itens atuais para fácil acesso
      const currentItems = {};
      playlist.items.forEach((item) => {
        currentItems[item._id.toString()] = item;
      });

      // Criar a nova lista de itens com a ordem atualizada
      const newItems = [];
      let hasInvalidItem = false;

      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];

        // Verificar se o ID é válido
        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
          console.error(`ID de item inválido: ${itemId}`);
          hasInvalidItem = true;
          continue;
        }

        // Verificar se o item existe na playlist
        const currentItem = currentItems[itemId];
        if (!currentItem) {
          console.error(`Item não encontrado na playlist: ${itemId}`);
          continue;
        }

        // Adicionar o item com a nova ordem
        const itemToAdd = currentItem.toObject();
        itemToAdd.order = i;
        newItems.push(itemToAdd);
      }

      if (hasInvalidItem) {
        console.warn("Alguns IDs de itens eram inválidos e foram ignorados");
      }

      if (newItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Nenhum item válido para reordenar",
        });
      }

      // Atualizar a playlist com os itens reordenados
      await Playlist.findByIdAndUpdate(
        playlistId,
        { items: newItems },
        { new: true }
      );

      // Notificar players sobre a atualização
      try {
        const notifyPlayersService = require("../services/notifyPlayers.service");
        await notifyPlayersService.notifyPlaylistUpdate(playlistId);
      } catch (error) {
        console.warn(
          "Não foi possível notificar os players sobre a atualização:",
          error.message
        );
      }

      res.json({
        success: true,
        message: "Ordem atualizada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao reordenar itens:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao reordenar itens: " + error.message,
      });
    }
  }
);

// Rota para adicionar itens à playlist (GET - formulário)
router.get(
  "/playlists/:id/items/add",
  webAuth,
  webSameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");
      const Media = require("../models/media.model");
      const Group = require("../models/group.model");

      // Buscar a playlist
      const playlist = await Playlist.findById(req.params.id).populate("group");
      if (!playlist) {
        req.flash("error", "Playlist não encontrada");
        return res.redirect("/playlists");
      }

      // Verificar se o usuário tem permissão para editar esta playlist
      if (
        req.session.user.role !== "admin" &&
        req.session.user.group._id.toString() !== playlist.group._id.toString()
      ) {
        req.flash("error", "Você não tem permissão para editar esta playlist");
        return res.redirect("/playlists");
      }

      // Buscar mídias disponíveis (do mesmo grupo da playlist)
      const medias = await Media.find({
        group: playlist.group._id,
      }).sort({ name: 1 });

      // Buscar fontes RSS disponíveis (do mesmo grupo da playlist)
      const RSS = require("../models/rss.model");
      const rssSources = await RSS.find({
        group: playlist.group._id,
        active: true,
      }).sort({ name: 1 });

      res.render("playlists/add-item", {
        title: "Adicionar Item à Playlist",
        playlistId: req.params.id,
        playlist: playlist,
        medias: medias,
        rssSources: rssSources || [],
      });
    } catch (error) {
      console.error("Erro ao carregar formulário de adição de item:", error);
      req.flash("error", "Erro ao carregar formulário de adição de item");
      res.redirect(`/playlists/${req.params.id}`);
    }
  }
);

// Rota para a página de configuração SAML (SSO)
router.get("/admin/saml-info", webAuth, webAdminOnly, async (req, res) => {
  try {
    const samlConfig = require("../config/saml.config");
    const appUrl = process.env.APP_URL || "https://cms.suaempresa.com.br";

    res.render("admin/saml-info", {
      title: "Configuração SAML (SSO)",
      samlConfig,
      appUrl,
      active: "settings",
    });
  } catch (error) {
    console.error("Erro ao carregar configuração SAML:", error);
    req.flash("error", "Erro ao carregar configuração SAML");
    res.redirect("/dashboard");
  }
});

// Rota para baixar arquivo de configuração SAML
router.get("/admin/saml-info/download", webAuth, webAdminOnly, (req, res) => {
  const samlController = require("../controllers/saml.controller");
  samlController.downloadConfig(req, res);
});

// Rota para a página de integração SAML com empresas parceiras
router.get(
  "/admin/saml-company-integration",
  webAuth,
  webAdminOnly,
  async (req, res) => {
    try {
      const samlConfig = require("../config/saml.config");
      const appUrl = process.env.APP_URL || "https://cms.suaempresa.com.br";

      res.render("admin/saml-company-integration", {
        title: "Integração SAML com Empresa Parceira",
        samlConfig,
        appUrl,
        active: "settings",
      });
    } catch (error) {
      console.error("Erro ao carregar página de integração SAML:", error);
      req.flash("error", "Erro ao carregar página de integração SAML");
      res.redirect("/admin/saml-info");
    }
  }
);

module.exports = router;
