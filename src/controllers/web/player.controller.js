const Player = require("../../models/player.model");
const Playlist = require("../../models/playlist.model");
const Group = require("../../models/group.model");

// Listar todos os players
exports.listPlayers = async (req, res) => {
  try {
    // Filtrar por grupo se o usuário não for admin
    let query = {};
    if (req.user.role !== "admin") {
      query.group = req.user.group;
    }

    const players = await Player.find(query)
      .populate("playlist", "name")
      .populate("group", "name")
      .sort({ name: 1 });

    // Buscar grupos disponíveis (apenas admin pode ver todos os grupos)
    let groups = [];
    if (req.user.role === "admin") {
      groups = await Group.find({ active: true }).sort({ name: 1 });
    } else {
      groups = await Group.find({ _id: req.user.group, active: true });
    }

    // Buscar playlists disponíveis
    let playlistQuery = { active: true };
    if (req.user.role !== "admin") {
      playlistQuery.group = req.user.group;
    }
    const playlists = await Playlist.find(playlistQuery).sort({ name: 1 });

    res.render("players/index", {
      players,
      groups,
      playlists,
      title: "Players",
      user: req.user,
      active: "players",
    });
  } catch (error) {
    console.error("Erro ao listar players:", error);
    req.flash("error", "Erro ao carregar a lista de players");
    res.redirect("/dashboard");
  }
};

// Exibir formulário para criar um novo player
exports.newPlayerForm = async (req, res) => {
  try {
    // Buscar grupos disponíveis (apenas admin pode ver todos os grupos)
    let groups = [];
    if (req.user.role === "admin") {
      groups = await Group.find({ active: true }).sort({ name: 1 });
    } else {
      groups = await Group.find({ _id: req.user.group, active: true });
    }

    // Buscar playlists disponíveis
    let playlistQuery = { active: true };
    if (req.user.role !== "admin") {
      playlistQuery.group = req.user.group;
    }

    const playlists = await Playlist.find(playlistQuery).sort({ name: 1 });

    res.render("players/form", {
      title: "Novo Player",
      groups,
      playlists,
      user: req.user,
      active: "players",
    });
  } catch (error) {
    console.error("Erro ao carregar formulário de novo player:", error);
    req.flash("error", "Erro ao carregar o formulário");
    res.redirect("/players");
  }
};

// Criar um novo player
exports.createPlayer = async (req, res) => {
  try {
    const { name, description, hardware_id, group, playlist } = req.body;

    // Verificar se já existe um player com este hardware_id
    const existingPlayer = await Player.findOne({ hardware_id });
    if (existingPlayer) {
      req.flash(
        "error",
        "Já existe um player registrado com este ID de hardware"
      );
      return res.redirect("/players/new");
    }

    // Criar o novo player
    const player = new Player({
      name,
      description,
      hardware_id,
      group: group || req.user.group,
      playlist: playlist || null,
      status: "offline",
      created_by: req.user._id,
      created_at: new Date(),
    });

    await player.save();

    req.flash("success", "Player criado com sucesso");
    res.redirect("/players");
  } catch (error) {
    console.error("Erro ao criar player:", error);
    req.flash("error", "Erro ao criar o player");
    res.redirect("/players/new");
  }
};

// Exibir detalhes de um player
exports.viewPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Buscando player com ID: ${id}`);

    // Buscar o player com suas relações
    const player = await Player.findById(id)
      .populate({
        path: "playlist",
        match: { active: true }, // Apenas playlists ativas
        select: "name description items active",
        populate: {
          path: "items.media",
          select: "name type duration",
        },
      })
      .populate("group", "name");

    if (!player) {
      console.log("Player não encontrado");
      req.flash("error", "Player não encontrado");
      return res.redirect("/players");
    }

    console.log("Player encontrado:", {
      id: player._id,
      name: player.name,
      playlist: player.playlist
        ? {
            id: player.playlist._id,
            name: player.playlist.name,
            active: player.playlist.active,
          }
        : null,
    });

    // Se a playlist não estiver ativa, remover a referência
    if (player.playlist && !player.playlist.active) {
      console.log("Playlist inativa encontrada, removendo referência");
      player.playlist = null;
      await player.save();
    }

    // Verificar permissão (apenas admin ou mesmo grupo)
    if (
      req.user.role !== "admin" &&
      player.group &&
      player.group._id.toString() !== req.user.group.toString()
    ) {
      console.log("Usuário sem permissão para visualizar o player");
      req.flash("error", "Você não tem permissão para visualizar este player");
      return res.redirect("/players");
    }

    // Buscar grupos disponíveis
    const groups = await Group.find({ active: true }).sort({ name: 1 });

    // Buscar playlists disponíveis para atribuição
    let playlistQuery = { active: true };
    if (req.user.role !== "admin") {
      playlistQuery.group = req.user.group;
    }

    const playlists = await Playlist.find(playlistQuery).sort({ name: 1 });
    console.log(`Encontradas ${playlists.length} playlists disponíveis`);

    res.render("players/view", {
      title: `Player - ${player.name}`,
      player,
      groups,
      playlists,
      user: req.user,
      active: "players",
    });
  } catch (error) {
    console.error("Erro ao visualizar player:", error);
    if (error.name === "CastError") {
      req.flash("error", "ID do player inválido");
    } else if (error.name === "ValidationError") {
      req.flash("error", "Dados do player inválidos");
    } else {
      req.flash("error", "Erro ao carregar os detalhes do player");
    }
    res.redirect("/players");
  }
};

// Exibir formulário para editar um player
exports.editPlayerForm = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar o player
    const player = await Player.findById(id);

    if (!player) {
      req.flash("error", "Player não encontrado");
      return res.redirect("/players");
    }

    // Verificar permissão (apenas admin ou mesmo grupo)
    if (
      req.user.role !== "admin" &&
      player.group &&
      player.group.toString() !== req.user.group.toString()
    ) {
      req.flash("error", "Você não tem permissão para editar este player");
      return res.redirect("/players");
    }

    // Buscar grupos disponíveis
    let groups = [];
    if (req.user.role === "admin") {
      groups = await Group.find({ active: true }).sort({ name: 1 });
    } else {
      groups = await Group.find({ _id: req.user.group, active: true });
    }

    // Buscar playlists disponíveis
    let playlistQuery = { active: true };
    if (req.user.role !== "admin") {
      playlistQuery.group = req.user.group;
    }

    const playlists = await Playlist.find(playlistQuery).sort({ name: 1 });

    res.render("players/form", {
      title: "Editar Player",
      player,
      playerId: id,
      groups,
      playlists,
      user: req.user,
      active: "players",
    });
  } catch (error) {
    console.error("Erro ao carregar formulário de edição:", error);
    req.flash("error", "Erro ao carregar o formulário de edição");
    res.redirect("/players");
  }
};

// Atualizar um player
exports.updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, group, playlist, authorized, windowConfig } =
      req.body;

    // Buscar o player
    const player = await Player.findById(id);

    if (!player) {
      req.flash("error", "Player não encontrado");
      return res.redirect("/players");
    }

    // Verificar permissão (apenas admin ou mesmo grupo)
    if (
      req.user.role !== "admin" &&
      player.group &&
      player.group.toString() !== req.user.group.toString()
    ) {
      req.flash("error", "Você não tem permissão para editar este player");
      return res.redirect("/players");
    }

    // Atualizar os campos
    player.name = name;
    player.description = description;

    // Atualizar o status de autorização
    player.authorized = authorized === "on";

    // Apenas admin pode mudar o grupo
    if (req.user.role === "admin" && group) {
      player.group = group;
    }

    // Atualizar playlist se fornecida
    if (playlist) {
      player.playlist = playlist;
    }

    // Atualizar configurações de janela, se fornecidas
    if (windowConfig) {
      player.windowConfig = {
        width: parseInt(windowConfig.width || 1280),
        height: parseInt(windowConfig.height || 720),
        borderless: windowConfig.borderless === "on",
        position: windowConfig.position || "top-left",
      };
    }

    await player.save();

    req.flash("success", "Player atualizado com sucesso");
    res.redirect("/players");
  } catch (error) {
    console.error("Erro ao atualizar player:", error);
    req.flash("error", "Erro ao atualizar o player");
    res.redirect(`/players/${req.params.id}/edit`);
  }
};

// Excluir um player
exports.deletePlayer = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar o player
    const player = await Player.findById(id);

    if (!player) {
      req.flash("error", "Player não encontrado");
      return res.redirect("/players");
    }

    // Verificar permissão (apenas admin ou mesmo grupo)
    if (
      req.user.role !== "admin" &&
      player.group &&
      player.group.toString() !== req.user.group.toString()
    ) {
      req.flash("error", "Você não tem permissão para excluir este player");
      return res.redirect("/players");
    }

    // Excluir o player
    await Player.findByIdAndDelete(id);

    req.flash("success", "Player excluído com sucesso");
    res.redirect("/players");
  } catch (error) {
    console.error("Erro ao excluir player:", error);
    req.flash("error", "Erro ao excluir o player");
    res.redirect("/players");
  }
};

// Atribuir playlist a um player
exports.assignPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { playlist_id } = req.body;

    // Buscar o player
    const player = await Player.findById(id);

    if (!player) {
      req.flash("error", "Player não encontrado");
      return res.redirect("/players");
    }

    // Verificar permissão (apenas admin ou mesmo grupo)
    if (
      req.user.role !== "admin" &&
      player.group.toString() !== req.user.group.toString()
    ) {
      req.flash(
        "error",
        "Você não tem permissão para atribuir playlist a este player"
      );
      return res.redirect("/players");
    }

    // Verificar se a playlist existe
    const playlist = await Playlist.findById(playlist_id);
    if (!playlist) {
      req.flash("error", "Playlist não encontrada");
      return res.redirect(`/players/${id}`);
    }

    // Verificar se o usuário não-admin pode usar esta playlist
    if (
      req.user.role !== "admin" &&
      playlist.group.toString() !== req.user.group.toString()
    ) {
      req.flash("error", "Você não tem permissão para usar esta playlist");
      return res.redirect(`/players/${id}`);
    }

    // Atribuir a playlist ao player
    player.playlist = playlist_id;
    await player.save();

    req.flash("success", "Playlist atribuída com sucesso");
    res.redirect(`/players/${id}`);
  } catch (error) {
    console.error("Erro ao atribuir playlist:", error);
    req.flash("error", "Erro ao atribuir playlist ao player");
    res.redirect(`/players/${req.params.id}`);
  }
};

// Gerar uma nova chave de player
exports.generatePlayerKey = async (req, res) => {
  try {
    const { v4: uuidv4 } = require("uuid");

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

    req.flash("success", "Chave de player gerada com sucesso!");
    return res.redirect("/players");
  } catch (error) {
    console.error("Erro ao gerar chave de player:", error);
    req.flash("error", "Erro ao gerar chave de player");
    return res.redirect("/players");
  }
};

// Limpar chaves do player
exports.clearPlayerKey = async (req, res) => {
  try {
    const { hardware_id } = req.body;

    // Buscar o player pelo hardware_id
    const player = await Player.findOne({ hardware_id });

    if (!player) {
      req.flash("error", "Player não encontrado");
      return res.redirect("/players");
    }

    // Limpar a chave e marcar como não autorizado
    player.player_key = null;
    player.authorized = false;
    await player.save();

    req.flash("success", "Chave do player removida com sucesso");
    return res.redirect("/players");
  } catch (error) {
    console.error("Erro ao limpar chave do player:", error);
    req.flash("error", "Erro ao limpar chave do player");
    return res.redirect("/players");
  }
};
