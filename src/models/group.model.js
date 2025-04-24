const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    permissions: {
      canManageUsers: {
        type: Boolean,
        default: false,
      },
      canManageMedia: {
        type: Boolean,
        default: false,
      },
      canManagePlaylists: {
        type: Boolean,
        default: false,
      },
      canManagePlayers: {
        type: Boolean,
        default: false,
      },
      isAdmin: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Adicionar virtuals para estatísticas
groupSchema.virtual("userCount").get(function () {
  return this._userCount || 0;
});

groupSchema.virtual("userCount").set(function (count) {
  this._userCount = count;
});

groupSchema.virtual("mediaCount").get(function () {
  return this._mediaCount || 0;
});

groupSchema.virtual("mediaCount").set(function (count) {
  this._mediaCount = count;
});

groupSchema.virtual("playlistCount").get(function () {
  return this._playlistCount || 0;
});

groupSchema.virtual("playlistCount").set(function (count) {
  this._playlistCount = count;
});

groupSchema.virtual("playerCount").get(function () {
  return this._playerCount || 0;
});

groupSchema.virtual("playerCount").set(function (count) {
  this._playerCount = count;
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;
