const Group = require("../models/group.model");
const User = require("../models/user.model");

/**
 * Cria um novo grupo (apenas admin)
 */
const createGroup = async (req, res) => {
  try {
    const { name, description, active, permissions } = req.body;

    // Verifica se já existe um grupo com o mesmo nome
    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        req.flash("error", "Já existe um grupo com este nome");
        return res.redirect("/groups/new");
      }

      return res.status(400).json({
        success: false,
        message: "Já existe um grupo com este nome",
      });
    }

    // Prepara as permissões
    const groupPermissions = permissions
      ? {
          canManageUsers:
            permissions.canManageUsers === "on" ||
            permissions.canManageUsers === true,
          canManageMedia:
            permissions.canManageMedia === "on" ||
            permissions.canManageMedia === true,
          canManagePlaylists:
            permissions.canManagePlaylists === "on" ||
            permissions.canManagePlaylists === true,
          canManagePlayers:
            permissions.canManagePlayers === "on" ||
            permissions.canManagePlayers === true,
          isAdmin: permissions.isAdmin === "on" || permissions.isAdmin === true,
        }
      : {};

    // Cria o novo grupo
    const group = new Group({
      name,
      description,
      createdBy: req.user._id,
      active: active === "on" || active === true,
      permissions: groupPermissions,
    });

    await group.save();

    // Redireciona para a página de grupos após criação
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      req.flash("success", "Grupo criado com sucesso");
      return res.redirect("/groups");
    }

    res.status(201).json({
      success: true,
      message: "Grupo criado com sucesso",
      data: group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao criar grupo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Lista todos os grupos (admin vê todos, usuários comuns veem apenas o seu)
 */
const getGroups = async (req, res) => {
  try {
    let groups;

    // Administradores podem ver todos os grupos
    if (req.user.role === "admin") {
      groups = await Group.find().sort({ name: 1 });
    } else {
      // Usuários comuns veem apenas o seu grupo
      groups = await Group.find({ _id: req.user.group }).sort({ name: 1 });
    }

    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao listar grupos",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Obtém um grupo específico pelo ID
 */
const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Grupo não encontrado",
      });
    }

    // Verifica se o usuário tem permissão para ver este grupo
    if (
      req.user.role !== "admin" &&
      req.user.group.toString() !== group._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Acesso negado. Você só pode ver seu próprio grupo.",
      });
    }

    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao buscar grupo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Atualiza um grupo existente (apenas admin)
 */
const updateGroup = async (req, res) => {
  try {
    const { name, description, active, permissions } = req.body;

    // Verifica se o grupo existe
    let group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Grupo não encontrado",
      });
    }

    // Verifica se o novo nome já está em uso (se for diferente do atual)
    if (name && name !== group.name) {
      const existingGroup = await Group.findOne({ name });
      if (existingGroup) {
        return res.status(400).json({
          success: false,
          message: "Já existe um grupo com este nome",
        });
      }
    }

    // Atualiza o grupo
    group.name = name || group.name;
    group.description =
      description !== undefined ? description : group.description;
    group.active =
      active !== undefined ? active === "on" || active === true : group.active;

    // Atualiza as permissões
    if (permissions) {
      group.permissions = {
        canManageUsers:
          permissions.canManageUsers === "on" ||
          permissions.canManageUsers === true,
        canManageMedia:
          permissions.canManageMedia === "on" ||
          permissions.canManageMedia === true,
        canManagePlaylists:
          permissions.canManagePlaylists === "on" ||
          permissions.canManagePlaylists === true,
        canManagePlayers:
          permissions.canManagePlayers === "on" ||
          permissions.canManagePlayers === true,
        isAdmin: permissions.isAdmin === "on" || permissions.isAdmin === true,
      };
    }

    await group.save();

    // Redireciona para a página de detalhes do grupo após atualização
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      req.flash("success", "Grupo atualizado com sucesso");
      return res.redirect(`/groups/${group._id}`);
    }

    res.status(200).json({
      success: true,
      message: "Grupo atualizado com sucesso",
      data: group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar grupo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Remove um grupo (apenas admin e se não houver usuários associados)
 */
const deleteGroup = async (req, res) => {
  try {
    // Verifica se o grupo existe
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Grupo não encontrado",
      });
    }

    // Verifica se há usuários associados a este grupo
    const usersInGroup = await User.countDocuments({ group: req.params.id });
    if (usersInGroup > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Não é possível excluir o grupo pois existem usuários associados a ele",
      });
    }

    // Remove o grupo
    await Group.deleteOne({ _id: group._id });

    res.status(200).json({
      success: true,
      message: "Grupo removido com sucesso",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao remover grupo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
};
