const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const {
  auth,
  adminOnly,
  sameGroupOrAdmin,
} = require("../middleware/auth.middleware");

// Criar um novo usuário (apenas admin)
router.post("/", auth, adminOnly, userController.createUser);

// Listar todos os usuários (filtrados por grupo para usuários comuns)
router.get("/", auth, userController.getUsers);

// Obter um usuário específico
router.get("/:id", auth, sameGroupOrAdmin, userController.getUserById);

// Atualizar um usuário
router.put("/:id", auth, sameGroupOrAdmin, userController.updateUser);

// Redefinir senha (apenas admin)
router.post(
  "/:id/reset-password",
  auth,
  adminOnly,
  userController.resetPassword
);

// Desativar um usuário (apenas admin)
router.delete("/:id", auth, adminOnly, userController.deleteUser);

module.exports = router;
