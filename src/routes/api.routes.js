const express = require("express");
const router = express.Router();
const rssSyncController = require("../controllers/rssSync.controller");
const { auth, webAuth } = require("../middleware/auth.middleware");
const playlistController = require("../controllers/playlist.controller");

// Rotas de player
const playerRoutes = require("./player.routes");

// Registro das sub-rotas
router.use("/players", playerRoutes);

// Rotas para playlists
router.get("/playlists", webAuth, playlistController.getPlaylists);
router.post(
  "/playlists/:id/add-rss",
  webAuth,
  playlistController.addRSSToPlaylist
);

// Rotas para sincronização de RSS
router.get("/rss/metadata", rssSyncController.getRSSMetadata);
router.get("/rss/download/:source", rssSyncController.downloadRSSSource);
router.get("/rss/download-full", rssSyncController.downloadFullRSS);
router.get("/rss/check-updates", rssSyncController.checkUpdates);
router.post("/rss/cleanup-temp", auth, rssSyncController.cleanupTempFiles);
router.post("/rss/generate-metadata", auth, rssSyncController.generateMetadata);

module.exports = router;
