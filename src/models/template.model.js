const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Schema para variáveis dinâmicas
 */
const DynamicVariableSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["text", "image", "rect", "circle", "triangle"],
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
    default: null,
  },
});

/**
 * Schema para templates
 */
const TemplateSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  htmlContent: {
    type: String,
    required: true,
  },
  variables: [DynamicVariableSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  active: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Atualizando a data de modificação antes de salvar
TemplateSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Template", TemplateSchema);
