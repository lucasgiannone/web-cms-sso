const mongoose = require("mongoose");

const playlistItemSchema = new mongoose.Schema({
  // Campo para tipo de item: "media" para mídia, "playlist" para subplaylist, "rss" para fontes RSS
  type: {
    type: String,
    enum: ["media", "playlist", "rss"],
    default: "media",
    required: true,
  },
  // Referência para mídia (usado quando type é "media")
  media: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Media",
    required: function () {
      return this.type === "media";
    },
  },
  // Referência para subplaylist (usado quando type é "playlist")
  subPlaylist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Playlist",
    required: function () {
      return this.type === "playlist";
    },
  },
  // Referência para fonte RSS (usado quando type é "rss")
  rss: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RSS",
    required: function () {
      return this.type === "rss";
    },
  },
  duration: {
    type: Number,
    required: true,
    min: 0, // Alterado de 1 para 0 para permitir duração automática de subplaylists
  },
  order: {
    type: Number,
    required: true,
    min: 0,
  },
  startDateTime: {
    type: Date,
    default: null, // Null significa que não há data de início específica (sempre disponível)
  },
  endDateTime: {
    type: Date,
    default: null, // Null significa que não há data de fim específica (sempre disponível)
  },
});

const playlistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
    },
    items: [playlistItemSchema],
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Playlist = mongoose.model("Playlist", playlistSchema);

module.exports = Playlist;
