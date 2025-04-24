const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Carrega as variáveis de ambiente
dotenv.config();

// Definição do modelo de Grupo
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
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Group = mongoose.model("Group", groupSchema);

// Definição do modelo de Usuário
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash da senha antes de salvar
const bcrypt = require("bcrypt");
userSchema.pre("save", async function (next) {
  const user = this;
  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  next();
});

const User = mongoose.model("User", userSchema);

// Função para inicializar o banco de dados
async function initializeDatabase() {
  try {
    // Conecta ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Conectado ao MongoDB");

    // Verifica se já existe um grupo padrão
    let adminGroup = await Group.findOne({ name: "Administração" });

    if (!adminGroup) {
      // Cria o grupo padrão
      adminGroup = new Group({
        name: "Administração",
        description: "Grupo padrão para administradores do sistema",
        active: true,
      });

      // Salva temporariamente para obter o ID
      adminGroup = await adminGroup.save();
      console.log("Grupo de administração criado com sucesso");
    }

    // Verifica se já existe um usuário admin
    const adminExists = await User.findOne({ email: "admin@sistema.com" });

    if (!adminExists) {
      // Cria o usuário admin
      const adminUser = new User({
        name: "Administrador",
        email: "admin@sistema.com",
        password: "admin123",
        role: "admin",
        group: adminGroup._id,
        active: true,
      });

      await adminUser.save();
      console.log("Usuário administrador criado com sucesso");

      // Atualiza o grupo com o ID do usuário admin
      if (!adminGroup.createdBy) {
        adminGroup.createdBy = adminUser._id;
        await adminGroup.save();
      }
    } else {
      console.log("Usuário administrador já existe");
    }

    console.log("Inicialização do banco de dados concluída com sucesso");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error);
    process.exit(1);
  }
}

// Executa a função
initializeDatabase();
