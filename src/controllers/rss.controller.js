const RSS = require("../models/rss.model");
const Group = require("../models/group.model");
const Playlist = require("../models/playlist.model");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// Listar todas as fontes RSS
exports.getAllRSS = async (req, res) => {
  try {
    const rssItems = await RSS.find({ group: { $in: req.user.groups } })
      .populate("group")
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name")
      .sort({ createdAt: -1 });

    res.render("rss/index", {
      title: "Fontes RSS",
      rssItems,
      user: req.user,
    });
  } catch (error) {
    req.flash("error", "Erro ao buscar fontes RSS: " + error.message);
    res.redirect("/dashboard");
  }
};

// Exibir formulário para adicionar nova fonte RSS
exports.getAddRSS = async (req, res) => {
  try {
    // Verificar se o usuário tem um grupo
    if (!req.user.group) {
      req.flash(
        "error",
        "Você não tem um grupo atribuído. Entre em contato com um administrador."
      );
      return res.redirect("/dashboard");
    }

    // Buscar grupos do usuário para o dropdown
    // Se req.user.groups for um array, use-o. Caso contrário, crie um array com o grupo do usuário
    let userGroups = [];
    if (Array.isArray(req.user.groups) && req.user.groups.length > 0) {
      userGroups = req.user.groups;
    } else if (req.user.group) {
      // Se tiver apenas um grupo, crie um array com ele
      userGroups = [req.user.group._id || req.user.group];
    }

    // Buscar grupos do banco de dados
    const groups = await Group.find({ _id: { $in: userGroups } });

    // Verificar se há grupos disponíveis
    if (!groups || groups.length === 0) {
      req.flash(
        "error",
        "Não foi possível encontrar grupos disponíveis. Entre em contato com um administrador."
      );
      return res.redirect("/dashboard");
    }

    res.render("rss/add", {
      title: "Adicionar Fonte RSS",
      groups,
      user: req.user,
    });
  } catch (error) {
    req.flash("error", "Erro ao carregar formulário: " + error.message);
    res.redirect("/rss");
  }
};

// Processar adição de nova fonte RSS
exports.postAddRSS = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash("error", errors.array()[0].msg);
    return res.redirect("/rss/add");
  }

  try {
    const { name, description, url, source, group } = req.body;

    // Verificar se o usuário tem acesso ao grupo
    if (!req.user.groups.includes(group)) {
      req.flash(
        "error",
        "Você não tem permissão para adicionar conteúdo a este grupo"
      );
      return res.redirect("/rss/add");
    }

    const newRSS = new RSS({
      name,
      description,
      url,
      source,
      group,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });

    await newRSS.save();

    req.flash("success", "Fonte RSS adicionada com sucesso!");
    res.redirect("/rss");
  } catch (error) {
    req.flash("error", "Erro ao adicionar fonte RSS: " + error.message);
    res.redirect("/rss/add");
  }
};

// Exibir formulário para editar fonte RSS
exports.getEditRSS = async (req, res) => {
  try {
    const rssId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(rssId)) {
      req.flash("error", "ID inválido");
      return res.redirect("/rss");
    }

    const rssItem = await RSS.findById(rssId);

    if (!rssItem) {
      req.flash("error", "Fonte RSS não encontrada");
      return res.redirect("/rss");
    }

    // Verificar se o usuário tem um grupo
    if (!req.user.group) {
      req.flash(
        "error",
        "Você não tem um grupo atribuído. Entre em contato com um administrador."
      );
      return res.redirect("/rss");
    }

    // Verificar se o usuário tem acesso ao grupo da fonte RSS
    // Se req.user.groups for um array, verifique se inclui o grupo da fonte
    // Caso contrário, compare com o grupo do usuário
    let hasAccess = false;
    if (Array.isArray(req.user.groups) && req.user.groups.length > 0) {
      hasAccess = req.user.groups.includes(rssItem.group.toString());
    } else if (req.user.group) {
      const userGroupId = req.user.group._id || req.user.group;
      hasAccess = rssItem.group.toString() === userGroupId.toString();
    }

    if (!hasAccess) {
      req.flash("error", "Você não tem permissão para editar esta fonte RSS");
      return res.redirect("/rss");
    }

    // Buscar grupos do usuário para o dropdown
    // Se req.user.groups for um array, use-o. Caso contrário, crie um array com o grupo do usuário
    let userGroups = [];
    if (Array.isArray(req.user.groups) && req.user.groups.length > 0) {
      userGroups = req.user.groups;
    } else if (req.user.group) {
      // Se tiver apenas um grupo, crie um array com ele
      userGroups = [req.user.group._id || req.user.group];
    }

    // Buscar grupos do banco de dados
    const groups = await Group.find({ _id: { $in: userGroups } });

    // Verificar se há grupos disponíveis
    if (!groups || groups.length === 0) {
      req.flash(
        "error",
        "Não foi possível encontrar grupos disponíveis. Entre em contato com um administrador."
      );
      return res.redirect("/rss");
    }

    res.render("rss/edit", {
      title: "Editar Fonte RSS",
      rssItem,
      groups,
      user: req.user,
    });
  } catch (error) {
    req.flash(
      "error",
      "Erro ao carregar formulário de edição: " + error.message
    );
    res.redirect("/rss");
  }
};

// Processar edição de fonte RSS
exports.postUpdateRSS = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash("error", errors.array()[0].msg);
    return res.redirect(`/rss/edit/${req.params.id}`);
  }

  try {
    const rssId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(rssId)) {
      req.flash("error", "ID inválido");
      return res.redirect("/rss");
    }

    const rssItem = await RSS.findById(rssId);

    if (!rssItem) {
      req.flash("error", "Fonte RSS não encontrada");
      return res.redirect("/rss");
    }

    // Verificar se o usuário tem acesso ao grupo da fonte RSS
    if (!req.user.groups.includes(rssItem.group.toString())) {
      req.flash("error", "Você não tem permissão para editar esta fonte RSS");
      return res.redirect("/rss");
    }

    const { name, description, url, source, group, active } = req.body;

    // Verificar se o usuário tem acesso ao novo grupo
    if (!req.user.groups.includes(group)) {
      req.flash("error", "Você não tem permissão para este grupo");
      return res.redirect(`/rss/edit/${rssId}`);
    }

    // Atualizar dados
    rssItem.name = name;
    rssItem.description = description;
    rssItem.url = url;
    rssItem.source = source;
    rssItem.group = group;
    rssItem.active = !!active;
    rssItem.lastModifiedBy = req.user._id;

    await rssItem.save();

    req.flash("success", "Fonte RSS atualizada com sucesso!");
    res.redirect("/rss");
  } catch (error) {
    req.flash("error", "Erro ao atualizar fonte RSS: " + error.message);
    res.redirect(`/rss/edit/${req.params.id}`);
  }
};

// Excluir fonte RSS
exports.deleteRSS = async (req, res) => {
  try {
    const rssId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(rssId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const rssItem = await RSS.findById(rssId);

    if (!rssItem) {
      return res
        .status(404)
        .json({ success: false, error: "Fonte RSS não encontrada" });
    }

    // Verificar se o usuário tem acesso ao grupo da fonte RSS
    if (!req.user.groups.includes(rssItem.group.toString())) {
      return res.status(403).json({
        success: false,
        error: "Você não tem permissão para excluir esta fonte RSS",
      });
    }

    // Verificar se a fonte RSS está sendo usada em alguma playlist
    const isInUse = await Playlist.exists({
      items: { $elemMatch: { type: "rss", rss: rssId } },
    });

    if (isInUse) {
      return res.status(400).json({
        success: false,
        error:
          "Esta fonte RSS está sendo usada em uma ou mais playlists e não pode ser excluída",
      });
    }

    await RSS.findByIdAndDelete(rssId);

    res.json({ success: true, message: "Fonte RSS excluída com sucesso" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Visualizar detalhes de uma fonte RSS
exports.getRSSDetails = async (req, res) => {
  try {
    const rssId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(rssId)) {
      req.flash("error", "ID inválido");
      return res.redirect("/rss");
    }

    const rssItem = await RSS.findById(rssId)
      .populate("group")
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name");

    if (!rssItem) {
      req.flash("error", "Fonte RSS não encontrada");
      return res.redirect("/rss");
    }

    // Verificar se o usuário tem acesso ao grupo da fonte RSS
    if (!req.user.groups.includes(rssItem.group._id.toString())) {
      req.flash(
        "error",
        "Você não tem permissão para visualizar esta fonte RSS"
      );
      return res.redirect("/rss");
    }

    res.render("rss/details", {
      title: `Fonte RSS: ${rssItem.name}`,
      rssItem,
      user: req.user,
    });
  } catch (error) {
    req.flash(
      "error",
      "Erro ao buscar detalhes da fonte RSS: " + error.message
    );
    res.redirect("/rss");
  }
};
