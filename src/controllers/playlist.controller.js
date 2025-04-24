const mongoose = require("mongoose");
const Playlist = require("../models/playlist.model");
const Media = require("../models/media.model");
const Group = require("../models/group.model");
const User = require("../models/user.model");
const RSS = require("../models/rss.model");

/**
 * Verifica se o usuário tem permissão para editar playlists
 * @param {string} userId - ID do usuário
 * @param {string} groupId - ID do grupo
 * @param {string} action - Ação a ser verificada (view, edit, delete)
 * @returns {boolean} - Retorna true se o usuário tem permissão
 */
const checkUserPermission = async (userId, groupId, action) => {
  try {
    // Carrega o usuário com seu grupo
    const user = await User.findById(userId).populate("group");

    if (!user) {
      return false;
    }

    // Admin pode fazer tudo
    if (user.role === "admin" || user.isAdmin) {
      return true;
    }

    // Verifica permissões do grupo
    if (action === "view") {
      return true; // Qualquer usuário pode visualizar playlists do seu grupo
    } else if (action === "edit" || action === "delete") {
      // Verifica se o usuário tem permissão para gerenciar playlists
      return (
        user.group &&
        user.group.permissions &&
        user.group.permissions.canManagePlaylists
      );
    }

    return false;
  } catch (error) {
    console.error("Erro ao verificar permissões:", error);
    return false;
  }
};

/**
 * Cria uma nova playlist
 */
const createPlaylist = async (req, res) => {
  try {
    const { name, description, items, thumbnail } = req.body;

    // Verifica se já existe uma playlist com o mesmo nome no grupo
    const existingPlaylist = await Playlist.findOne({
      name,
      group: req.user.group,
    });

    if (existingPlaylist) {
      return res.status(400).json({
        success: false,
        message: "Já existe uma playlist com este nome no seu grupo",
      });
    }

    // Cria a nova playlist
    const playlist = new Playlist({
      name,
      description,
      items: items || [],
      group: req.user.group,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });

    // Adiciona thumbnail se fornecido
    if (thumbnail) {
      playlist.thumbnail = thumbnail;
    }

    await playlist.save();

    res.status(201).json({
      success: true,
      message: "Playlist criada com sucesso",
      data: playlist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao criar playlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Lista todas as playlists (filtradas por grupo do usuário)
 */
const getPlaylists = async (req, res) => {
  try {
    let query = { active: true };

    // Filtra por grupo
    if (req.user.role !== "admin") {
      // Usuários comuns só veem playlists do seu grupo
      query.group = req.user.group;
    } else if (req.query.group) {
      // Admin pode filtrar por grupo
      query.group = req.query.group;
    }

    const playlists = await Playlist.find(query)
      .populate("group", "name")
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: playlists.length,
      data: playlists,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao listar playlists",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Obtém uma playlist específica pelo ID
 */
const getPlaylistById = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate("group", "name")
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name")
      .populate({
        path: "items.media",
        select: "name type filePath duration",
      })
      .populate({
        path: "items.subPlaylist",
        select: "name description",
      });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Verifica se o usuário tem permissão para ver esta playlist
    if (req.user.role !== "admin" && req.user.group) {
      const userGroupId = req.user.group._id || req.user.group;
      if (playlist.group._id.toString() !== userGroupId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Você só pode ver playlists do seu grupo.",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: playlist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao buscar playlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Atualiza uma playlist existente
 */
const updatePlaylist = async (req, res) => {
  try {
    const { name, description, items, thumbnail, active } = req.body;

    // Verifica se a playlist existe
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Verifica se o usuário tem permissão para atualizar esta playlist
    if (req.user.role !== "admin" && req.user.group) {
      const userGroupId = req.user.group._id || req.user.group;
      if (playlist.group.toString() !== userGroupId.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "Acesso negado. Você só pode atualizar playlists do seu grupo.",
        });
      }
    }

    // Verifica se o novo nome já está em uso (se for diferente do atual)
    if (name && name !== playlist.name) {
      const existingPlaylist = await Playlist.findOne({
        name,
        group: playlist.group,
        _id: { $ne: playlist._id },
      });

      if (existingPlaylist) {
        return res.status(400).json({
          success: false,
          message: "Já existe uma playlist com este nome no seu grupo",
        });
      }
    }

    // Atualiza os campos básicos
    playlist.name = name || playlist.name;
    playlist.description =
      description !== undefined ? description : playlist.description;

    // Atualiza o thumbnail se fornecido
    if (thumbnail !== undefined) {
      playlist.thumbnail = thumbnail || null;
    }

    if (items) {
      // Verifica se todos os itens têm mídias válidas
      if (Array.isArray(items)) {
        // ... restante do código existente ...
      }
    }

    playlist.lastModifiedBy = req.user._id;

    await playlist.save();

    // Notificar players sobre a atualização
    try {
      const notifyPlayersService = require("../services/notifyPlayers.service");
      await notifyPlayersService.notifyPlaylistUpdate(req.params.id);
    } catch (error) {
      console.warn(
        "Não foi possível notificar os players sobre a atualização:",
        error.message
      );
    }

    res.status(200).json({
      success: true,
      message: "Playlist atualizada com sucesso",
      data: playlist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar playlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Remove uma playlist (soft delete)
 */
const deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada",
      });
    }

    // Verifica se o usuário tem permissão para excluir esta playlist
    if (req.user.role !== "admin") {
      const userGroupId =
        req.user.group && (req.user.group._id || req.user.group);
      if (
        !userGroupId ||
        playlist.group.toString() !== userGroupId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Acesso negado. Você só pode excluir playlists do seu grupo.",
        });
      }
    }

    // Desativa a playlist (soft delete)
    playlist.active = false;
    await playlist.save();

    res.status(200).json({
      success: true,
      message: "Playlist removida com sucesso",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao remover playlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Exporta a playlist em formato compatível com o player
 */
const exportPlaylist = async (req, res) => {
  try {
    // Função auxiliar para expandir subplaylists recursivamente
    const processPlaylistItems = async (
      playlistId,
      processedPlaylists = new Set()
    ) => {
      // Detectar loops infinitos
      if (processedPlaylists.has(playlistId.toString())) {
        console.warn(`Loop de subplaylist detectado com ID: ${playlistId}`);
        return [];
      }

      // Adicionar esta playlist aos já processados para evitar loops
      processedPlaylists.add(playlistId.toString());

      const playlist = await Playlist.findById(playlistId)
        .populate({
          path: "items.media",
          select: "name type filePath duration mimeType downloadUrl",
        })
        .populate({
          path: "items.subPlaylist",
          select: "name description items active",
        })
        .populate({
          path: "items.rss",
          select: "name url active",
        });

      if (!playlist || !playlist.active) return [];

      let processedItems = [];

      // Processar todos os itens
      for (const item of playlist.items) {
        if (item.type === "media" && item.media) {
          // Adicionar mídia direta
          processedItems.push({
            id: item._id,
            mediaId: item.media._id,
            name: item.media.name,
            type: item.media.type,
            duration: item.duration,
            order: item.order,
            downloadUrl: item.media.downloadUrl,
            mimeType: item.media.mimeType,
            // Indicar que veio da playlist original
            parentPlaylist: playlistId,
          });
        } else if (
          item.type === "playlist" &&
          item.subPlaylist &&
          item.subPlaylist.active
        ) {
          // Processar subplaylist recursivamente
          const subItems = await processPlaylistItems(
            item.subPlaylist._id,
            new Set(processedPlaylists)
          );

          // Adicionar itens da subplaylist
          processedItems = processedItems.concat(
            subItems.map((subItem, index) => ({
              ...subItem,
              // Manter ordem relativa dentro da subplaylist, mas ajustar com base na ordem do item da subplaylist
              order: item.order + index * 0.001,
              // Incluir informação sobre a subplaylist de origem
              fromSubPlaylist: item.subPlaylist._id,
              subPlaylistName: item.subPlaylist.name,
            }))
          );
        } else if (item.type === "rss" && item.rss) {
          // Adicionar item RSS à lista
          console.log(`Exportando item RSS: ${item.rss._id || item.rss}`);

          // Construir URL do RSS para acesso
          const rssUrl =
            item.rss.url ||
            `${process.env.API_URL || "http://177.71.165.181"}/api/rss/${
              item.rss._id || item.rss
            }/view`;

          // Adicionar RSS ao resultado
          processedItems.push({
            id: item._id,
            rss: item.rss._id || item.rss,
            name: item.rss.name || "Feed RSS",
            type: "rss",
            url: rssUrl,
            duration: item.duration || 60, // Padrão 60 segundos para RSS
            order: item.order || 0,
            startDateTime: item.startDateTime
              ? item.startDateTime.toISOString()
              : null,
            endDateTime: item.endDateTime
              ? item.endDateTime.toISOString()
              : null,
            // Indicar que veio da playlist original
            parentPlaylist: playlistId,
          });
        }
      }

      return processedItems;
    };

    const playlistId = req.params.id;

    // Verificar se a playlist existe
    const mainPlaylist = await Playlist.findById(playlistId);
    if (!mainPlaylist || !mainPlaylist.active) {
      return res.status(404).json({
        success: false,
        message: "Playlist não encontrada ou inativa",
      });
    }

    // Verifica se o usuário tem permissão para exportar esta playlist
    if (
      req.user.role !== "admin" &&
      req.user.group.toString() !== mainPlaylist.group.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Acesso negado. Você só pode exportar playlists do seu grupo.",
      });
    }

    // Processar todos os itens incluindo subplaylists
    const allItems = await processPlaylistItems(playlistId);

    // Se a playlist não tiver itens válidos, retorna erro
    if (allItems.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "A playlist não contém itens válidos para exportação. Todas as mídias foram excluídas ou estão indisponíveis.",
      });
    }

    // Formata a playlist para o formato do player, ordenando todos os itens
    const exportedPlaylist = {
      id: mainPlaylist._id,
      name: mainPlaylist.name,
      description: mainPlaylist.description,
      items: allItems.sort((a, b) => a.order - b.order),
    };

    res.status(200).json({
      success: true,
      data: exportedPlaylist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao exportar playlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Adicionar um item à playlist
 */
const addItemToPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { mediaId, duration, startDateTime, endDateTime } = req.body;
    const userId = req.user._id;

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      req.flash("error_msg", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Verificar se o usuário tem permissão para editar
    const hasPermission = await checkUserPermission(
      userId,
      playlist.group,
      "edit"
    );
    if (!hasPermission) {
      req.flash(
        "error_msg",
        "Você não tem permissão para editar esta playlist"
      );
      return res.redirect("/playlists");
    }

    // Verificar se a mídia existe
    const media = await Media.findById(mediaId);
    if (!media) {
      req.flash("error_msg", "Mídia não encontrada");
      return res.redirect(`/playlists/${id}/edit`);
    }

    // Calcular a ordem (último item + 1)
    let order = 0;
    if (playlist.items.length > 0) {
      const maxOrder = Math.max(...playlist.items.map((item) => item.order));
      order = maxOrder + 1;
    }

    // Adicionar o item à playlist
    const newItem = {
      media: mediaId,
      duration: duration || 10, // Padrão 10 segundos se não for fornecido
      order,
    };

    // Adicionar data e hora de início e fim se fornecidos
    if (startDateTime) {
      newItem.startDateTime = new Date(startDateTime);
    }

    if (endDateTime) {
      newItem.endDateTime = new Date(endDateTime);
    }

    playlist.items.push(newItem);

    // Registrar quem fez a última modificação
    playlist.lastModifiedBy = userId;

    // Salvar as alterações
    await playlist.save();

    // Notificar players sobre a atualização
    try {
      const notifyPlayersService = require("../services/notifyPlayers.service");
      await notifyPlayersService.notifyPlaylistUpdate(req.params.id);
    } catch (error) {
      console.warn(
        "Não foi possível notificar os players sobre a atualização:",
        error.message
      );
    }

    req.flash("success_msg", "Item adicionado à playlist com sucesso");
    res.redirect(`/playlists/${id}/edit`);
  } catch (error) {
    console.error("Erro ao adicionar item à playlist:", error);
    req.flash("error_msg", "Erro ao adicionar item à playlist");
    res.redirect(`/playlists/${req.params.id}/edit`);
  }
};

/**
 * Remover um item da playlist
 */
const removeItemFromPlaylist = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user._id;

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      req.flash("error_msg", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Verificar se o usuário tem permissão para editar
    const hasPermission = await checkUserPermission(
      userId,
      playlist.group,
      "edit"
    );
    if (!hasPermission) {
      req.flash(
        "error_msg",
        "Você não tem permissão para editar esta playlist"
      );
      return res.redirect("/playlists");
    }

    // Remover o item
    playlist.items = playlist.items.filter(
      (item) => item._id.toString() !== itemId
    );

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

    req.flash("success_msg", "Item removido da playlist com sucesso");
    res.redirect(`/playlists/${id}/edit`);
  } catch (error) {
    console.error("Erro ao remover item da playlist:", error);
    req.flash("error_msg", "Erro ao remover item da playlist");
    res.redirect(`/playlists/${req.params.id}/edit`);
  }
};

/**
 * Atualizar um item da playlist
 */
const updatePlaylistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { duration, order, startDateTime, endDateTime } = req.body;
    const userId = req.user._id;

    console.log("Atualizando item da playlist:", {
      id,
      itemId,
      duration,
      order,
      startDateTime,
      endDateTime,
    });

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      req.flash("error_msg", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Verificar se o usuário tem permissão para editar
    const hasPermission = await checkUserPermission(
      userId,
      playlist.group,
      "edit"
    );
    if (!hasPermission) {
      req.flash(
        "error_msg",
        "Você não tem permissão para editar esta playlist"
      );
      return res.redirect("/playlists");
    }

    // Encontrar o item na playlist
    const itemIndex = playlist.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      req.flash("error_msg", "Item não encontrado na playlist");
      return res.redirect(`/playlists/${id}/edit`);
    }

    // Atualizar os campos fornecidos
    if (duration) {
      playlist.items[itemIndex].duration = duration;
    }

    if (order !== undefined) {
      playlist.items[itemIndex].order = order;
    }

    // Atualizar data e hora de início se fornecido
    if (startDateTime === "") {
      // Se for string vazia, define como null (remove o agendamento)
      playlist.items[itemIndex].startDateTime = null;
      console.log("Removendo startDateTime (string vazia)");
    } else if (startDateTime) {
      playlist.items[itemIndex].startDateTime = new Date(startDateTime);
      console.log("Definindo startDateTime:", new Date(startDateTime));
    }

    // Atualizar data e hora de fim se fornecido
    if (endDateTime === "") {
      // Se for string vazia, define como null (remove o agendamento)
      playlist.items[itemIndex].endDateTime = null;
      console.log("Removendo endDateTime (string vazia)");
    } else if (endDateTime) {
      playlist.items[itemIndex].endDateTime = new Date(endDateTime);
      console.log("Definindo endDateTime:", new Date(endDateTime));
    }

    console.log("Item atualizado:", playlist.items[itemIndex]);

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

    req.flash("success_msg", "Item da playlist atualizado com sucesso");
    res.redirect(`/playlists/${id}/edit`);
  } catch (error) {
    console.error("Erro ao atualizar item da playlist:", error);
    req.flash("error_msg", "Erro ao atualizar item da playlist");
    res.redirect(`/playlists/${req.params.id}/edit`);
  }
};

/**
 * Verifica se existe um loop de subplaylists
 * @param {String} parentPlaylistId - ID da playlist pai
 * @param {String} subPlaylistId - ID da subplaylist a ser adicionada
 * @param {Set} processedPlaylists - Set de IDs de playlists já processadas
 * @returns {Promise<boolean>} - true se existir um loop, false caso contrário
 */
const checkForPlaylistLoop = async (
  parentPlaylistId,
  subPlaylistId,
  processedPlaylists = new Set()
) => {
  // Se a subplaylist já foi processada ou é igual à playlist pai, temos um loop
  if (
    processedPlaylists.has(subPlaylistId.toString()) ||
    parentPlaylistId.toString() === subPlaylistId.toString()
  ) {
    return true;
  }

  // Adicionar a subplaylist atual ao conjunto de processadas
  processedPlaylists.add(subPlaylistId.toString());

  // Buscar a subplaylist e suas subplaylists
  const subPlaylist = await Playlist.findById(subPlaylistId)
    .select("items")
    .lean();

  if (!subPlaylist || !subPlaylist.items) {
    return false;
  }

  // Verificar recursivamente todas as subplaylists
  for (const item of subPlaylist.items) {
    if (item.type === "playlist" && item.subPlaylist) {
      const hasLoop = await checkForPlaylistLoop(
        parentPlaylistId,
        item.subPlaylist,
        new Set(processedPlaylists)
      );
      if (hasLoop) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Adicionar uma subplaylist à playlist
 */
const addSubPlaylistToPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { subPlaylistId, duration } = req.body;
    const userId = req.user._id;

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      req.flash("error_msg", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Verificar se a subplaylist existe
    const subPlaylist = await Playlist.findById(subPlaylistId);
    if (!subPlaylist) {
      req.flash("error_msg", "Subplaylist não encontrada");
      return res.redirect(`/playlists/${id}/edit`);
    }

    // Verificar se não está tentando adicionar ela mesma como subplaylist (loop infinito)
    if (id === subPlaylistId) {
      req.flash(
        "error_msg",
        "Não é possível adicionar a playlist como subplaylist dela mesma"
      );
      return res.redirect(`/playlists/${id}/edit`);
    }

    // Verificar loops de subplaylists mais complexos
    const hasLoop = await checkForPlaylistLoop(id, subPlaylistId);
    if (hasLoop) {
      req.flash(
        "error_msg",
        "Não é possível adicionar esta subplaylist porque causaria um loop de referências"
      );
      return res.redirect(`/playlists/${id}/edit`);
    }

    // Verificar se o usuário tem permissão para editar
    const hasPermission = await checkUserPermission(
      userId,
      playlist.group,
      "edit"
    );
    if (!hasPermission) {
      req.flash(
        "error_msg",
        "Você não tem permissão para editar esta playlist"
      );
      return res.redirect("/playlists");
    }

    // Verificar se a subplaylist é do mesmo grupo
    if (playlist.group.toString() !== subPlaylist.group.toString()) {
      req.flash(
        "error_msg",
        "Você só pode adicionar subplaylists do mesmo grupo"
      );
      return res.redirect(`/playlists/${id}/edit`);
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
      await notifyPlayersService.notifyPlaylistUpdate(req.params.id);
    } catch (error) {
      console.warn(
        "Não foi possível notificar os players sobre a atualização:",
        error.message
      );
    }

    req.flash("success_msg", "Subplaylist adicionada com sucesso");
    return res.redirect(`/playlists/${req.params.id}/edit`);
  } catch (error) {
    console.error("Erro ao adicionar subplaylist:", error);
    req.flash("error_msg", "Erro ao adicionar subplaylist à playlist");
    return res.redirect(`/playlists/${req.params.id}/edit`);
  }
};

/**
 * Adicionar um item RSS à playlist
 */
const addRSSToPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { rssId, duration, startDateTime, endDateTime } = req.body;
    const userId = req.user._id;

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      // Verificar se é uma requisição da API ou do formulário web
      if (req.xhr || req.headers["content-type"] === "application/json") {
        return res
          .status(404)
          .json({ success: false, message: "Playlist não encontrada" });
      }
      req.flash("error", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Verificar se o usuário tem permissão para editar
    const hasPermission = await checkUserPermission(
      userId,
      playlist.group,
      "edit"
    );
    if (!hasPermission) {
      // Verificar se é uma requisição da API ou do formulário web
      if (req.xhr || req.headers["content-type"] === "application/json") {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para editar esta playlist",
        });
      }
      req.flash("error", "Você não tem permissão para editar esta playlist");
      return res.redirect("/playlists");
    }

    // Verificar se a fonte RSS existe
    const rss = await RSS.findById(rssId);
    if (!rss) {
      // Verificar se é uma requisição da API ou do formulário web
      if (req.xhr || req.headers["content-type"] === "application/json") {
        return res
          .status(404)
          .json({ success: false, message: "Fonte RSS não encontrada" });
      }
      req.flash("error", "Fonte RSS não encontrada");
      return res.redirect(`/playlists/${id}/edit`);
    }

    // Calcular a ordem (último item + 1)
    let order = 0;
    if (playlist.items.length > 0) {
      const maxOrder = Math.max(...playlist.items.map((item) => item.order));
      order = maxOrder + 1;
    }

    // Adicionar o item RSS à playlist
    const newItem = {
      type: "rss",
      rss: rssId,
      duration: duration || 60, // Padrão 60 segundos para RSS
      order,
    };

    // Adicionar data e hora de início e fim se fornecidos
    if (startDateTime) {
      newItem.startDateTime = new Date(startDateTime);
    }

    if (endDateTime) {
      newItem.endDateTime = new Date(endDateTime);
    }

    playlist.items.push(newItem);

    // Registrar quem fez a última modificação
    playlist.lastModifiedBy = userId;

    // Salvar as alterações
    await playlist.save();

    // Notificar players sobre a atualização
    try {
      const notifyPlayersService = require("../services/notifyPlayers.service");
      await notifyPlayersService.notifyPlaylistUpdate(req.params.id);
    } catch (error) {
      console.warn(
        "Não foi possível notificar os players sobre a atualização:",
        error.message
      );
    }

    // Verificar se é uma requisição da API ou do formulário web
    if (req.xhr || req.headers["content-type"] === "application/json") {
      return res.json({
        success: true,
        message: "Fonte RSS adicionada à playlist com sucesso",
        playlistId: id,
        rssId: rssId,
      });
    }

    // Resposta padrão para requisições web
    req.flash("success", "Fonte RSS adicionada à playlist com sucesso");
    res.redirect(`/playlists/${id}/edit`);
  } catch (error) {
    console.error("Erro ao adicionar fonte RSS à playlist:", error);

    // Verificar se é uma requisição da API ou do formulário web
    if (req.xhr || req.headers["content-type"] === "application/json") {
      return res.status(500).json({
        success: false,
        message: "Erro ao adicionar fonte RSS à playlist",
      });
    }

    req.flash("error", "Erro ao adicionar fonte RSS à playlist");
    res.redirect(`/playlists/${req.params.id}/edit`);
  }
};

/**
 * Exibir formulário para adicionar item à playlist
 */
const getAddItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Buscar a playlist
    const playlist = await Playlist.findById(id)
      .populate("items.media")
      .populate("items.subPlaylist")
      .populate("items.rss"); // Adicionando populate para RSS

    if (!playlist) {
      req.flash("error", "Playlist não encontrada");
      return res.redirect("/playlists");
    }

    // Verificar se o usuário tem permissão para editar
    const hasPermission = await checkUserPermission(
      userId,
      playlist.group,
      "edit"
    );

    if (!hasPermission) {
      req.flash("error", "Você não tem permissão para editar esta playlist");
      return res.redirect("/playlists");
    }

    // Buscar mídias disponíveis para o usuário
    const media = await Media.find({ group: { $in: req.user.groups } }).sort({
      createdAt: -1,
    });

    // Buscar playlists disponíveis para o usuário (excluindo a atual)
    const playlists = await Playlist.find({
      _id: { $ne: id },
      group: { $in: req.user.groups },
    }).sort({ name: 1 });

    // Buscar fontes RSS disponíveis para o usuário
    const rssSources = await RSS.find({
      group: { $in: req.user.groups },
      active: true,
    }).sort({
      name: 1,
    });

    res.render("playlists/add-item", {
      title: "Adicionar item à playlist",
      playlist,
      media,
      playlists,
      rssSources,
      user: req.user,
    });
  } catch (error) {
    console.error("Erro ao buscar dados para adicionar item:", error);
    req.flash("error", "Erro ao buscar dados para adicionar item");
    res.redirect("/playlists");
  }
};

// Exibir formulário para criar nova playlist
const getAddPlaylist = async (req, res) => {
  try {
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
};

// Processar criação de nova playlist
const postCreatePlaylist = async (req, res) => {
  try {
    const { name, description, group, initialRssId } = req.body;

    // Validar permissão do usuário para o grupo selecionado
    if (!req.user.groups.includes(group)) {
      req.flash(
        "error",
        "Você não tem permissão para criar conteúdo neste grupo"
      );
      return res.redirect("/playlists/add");
    }

    // Criar nova playlist
    const newPlaylist = new Playlist({
      name,
      description,
      group,
      items: [],
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });

    await newPlaylist.save();

    // Se houver initialRssId, adicionar a fonte RSS à playlist
    if (initialRssId) {
      const rssItem = await RSS.findById(initialRssId);

      if (rssItem && rssItem.active) {
        // Adicionar a fonte RSS como item da playlist
        const playlistItem = {
          type: "rss",
          rss: initialRssId,
          duration: 60, // Duração padrão em segundos
          order: 0, // Primeiro item
        };

        newPlaylist.items.push(playlistItem);
        await newPlaylist.save();

        req.flash(
          "success",
          `Playlist criada com sucesso! A fonte RSS "${rssItem.name}" foi adicionada.`
        );
      } else {
        req.flash(
          "success",
          "Playlist criada com sucesso! A fonte RSS selecionada não pôde ser adicionada."
        );
      }
    } else {
      req.flash("success", "Playlist criada com sucesso!");
    }

    res.redirect(`/playlists/${newPlaylist._id}`);
  } catch (error) {
    console.error("Erro ao criar playlist:", error);
    req.flash("error", "Erro ao criar playlist. Por favor, tente novamente.");
    res.redirect("/playlists/add");
  }
};

module.exports = {
  createPlaylist,
  getPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  exportPlaylist,
  addItemToPlaylist,
  removeItemFromPlaylist,
  updatePlaylistItem,
  addSubPlaylistToPlaylist,
  addRSSToPlaylist,
  getAddItem,
  getAddPlaylist,
  postCreatePlaylist,
};
