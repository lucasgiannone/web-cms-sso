const User = require("../models/user.model");

/**
 * Lista todos os usuários (admin vê todos, usuários comuns veem apenas os do seu grupo)
 */
const getUsers = async (req, res) => {
  try {
    let query = { active: true };

    // Usuários comuns só podem ver usuários do seu grupo
    if (req.user.role !== "admin") {
      query.group = req.user.group;
    }

    // Filtra por grupo se especificado
    if (req.query.group) {
      // Apenas admin pode filtrar por grupo
      if (req.user.role === "admin") {
        query.group = req.query.group;
      }
    }

    const users = await User.find(query)
      .select("-password")
      .populate("group", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao listar usuários",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Obtém um usuário específico pelo ID
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("group", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
      });
    }

    // Verifica se o usuário tem permissão para ver este usuário
    if (
      req.user.role !== "admin" &&
      req.user.group.toString() !== user.group._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Acesso negado. Você só pode ver usuários do seu grupo.",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao buscar usuário",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Atualiza um usuário existente
 */
const updateUser = async (req, res) => {
  try {
    const { name, email, role, group, active } = req.body;

    // Verifica se o usuário existe
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
      });
    }

    // Verifica permissões
    if (req.user.role !== "admin") {
      // Usuários comuns só podem atualizar a si mesmos
      if (req.user._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Você só pode atualizar seu próprio perfil.",
        });
      }

      // Usuários comuns não podem mudar seu papel ou grupo
      if (role || group || active !== undefined) {
        return res.status(403).json({
          success: false,
          message:
            "Acesso negado. Você não pode alterar papel, grupo ou status.",
        });
      }
    }

    // Verifica se o novo email já está em uso (se for diferente do atual)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Este email já está em uso",
        });
      }
    }

    // Atualiza o usuário
    user.name = name || user.name;
    user.email = email || user.email;

    // Apenas admin pode atualizar estes campos
    if (req.user.role === "admin") {
      if (role) user.role = role;
      if (group) user.group = group;
      if (active !== undefined) user.active = active;
    }

    await user.save();

    // Remove a senha do objeto retornado
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Usuário atualizado com sucesso",
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar usuário",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Redefine a senha de um usuário (apenas admin)
 */
const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    // Verifica se o usuário existe
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
      });
    }

    // Atualiza a senha
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Senha redefinida com sucesso",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao redefinir senha",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Desativa um usuário (soft delete)
 */
const deleteUser = async (req, res) => {
  try {
    // Verifica se o usuário existe
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
      });
    }

    // Não permite que um usuário desative a si mesmo
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Você não pode desativar seu próprio usuário",
      });
    }

    // Desativa o usuário (soft delete)
    user.active = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Usuário desativado com sucesso",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao desativar usuário",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Cria um novo usuário (apenas admin)
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, group, isAdmin, active } = req.body;

    // Verifica se o email já está em uso
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email já está em uso",
      });
    }

    // Cria o novo usuário
    const user = new User({
      name,
      email,
      password,
      role: isAdmin ? "admin" : "user",
      group,
      active: active !== undefined ? active : true,
    });

    await user.save();

    // Remove a senha do objeto retornado
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "Usuário criado com sucesso",
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao criar usuário",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  resetPassword,
  deleteUser,
  createUser,
};
