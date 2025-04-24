const express = require("express");
const router = express.Router();
const playerController = require("../controllers/player.controller");
const { auth, sameGroupOrAdmin } = require("../middleware/auth.middleware");

// Gerar uma nova chave de player
router.post("/generate-key", auth, playerController.generatePlayerKey);

// Ativar um player usando a chave
router.post("/activate-with-key", playerController.activatePlayerWithKey);

// Registrar um novo player
router.post("/", auth, playerController.registerPlayer);

// Listar todos os players (filtrados por grupo)
router.get("/", auth, playerController.getPlayers);

// Obter um player específico
router.get("/:id", auth, sameGroupOrAdmin, playerController.getPlayerById);

// Atualizar um player
router.put("/:id", auth, sameGroupOrAdmin, playerController.updatePlayer);

// Adicionar rota POST para atualizar player (para compatibilidade com o formulário)
router.post("/:id", auth, sameGroupOrAdmin, playerController.updatePlayer);

// Remover um player
router.delete("/:id", auth, sameGroupOrAdmin, playerController.deletePlayer);

// Verificar autorização de um player (rota pública para o player)
router.get("/check/:uniqueId", playerController.checkPlayerAuthorization);

// Rotas públicas para players
router.post("/register", playerController.registerPlayer);
router.post("/auth", playerController.authenticatePlayer);

// Rotas protegidas por autenticação do player
router.get("/:id/playlist", playerController.getPlayerPlaylist);
router.post("/:id/status", playerController.updatePlayerStatus);
router.post("/:id/ping", playerController.receivePlayerPing);
router.post(
  "/:id/check-status",
  auth,
  sameGroupOrAdmin,
  playerController.checkPlayerStatus
);

// Rotas administrativas
router.get("/admin/all", auth, playerController.getAllPlayers);
router.post(
  "/:id/assign-playlist",
  auth,
  sameGroupOrAdmin,
  playerController.assignPlaylist
);

// Rota para notificar que um player ficou travado e foi reiniciado
router.post("/notify-stuck", async (req, res) => {
  try {
    const { playerId, mediaId, mediaTitle, duration, stuckTime } = req.body;

    if (!playerId) {
      return res.status(400).json({ message: "ID do player é obrigatório" });
    }

    // Registrar o evento no log do player
    await playerController.logPlayerEvent(playerId, "MEDIA_STUCK", {
      mediaId,
      mediaTitle,
      duration,
      stuckTime,
      event: "Player travado e reiniciado automaticamente",
    });

    // Atualizar o status online do player
    await playerController.updatePlayerStatus(playerId, true, true);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro ao registrar notificação de travamento:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;
