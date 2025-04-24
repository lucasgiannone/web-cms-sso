const express = require("express");
const router = express.Router();
const playlistController = require("../controllers/playlist.controller");
const {
  auth,
  sameGroupOrAdmin,
  webAuth,
} = require("../middleware/auth.middleware");

// Criar uma nova playlist
router.post("/", auth, playlistController.createPlaylist);

// Obter todas as playlists
router.get("/", auth, playlistController.getPlaylists);

// Obter uma playlist específica
router.get("/:id", auth, sameGroupOrAdmin, playlistController.getPlaylistById);

// Atualizar uma playlist
router.put("/:id", auth, sameGroupOrAdmin, playlistController.updatePlaylist);

// Remover uma playlist
router.delete(
  "/:id",
  auth,
  sameGroupOrAdmin,
  playlistController.deletePlaylist
);

// Exportar uma playlist
router.get(
  "/:id/export",
  auth,
  sameGroupOrAdmin,
  playlistController.exportPlaylist
);

// Rota para adicionar várias mídias a uma playlist de uma vez
router.post("/:id/add-media", auth, sameGroupOrAdmin, async (req, res) => {
  try {
    const Playlist = require("../models/playlist.model");
    const Media = require("../models/media.model");

    const { id } = req.params;
    const { mediaIds } = req.body;

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Verificar se os IDs de mídia são válidos
    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "IDs de mídia inválidos ou não fornecidos",
      });
    }

    // Obter os items existentes da playlist
    const existingItems = playlist.items || [];
    const lastOrder =
      existingItems.length > 0
        ? Math.max(...existingItems.map((item) => item.order || 0))
        : -1;

    // Verificar e adicionar cada mídia
    const mediaPromises = mediaIds.map((mediaId) => Media.findById(mediaId));
    const mediaResults = await Promise.all(mediaPromises);

    // Filtrar apenas mídias válidas
    const validMedia = mediaResults.filter((media) => media !== null);

    // Criar novos itens para a playlist
    const newItems = validMedia.map((media, index) => {
      const duration =
        media.type === "video" && media.duration
          ? media.duration
          : media.type === "image"
          ? 10
          : 30; // Padrão: 10s para imagens, 30s para HTML

      return {
        media: media._id,
        duration: duration,
        order: lastOrder + 1 + index,
      };
    });

    // Atualizar a playlist com os novos itens
    playlist.items = [...existingItems, ...newItems];
    playlist.lastModifiedBy = req.user._id;

    await playlist.save();

    return res.status(200).json({
      success: true,
      message: `${validMedia.length} mídia(s) adicionada(s) à playlist com sucesso`,
      invalidCount: mediaIds.length - validMedia.length,
    });
  } catch (error) {
    console.error("Erro ao adicionar mídias à playlist:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao adicionar mídias à playlist",
      error: error.message,
    });
  }
});

// Rota para excluir múltiplos itens de uma playlist de uma vez
router.post(
  "/:id/items/delete-multiple",
  auth,
  sameGroupOrAdmin,
  async (req, res) => {
    try {
      const mongoose = require("mongoose");
      const Playlist = require("../models/playlist.model");

      const { id } = req.params;
      const { itemIds } = req.body;

      // Verificar se a playlist existe
      const playlist = await Playlist.findById(id);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: "Playlist não encontrada",
        });
      }

      // Validar os itemIds
      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "IDs de itens inválidos ou não fornecidos",
        });
      }

      // Filtrar apenas IDs válidos
      const validItemIds = itemIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      if (validItemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Nenhum ID de item válido fornecido",
        });
      }

      // Verificar quantos itens serão excluídos
      let itemsToDelete = 0;
      playlist.items.forEach((item) => {
        if (validItemIds.includes(item._id.toString())) {
          itemsToDelete++;
        }
      });

      // Remover os itens da playlist
      playlist.items = playlist.items.filter(
        (item) => !validItemIds.includes(item._id.toString())
      );

      // Reordenar os itens restantes
      playlist.items.forEach((item, index) => {
        item.order = index;
      });

      // Salvar as alterações
      playlist.lastModifiedBy = req.user._id;
      await playlist.save();

      return res.status(200).json({
        success: true,
        message: `${itemsToDelete} item(ns) removido(s) da playlist com sucesso`,
        deleted: itemsToDelete,
        invalidCount: itemIds.length - validItemIds.length,
      });
    } catch (error) {
      console.error("Erro ao excluir itens da playlist:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao excluir itens da playlist",
        error: error.message,
      });
    }
  }
);

// Rota para adicionar um item a uma playlist
router.post("/:id/items", auth, sameGroupOrAdmin, async (req, res) => {
  try {
    const Playlist = require("../models/playlist.model");
    const Media = require("../models/media.model");

    const playlistId = req.params.id;
    const { media, duration, existingItems, startDateTime, endDateTime } =
      req.body;

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Verificar se a mídia existe
    const mediaObj = await Media.findById(media);
    if (!mediaObj) {
      return res.status(404).json({
        success: false,
        message: "Mídia não encontrada",
      });
    }

    // Obter os itens existentes
    let items = playlist.items || [];

    // Se existingItems foi fornecido, usar isso como base
    if (existingItems) {
      items = existingItems;
    }

    // Calcular o próximo order
    const lastOrder =
      items.length > 0
        ? Math.max(
            ...items.map((item) =>
              typeof item.order === "number" ? item.order : 0
            )
          )
        : -1;

    // Calcular a duração adequada se não fornecida
    let itemDuration = duration;
    if (!itemDuration) {
      if (mediaObj.type === "video" && mediaObj.duration) {
        itemDuration = mediaObj.duration;
      } else if (mediaObj.type === "image") {
        itemDuration = 10; // Padrão para imagens: 10 segundos
      } else {
        itemDuration = 30; // Padrão para HTML: 30 segundos
      }
    }

    // Criar o novo item
    const newItem = {
      media: mediaObj._id,
      duration: itemDuration,
      order: lastOrder + 1,
    };

    // Adicionar data e hora de início e fim se fornecidos
    if (startDateTime) {
      newItem.startDateTime = new Date(startDateTime);
    }

    if (endDateTime) {
      newItem.endDateTime = new Date(endDateTime);
    }

    // Adicionar o novo item à lista
    playlist.items.push(newItem);

    // Registrar o usuário que fez a modificação
    playlist.lastModifiedBy = req.user._id;

    // Salvar a playlist atualizada
    await playlist.save();

    return res.status(200).json({
      success: true,
      message: "Item adicionado à playlist com sucesso",
      data: newItem,
    });
  } catch (error) {
    console.error("Erro ao adicionar item à playlist:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao adicionar item à playlist",
      error: error.message,
    });
  }
});

// Rota para remover um item específico de uma playlist
router.delete(
  "/:playlistId/items/:itemId",
  auth,
  sameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");
      const { playlistId, itemId } = req.params;

      // Verificar se a playlist existe
      const playlist = await Playlist.findById(playlistId);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: "Playlist não encontrada",
        });
      }

      // Buscar o item na playlist
      const itemIndex = playlist.items.findIndex(
        (item) => item._id.toString() === itemId
      );

      if (itemIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Item não encontrado na playlist",
        });
      }

      // Remover o item
      playlist.items.splice(itemIndex, 1);

      // Reordenar os itens restantes
      playlist.items.forEach((item, index) => {
        item.order = index;
      });

      // Registrar quem fez a atualização
      playlist.lastModifiedBy = req.user._id;

      // Salvar a playlist atualizada
      await playlist.save();

      return res.status(200).json({
        success: true,
        message: "Item removido da playlist com sucesso",
      });
    } catch (error) {
      console.error("Erro ao remover item da playlist:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao remover item da playlist",
        error: error.message,
      });
    }
  }
);

// Rota para atualizar um item específico em uma playlist
router.put("/:id/items/:itemId", auth, sameGroupOrAdmin, async (req, res) => {
  try {
    const Playlist = require("../models/playlist.model");
    const { id, itemId } = req.params;
    const { duration, order, startDateTime, endDateTime } = req.body;

    console.log("API: Atualizando item da playlist:", {
      playlistId: id,
      itemId,
      duration,
      order,
      startDateTime,
      endDateTime,
    });

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Buscar o item na playlist
    const itemIndex = playlist.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item não encontrado na playlist",
      });
    }

    // Atualizar os campos do item
    if (duration !== undefined) {
      playlist.items[itemIndex].duration = parseInt(duration) || 0;
    }

    if (order !== undefined) {
      playlist.items[itemIndex].order = parseInt(order) || 0;
    }

    // Atualizar startDateTime
    if (startDateTime === null) {
      console.log("Removendo startDateTime do item");
      playlist.items[itemIndex].startDateTime = null;
    } else if (startDateTime !== undefined) {
      console.log("Definindo startDateTime:", new Date(startDateTime));
      playlist.items[itemIndex].startDateTime = new Date(startDateTime);
    }

    // Atualizar endDateTime
    if (endDateTime === null) {
      console.log("Removendo endDateTime do item");
      playlist.items[itemIndex].endDateTime = null;
    } else if (endDateTime !== undefined) {
      console.log("Definindo endDateTime:", new Date(endDateTime));
      playlist.items[itemIndex].endDateTime = new Date(endDateTime);
    }

    // Registrar quem fez a atualização
    playlist.lastModifiedBy = req.user._id;

    // Salvar a playlist atualizada
    await playlist.save();

    // Notificar players sobre a atualização
    try {
      const notifyPlayersService = require("../services/notifyPlayers.service");
      await notifyPlayersService.notifyPlaylistUpdate(id);
    } catch (error) {
      console.warn(
        "Não foi possível notificar os players sobre a atualização:",
        error.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Item atualizado com sucesso",
      data: playlist.items[itemIndex],
    });
  } catch (error) {
    console.error("Erro ao atualizar item da playlist:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar item da playlist",
      error: error.message,
    });
  }
});

// Rota para adicionar uma subplaylist a uma playlist
router.post(
  "/:id/add-subplaylist",
  auth,
  sameGroupOrAdmin,
  playlistController.addSubPlaylistToPlaylist
);

// Rota de API para adicionar uma subplaylist
router.post(
  "/:id/add-subplaylist",
  auth,
  sameGroupOrAdmin,
  async (req, res) => {
    try {
      const Playlist = require("../models/playlist.model");
      const { id } = req.params;
      const { subPlaylistId, duration } = req.body;
      const userId = req.user._id;

      // Verificar se a playlist existe
      const playlist = await Playlist.findById(id);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: "Playlist não encontrada",
        });
      }

      // Verificar se a subplaylist existe
      const subPlaylist = await Playlist.findById(subPlaylistId);
      if (!subPlaylist) {
        return res.status(404).json({
          success: false,
          message: "Subplaylist não encontrada",
        });
      }

      // Verificar se não está tentando adicionar ela mesma como subplaylist (loop infinito)
      if (id === subPlaylistId) {
        return res.status(400).json({
          success: false,
          message:
            "Não é possível adicionar a playlist como subplaylist dela mesma",
        });
      }

      // Verificar loops de subplaylists mais complexos
      const checkForPlaylistLoop =
        require("../controllers/playlist.controller").checkForPlaylistLoop;
      const hasLoop = await checkForPlaylistLoop(id, subPlaylistId);
      if (hasLoop) {
        return res.status(400).json({
          success: false,
          message:
            "Não é possível adicionar esta subplaylist porque causaria um loop de referências",
        });
      }

      // Verificar se a subplaylist é do mesmo grupo
      if (playlist.group.toString() !== subPlaylist.group.toString()) {
        return res.status(403).json({
          success: false,
          message: "Você só pode adicionar subplaylists do mesmo grupo",
        });
      }

      // Calcular a ordem (último item + 1)
      let order = 0;
      if (playlist.items.length > 0) {
        const maxOrder = Math.max(...playlist.items.map((item) => item.order));
        order = maxOrder + 1;
      }

      // Adicionar a subplaylist à playlist
      const newItem = {
        type: "playlist",
        subPlaylist: subPlaylistId,
        duration: duration || 0, // 0 = duração total da subplaylist
        order,
      };

      playlist.items.push(newItem);

      // Registrar quem fez a última modificação
      playlist.lastModifiedBy = userId;

      // Salvar as alterações
      await playlist.save();

      // Notificar players sobre a atualização
      try {
        const notifyPlayersService = require("../services/notifyPlayers.service");
        await notifyPlayersService.notifyPlaylistUpdate(id);
      } catch (error) {
        console.warn(
          "Não foi possível notificar os players sobre a atualização:",
          error.message
        );
      }

      return res.status(200).json({
        success: true,
        message: "Subplaylist adicionada com sucesso",
        data: newItem,
      });
    } catch (error) {
      console.error("Erro ao adicionar subplaylist:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao adicionar subplaylist à playlist",
        error: error.message,
      });
    }
  }
);

// Rota para reordenar itens da playlist
router.post("/:id/reorder", auth, sameGroupOrAdmin, async (req, res) => {
  try {
    const Playlist = require("../models/playlist.model");
    const { id } = req.params;
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lista de IDs de itens inválida ou vazia",
      });
    }

    // Buscar a playlist atual
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Verificar se todos os IDs fornecidos correspondem a itens reais na playlist
    const playlistItemIds = playlist.items.map((item) => item._id.toString());
    const allIdsExist = itemIds.every((id) => playlistItemIds.includes(id));

    if (!allIdsExist) {
      return res.status(400).json({
        success: false,
        message: "Um ou mais IDs de item não pertencem à playlist",
      });
    }

    // Criar um mapa de itens para fácil acesso
    const itemsMap = {};
    playlist.items.forEach((item) => {
      itemsMap[item._id.toString()] = item;
    });

    // Criar a nova lista ordenada de itens
    const reorderedItems = itemIds.map((itemId, index) => {
      const item = itemsMap[itemId];

      // Atualizar a ordem do item
      item.order = index;

      return item;
    });

    // Atualizar a playlist com os itens reordenados
    playlist.items = reorderedItems;
    playlist.lastModifiedBy = req.user._id;

    await playlist.save();

    // Notificar players sobre a atualização
    try {
      const notifyPlayersService = require("../services/notifyPlayers.service");
      await notifyPlayersService.notifyPlaylistUpdate(id);
    } catch (error) {
      console.warn(
        "Não foi possível notificar os players sobre a atualização:",
        error.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Ordem dos itens atualizada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao reordenar itens da playlist:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao reordenar itens da playlist",
      error: error.message,
    });
  }
});

// Rota para adicionar uma fonte RSS a uma playlist
router.post(
  "/:id/add-rss",
  auth,
  sameGroupOrAdmin,
  playlistController.addRSSToPlaylist
);

// Rota para acessar a página de adicionar item à playlist
router.get(
  "/:id/add-item",
  auth,
  sameGroupOrAdmin,
  playlistController.getAddItem
);

// Rotas para gerenciamento de playlists
router.get("/", webAuth, playlistController.getPlaylists);
router.get("/add", webAuth, playlistController.getAddPlaylist);
router.post("/create", webAuth, playlistController.postCreatePlaylist);

module.exports = router;
