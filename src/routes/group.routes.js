const express = require("express");
const router = express.Router();
const groupController = require("../controllers/group.controller");
const {
  auth,
  adminOnly,
  sameGroupOrAdmin,
} = require("../middleware/auth.middleware");

// Criar um novo grupo (apenas admin)
router.post("/", auth, adminOnly, groupController.createGroup);

// Listar todos os grupos (filtrados para usuários comuns)
router.get("/", auth, groupController.getGroups);

// Obter um grupo específico
router.get("/:id", auth, sameGroupOrAdmin, groupController.getGroupById);

// Atualizar um grupo (apenas admin)
router.put("/:id", auth, adminOnly, groupController.updateGroup);

// Remover um grupo (apenas admin)
router.delete("/:id", auth, adminOnly, groupController.deleteGroup);

module.exports = router;
