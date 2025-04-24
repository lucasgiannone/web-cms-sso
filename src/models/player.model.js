const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  hardware_id: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
  },
  player_key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["online", "offline", "error"],
    default: "offline",
  },
  playlist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Playlist",
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  authorized: {
    type: Boolean,
    default: false,
  },
  windowConfig: {
    width: { type: Number, default: 1280 },
    height: { type: Number, default: 720 },
    borderless: {
      type: Boolean,
      default: false,
    },
    position: {
      type: String,
      enum: ["top-left", "top-right", "bottom-left", "bottom-right"],
      default: "top-left",
    },
  },
  last_connection: {
    type: Date,
    default: Date.now,
  },
  current_media: {
    type: String,
  },
  logs: [
    {
      timestamp: {
        type: Date,
        default: Date.now,
      },
      level: {
        type: String,
        enum: ["info", "warning", "error"],
        default: "info",
      },
      message: {
        type: String,
        required: true,
      },
    },
  ],
  created_at: {
    type: Date,
    default: Date.now,
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

// Remove todos os índices existentes para evitar conflitos
playerSchema.collection?.dropIndexes();

// Recria apenas os índices necessários
playerSchema.index({ player_key: 1 }, { unique: true });
playerSchema.index({ hardware_id: 1 }, { unique: true, sparse: true });
playerSchema.index({ group: 1 });
playerSchema.index({ status: 1 });
playerSchema.index({ active: 1 });

const Player = mongoose.model("Player", playerSchema);

module.exports = Player;
