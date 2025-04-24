const Player = require("../models/player.model");
const Playlist = require("../models/playlist.model");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

/**
 * Gera uma nova chave de player
 */
const generatePlayerKey = async (req, res) => {
  try {
    // Gerar uma chave única usando UUID
    const playerKey = uuidv4();

    // Criar um novo player com apenas a chave
    const player = new Player({
      name: `Novo Player (${new Date().toLocaleDateString("pt-BR")})`,
      description: "Player aguardando configuração",
      hardware_id: `temp-${playerKey.substring(0, 8)}`,
      player_key: playerKey,
      status: "offline",
      authorized: false,
      last_connection: new Date(),
      created_at: new Date(),
      created_by: req.user._id,
      group: req.user.group, // Adicionar o grupo do usuário que está criando
    });

    await player.save();

    // Se a requisição veio da API
    if (req.path.startsWith("/api/")) {
      return res.status(201).json({
        success: true,
        message: "Chave de player gerada com sucesso",
        player: {
          id: player._id,
          key: player.player_key,
        },
      });
    }

    // Se a requisição veio da web
    req.flash("success", "Chave de player gerada com sucesso!");
    return res.redirect("/players");
  } catch (error) {
    console.error("Erro ao gerar chave de player:", error);

    // Se a requisição veio da API
    if (req.path.startsWith("/api/")) {
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar chave de player",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    // Se a requisição veio da web
    req.flash("error", "Erro ao gerar chave de player");
    return res.redirect("/players");
  }
};

/**
 * Ativa um player usando a chave gerada
 */
const activatePlayerWithKey = async (req, res) => {
  try {
    const { player_key, hardware_id } = req.body;

    if (!player_key || !hardware_id) {
      return res
        .status(400)
        .json({ message: "Chave do player e ID de hardware são obrigatórios" });
    }

    // Buscar o player pela chave
    const player = await Player.findOne({ player_key });
    if (!player) {
      return res.status(404).json({ message: "Chave de player inválida" });
    }

    // Atualizar o hardware_id e marcar como autorizado
    player.hardware_id = hardware_id;
    player.authorized = true;
    player.last_connection = new Date();

    await player.save();

    // Gerar token de autenticação
    const token = jwt.sign(
      { player_id: player._id, hardware_id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Player ativado com sucesso",
      player_id: player._id,
      auth_token: token,
    });
  } catch (error) {
    console.error("Erro ao ativar player:", error);
    res.status(500).json({ message: "Erro ao ativar player" });
  }
};

/**
 * Registra um novo player
 */
const registerPlayer = async (req, res) => {
  try {
    const { name, description, hardware_id } = req.body;

    if (!name || !hardware_id) {
      return res
        .status(400)
        .json({ message: "Nome e ID de hardware são obrigatórios" });
    }

    // Verifica se já existe um player com o mesmo ID único
    const existingPlayer = await Player.findOne({ hardware_id });
    if (existingPlayer) {
      return res.status(400).json({
        message: "Já existe um player registrado com este ID de hardware",
      });
    }

    // Cria o novo player
    const player = new Player({
      name,
      description,
      hardware_id,
      status: "offline",
      last_connection: new Date(),
      created_at: new Date(),
    });

    await player.save();

    // Gerar token de autenticação
    const token = jwt.sign(
      { player_id: player._id, hardware_id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      message: "Player registrado com sucesso",
      player_id: player._id,
      auth_token: token,
    });
  } catch (error) {
    console.error("Erro ao registrar player:", error);
    res.status(500).json({ message: "Erro ao registrar player" });
  }
};

/**
 * Autentica um player existente
 */
const authenticatePlayer = async (req, res) => {
  try {
    const { player_id, hardware_id } = req.body;

    if (!player_id || !hardware_id) {
      return res
        .status(400)
        .json({ message: "ID do player e ID de hardware são obrigatórios" });
    }

    // Verifica se o player existe e se o hardware_id corresponde
    const player = await Player.findOne({ _id: player_id, hardware_id });
    if (!player) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // Atualiza último acesso
    player.last_connection = new Date();
    await player.save();

    // Gerar token de autenticação
    const token = jwt.sign(
      { player_id: player._id, hardware_id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Autenticação bem-sucedida",
      player_id: player._id,
      auth_token: token,
    });
  } catch (error) {
    console.error("Erro ao autenticar player:", error);
    res.status(500).json({ message: "Erro ao autenticar player" });
  }
};

/**
 * Lista todos os players (filtrados por grupo do usuário)
 */
const getPlayers = async (req, res) => {
  try {
    let query = { active: true };

    // Filtra por grupo se não for admin
    if (req.user.role !== "admin") {
      query.group = req.user.group;
    }

    // Buscar os players com as referências populadas
    const players = await Player.find(query)
      .populate("group", "name")
      .populate("playlist", "name")
      .sort({ created_at: -1 });

    // Se a requisição veio da API
    if (req.path.startsWith("/api/")) {
      return res.status(200).json({
        success: true,
        data: players,
      });
    }

    // Se a requisição veio da web
    return res.render("players/index", {
      title: "Players",
      players: players,
    });
  } catch (error) {
    console.error("Erro ao listar players:", error);

    // Se a requisição veio da API
    if (req.path.startsWith("/api/")) {
      return res.status(500).json({
        success: false,
        message: "Erro ao listar players",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    // Se a requisição veio da web
    req.flash("error", "Erro ao listar players");
    return res.redirect("back");
  }
};

/**
 * Obtém um player específico pelo ID
 */
const getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate("group", "name")
      .populate("registeredBy", "name")
      .populate("playlist", "name");

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player não encontrado",
      });
    }

    // Verifica se o usuário tem permissão para ver este player
    if (
      req.user.role !== "admin" &&
      req.user.group.toString() !== player.group._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Acesso negado. Você só pode ver players do seu grupo.",
      });
    }

    res.status(200).json({
      success: true,
      data: player,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao buscar player",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Atualiza um player existente
 */
const updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, authorized, playlist, group, windowConfig } =
      req.body;

    const updateData = {
      name,
      description,
    };

    // Adicionar campos opcionais se fornecidos
    if (authorized !== undefined) {
      updateData.authorized = authorized === "on" || authorized === true;
    }

    if (playlist) {
      updateData.playlist = playlist;
    }

    if (group) {
      updateData.group = group;
    }

    // Atualizar configurações de janela, se fornecidas
    if (windowConfig) {
      updateData.windowConfig = {
        width: parseInt(windowConfig.width) || 1280,
        height: parseInt(windowConfig.height) || 720,
        borderless:
          windowConfig.borderless === "on" || windowConfig.borderless === true,
        position: windowConfig.position || "top-left",
      };
    }

    const player = await Player.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!player) {
      return res.status(404).json({ message: "Player não encontrado" });
    }

    res.status(200).json(player);
  } catch (error) {
    console.error("Erro ao atualizar player:", error);
    res.status(500).json({ message: "Erro ao atualizar player" });
  }
};

/**
 * Remove um player (soft delete)
 */
const deletePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const player = await Player.findByIdAndDelete(id);

    if (!player) {
      return res.status(404).json({ message: "Player não encontrado" });
    }

    res.status(200).json({ message: "Player excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir player:", error);
    res.status(500).json({ message: "Erro ao excluir player" });
  }
};

/**
 * Retorna a playlist atribuída a um player
 */
const getPlayerPlaylist = async (req, res) => {
  try {
    const { id } = req.params;

    // Função auxiliar para processar subplaylists recursivamente
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
          select: "name type duration filePath",
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
          // Construir a URL completa para a mídia
          const mediaUrl = `${
            process.env.API_URL || "http://177.71.165.181"
          }/api/media/${item.media._id}/file`;

          // Adicionar mídia direta
          processedItems.push({
            id: item._id,
            media_id: item.media._id,
            name: item.media.name,
            type: item.media.type,
            url: mediaUrl,
            duration:
              item.duration ||
              item.media.duration ||
              (item.media.type === "video" ? 0 : 10000), // 0 para vídeos (duração automática)
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
          // Obter a URL do RSS - usar o campo url diretamente ou construir a partir do source
          const rssUrl =
            item.rss.url ||
            `http://localhost/combo_rss/${item.rss.source}/default/`;

          console.log(
            `Processando item RSS: ${item.rss._id || item.rss} para player`
          );

          // Agora que temos o populate, podemos usar diretamente item.rss
          const rssName = item.rss.name || "Feed RSS";
          const rssId = item.rss._id || item.rss;

          // Adicionar item RSS à lista de processados
          processedItems.push({
            id: item._id,
            rss: rssId, // ID do RSS
            name: rssName, // Nome do RSS
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

          console.log(
            `Item RSS ${rssId} (${rssName}) adicionado à playlist do player`
          );
        }
      }

      return processedItems;
    };

    // Verificar se o player existe e popular a playlist
    const player = await Player.findById(id).populate("playlist");

    if (!player) {
      return res.status(404).json({ message: "Player não encontrado" });
    }

    // Verificar se o player tem uma playlist atribuída
    if (!player.playlist) {
      return res.status(404).json({
        message: "Nenhuma playlist atribuída a este player",
        player_id: player._id,
        player_name: player.name,
      });
    }

    // Verificar se a playlist está ativa
    if (!player.playlist.active) {
      return res.status(404).json({
        message: "A playlist atribuída está inativa",
        player_id: player._id,
        player_name: player.name,
        playlist_id: player.playlist._id,
      });
    }

    // Processar todos os itens da playlist, incluindo subplaylists
    const allItems = await processPlaylistItems(player.playlist._id);

    // Verificar se há itens processados
    if (allItems.length === 0) {
      return res.status(404).json({
        message: "A playlist não possui itens válidos",
        player_id: player._id,
        player_name: player.name,
        playlist_id: player.playlist._id,
        playlist_name: player.playlist.name,
      });
    }

    // Formatar a resposta para o formato esperado pelo player
    const formattedPlaylist = {
      id: player.playlist._id,
      name: player.playlist.name,
      description: player.playlist.description,
      items: allItems.sort((a, b) => a.order - b.order),
    };

    // Atualizar o status do player
    player.status = "online";
    player.last_connection = new Date();
    await player.save();

    return res.status(200).json({
      success: true,
      message: "Playlist encontrada",
      playlist: formattedPlaylist,
    });
  } catch (error) {
    console.error("Erro ao buscar playlist do player:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar playlist do player",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Atualizar o status de um player
 */
const updatePlayerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, currentMedia, logs } = req.body;

    // Verificar se o player existe
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ message: "Player não encontrado" });
    }

    // Atualizar o status do player
    player.status = status || player.status;
    player.current_media = currentMedia || player.current_media;
    player.last_connection = new Date();

    // Adicionar logs se fornecidos
    if (logs && Array.isArray(logs)) {
      // Limitar o número de logs armazenados (opcional)
      const maxLogs = 100;
      player.logs = [...logs, ...(player.logs || [])].slice(0, maxLogs);
    }

    await player.save();

    res
      .status(200)
      .json({ message: "Status do player atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar status do player:", error);
    res.status(500).json({ message: "Erro ao atualizar status do player" });
  }
};

/**
 * Obter todos os players
 */
const getAllPlayers = async (req, res) => {
  try {
    const players = await Player.find().populate("playlist", "name");
    res.status(200).json(players);
  } catch (error) {
    console.error("Erro ao obter players:", error);
    res.status(500).json({ message: "Erro ao obter players" });
  }
};

/**
 * Atribuir uma playlist a um player
 */
const assignPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { playlist_id } = req.body;

    if (!playlist_id) {
      return res.status(400).json({ message: "ID da playlist é obrigatório" });
    }

    // Verificar se o player existe
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ message: "Player não encontrado" });
    }

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(playlist_id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist não encontrada" });
    }

    // Atribuir a playlist ao player
    player.playlist = playlist_id;
    await player.save();

    res
      .status(200)
      .json({ message: "Playlist atribuída com sucesso ao player" });
  } catch (error) {
    console.error("Erro ao atribuir playlist ao player:", error);
    res.status(500).json({ message: "Erro ao atribuir playlist ao player" });
  }
};

/**
 * Verificar autorização de um player (usado pelo player para verificar se está autorizado)
 */
const checkPlayerAuthorization = async (req, res) => {
  try {
    const hardwareId = req.params.uniqueId;

    if (!hardwareId) {
      return res.status(400).json({
        authorized: false,
        message: "ID de hardware não fornecido",
      });
    }

    const player = await Player.findOne({ hardware_id: hardwareId }).populate(
      "playlist"
    );

    if (!player) {
      return res.status(404).json({
        authorized: false,
        message: "Player não encontrado",
      });
    }

    // Atualizar data de última conexão
    player.last_connection = new Date();
    player.status = "online";
    await player.save();

    // Se player não está autorizado
    if (!player.authorized) {
      return res.status(200).json({
        authorized: false,
        playerId: player._id,
        message: "Player não autorizado",
      });
    }

    // Construir objeto de resposta
    const responseObj = {
      authorized: true,
      playerId: player._id,
      playerKey: player.player_key,
      playerName: player.name,
      playlist: player.playlist ? player.playlist._id : null,
      windowConfig: player.windowConfig || {
        width: 1280,
        height: 720,
        borderless: false,
        position: "top-left",
      },
    };

    return res.status(200).json(responseObj);
  } catch (error) {
    console.error("Erro ao verificar autorização:", error);
    return res.status(500).json({
      authorized: false,
      message: "Erro ao verificar autorização",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Receber e processar ping de status online do player
 */
const receivePlayerPing = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, hardware_id, timestamp } = req.body;

    // Verificar se o player existe
    const player = await Player.findById(id);
    if (!player) {
      return res
        .status(404)
        .json({ success: false, message: "Player não encontrado" });
    }

    // Verificar se o hardware_id corresponde
    if (player.hardware_id && player.hardware_id !== hardware_id) {
      return res.status(403).json({
        success: false,
        message: "Hardware ID não corresponde ao registrado para este player",
      });
    }

    // Atualizar informações de conexão do player
    player.status = status || "online";
    player.last_connection = new Date();

    // Salvar as alterações
    await player.save();

    // Registrar no log
    console.log(
      `Ping recebido do player ${player.name} (${id}) - Status: ${player.status}`
    );

    // Responder com sucesso
    return res.status(200).json({
      success: true,
      message: "Ping recebido com sucesso",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao processar ping do player:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao processar ping do player",
    });
  }
};

/**
 * Verifica o status de um player sob demanda
 * Esta função tenta se comunicar com o player para verificar se está online
 */
const checkPlayerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o player existe
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player não encontrado",
      });
    }

    // Verificamos a última vez que o player enviou um ping
    // Se foi nos últimos 20 segundos, consideramos que está online
    const lastConnection = new Date(player.last_connection);
    const now = new Date();
    const diffMs = now - lastConnection;
    const diffSeconds = Math.floor(diffMs / 1000);

    // Se a última conexão foi há menos de 20 segundos, o player está online
    const isOnline = diffSeconds < 20;
    const status = isOnline ? "online" : "offline";

    // Se o status mudou, salvamos no banco
    if (player.status !== status) {
      player.status = status;
      await player.save();
    }

    return res.status(200).json({
      success: true,
      status: player.status,
      last_connection: player.last_connection,
      message: `Status do player verificado: ${player.status}`,
      lastConnectionSeconds: diffSeconds,
    });
  } catch (error) {
    console.error("Erro ao verificar status do player:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao verificar status do player",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  registerPlayer,
  authenticatePlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
  getPlayerPlaylist,
  updatePlayerStatus,
  getAllPlayers,
  assignPlaylist,
  checkPlayerAuthorization,
  generatePlayerKey,
  activatePlayerWithKey,
  receivePlayerPing,
  checkPlayerStatus,
};
