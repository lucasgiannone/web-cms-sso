/**
 * Serviço para notificar os players sobre mudanças
 */

// Importar o modelo Player
const Player = require("../models/player.model");

/**
 * Notifica os players sobre atualizações de playlist
 * @param {string} playlistId - ID da playlist atualizada
 * @param {boolean} restartPlayback - Se deve reiniciar a reprodução (opcional)
 */
const notifyPlaylistUpdate = async (playlistId, restartPlayback = false) => {
  try {
    // Verificar se há uma instância global do Socket.io
    const io = global.io;
    if (!io) {
      console.warn("Socket.io não está disponível para notificação");
      return;
    }

    // Buscar todos os players que estão usando esta playlist
    const players = await Player.find({
      playlist: playlistId,
      status: "online",
    });

    if (players.length === 0) {
      console.log(`Nenhum player online usando a playlist ${playlistId}`);
      return;
    }

    console.log(
      `Notificando ${players.length} players sobre atualização da playlist ${playlistId}`
    );

    // Notificar cada player individualmente
    for (const player of players) {
      // Emitir evento para a sala específica do player
      io.to(`player:${player._id}`).emit("playlist-update", {
        playlistId,
        timestamp: new Date().toISOString(),
        restartPlayback: restartPlayback || false,
      });

      console.log(
        `Notificação enviada para o player ${player.name} (${player._id})`
      );
    }
  } catch (error) {
    console.error(
      "Erro ao notificar players sobre atualização de playlist:",
      error
    );
  }
};

module.exports = {
  notifyPlaylistUpdate,
};
