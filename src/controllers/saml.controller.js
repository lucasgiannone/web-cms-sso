const passport = require("passport");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const Group = require("../models/group.model");

// Carrega as variáveis de ambiente
dotenv.config();

/**
 * Inicia o processo de login SAML
 */
const initiateLogin = (req, res, next) => {
  // Se o servidor SAML está configurado, tenta autenticar
  try {
    passport.authenticate("saml", {
      successRedirect: "/dashboard",
      failureRedirect: "/auth/login",
      failureFlash: true,
    })(req, res, next);
  } catch (error) {
    console.error("Erro ao iniciar autenticação SAML:", error);
    req.flash("error", "Erro ao iniciar autenticação SAML");
    res.redirect("/auth/login");
  }
};

/**
 * Processa o retorno da autenticação SAML (callback)
 */
const handleCallback = (req, res, next) => {
  // Verifica se é uma resposta do simulador local de IdP
  if (req.body.SAMLResponse && req.body.SAMLResponse.startsWith("eyJ")) {
    try {
      // Decodifica a resposta simulada (base64)
      const simulatedData = JSON.parse(atob(req.body.SAMLResponse));

      // Cria um perfil com os dados simulados
      const profile = {
        nameID: simulatedData.nameId,
        email: simulatedData.email,
        displayName: simulatedData.nome,
        group: simulatedData.grupo,
      };

      console.log("Usando dados do simulador de IdP:", profile);

      // Continua o fluxo com os dados simulados
      processUserProfile(req, res, null, profile);
      return;
    } catch (error) {
      console.error("Erro ao processar dados do simulador de IdP:", error);
      req.flash("error", "Erro ao processar dados do simulador");
      return res.redirect("/auth/login");
    }
  }

  // Caso não seja do simulador, continua com o processamento normal SAML
  passport.authenticate("saml", async (err, profile, info) => {
    try {
      processUserProfile(req, res, err, profile, info);
    } catch (error) {
      console.error("Erro no processamento da autenticação:", error);
      req.flash("error", "Erro interno durante autenticação");
      return res.redirect("/auth/login");
    }
  })(req, res, next);
};

/**
 * Função auxiliar para processar o perfil do usuário e fazer login
 */
const processUserProfile = async (req, res, err, profile, info) => {
  try {
    if (err) {
      console.error("Erro na autenticação SAML:", err);
      req.flash("error", "Erro na autenticação SAML");
      return res.redirect("/auth/login");
    }

    if (!profile) {
      console.error("Perfil SAML não encontrado:", info);
      req.flash("error", "Não foi possível autenticar via SSO");
      return res.redirect("/auth/login");
    }

    // Extrai os dados do perfil SAML
    const email = profile.email || profile.nameID;
    const name = profile.displayName || profile.nameID;

    // Busca o usuário ou cria um novo se não existir
    let user = await User.findOne({ email }).populate("group");

    if (!user) {
      // Cria um novo usuário automaticamente (pode ser modificado conforme necessário)
      user = new User({
        name: name,
        email: email,
        password: Math.random().toString(36).slice(-10), // Senha aleatória
        role: "user", // Define o papel padrão
        active: true,
      });

      // Se o perfil tiver um grupo, tenta associar
      if (profile.group) {
        const group = await Group.findOne({ name: profile.group });
        if (group) {
          user.group = group._id;
          user.role = group.defaultRole || "user";
        }
      }

      await user.save();
    }

    // Verifica se o usuário está ativo
    if (!user.active) {
      req.flash(
        "error",
        "Usuário desativado, entre em contato com o administrador"
      );
      return res.redirect("/auth/login");
    }

    // Gera o token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Armazena o usuário e o token na sessão
    req.session.token = token;

    // Atualiza o último login
    user.lastLogin = new Date();
    await user.save();

    console.log(`Usuário ${user.email} autenticado via SAML`);
    return res.redirect("/dashboard");
  } catch (error) {
    console.error("Erro ao processar perfil do usuário:", error);
    req.flash("error", "Erro ao processar perfil do usuário");
    return res.redirect("/auth/login");
  }
};

/**
 * Processa o logout SAML
 */
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Erro ao encerrar sessão:", err);
    }
    res.redirect("/auth/login");
  });
};

/**
 * Rota para gerar os metadados SAML
 */
const getMetadata = (req, res) => {
  const samlStrategy = req._passport.instance._strategies.saml;

  try {
    const metadata = samlStrategy.generateServiceProviderMetadata();
    res.header("Content-Type", "text/xml").send(metadata);
  } catch (error) {
    console.error("Erro ao gerar metadados SAML:", error);
    res.status(500).send("Erro ao gerar metadados SAML");
  }
};

/**
 * Gera um arquivo de configuração SAML para download
 */
const downloadConfig = (req, res) => {
  try {
    const samlConfig = require("../config/saml.config");
    const appUrl = process.env.APP_URL || "https://cms.suaempresa.com.br";

    // Criar objeto de configuração para download
    const config = {
      service_provider: {
        entity_id: samlConfig.issuer,
        assertion_consumer_service: {
          url: samlConfig.callbackUrl,
          binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        },
        metadata_url: `${appUrl}/auth/saml/metadata`,
        name_id_format: samlConfig.identifierFormat,
      },
      instructions: {
        pt: [
          "Configure um novo aplicativo SAML no seu provedor de identidade",
          "Defina o Entity ID (Identificador) como: " + samlConfig.issuer,
          "Defina o Reply URL (URL de Resposta) como: " +
            samlConfig.callbackUrl,
          "Use o URL de metadados para configuração automática: " +
            `${appUrl}/auth/saml/metadata`,
          "Envie o URL de Login (Entry Point) e certificado X.509 do seu provedor para nossa equipe",
        ],
        en: [
          "Set up a new SAML application in your identity provider",
          "Set the Entity ID as: " + samlConfig.issuer,
          "Set the Reply URL (Assertion Consumer Service URL) as: " +
            samlConfig.callbackUrl,
          "Use the metadata URL for automatic configuration: " +
            `${appUrl}/auth/saml/metadata`,
          "Send us the Login URL (Entry Point) and X.509 certificate from your provider",
        ],
      },
    };

    // Configurar cabeçalhos para download
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=saml-config.json"
    );
    res.setHeader("Content-Type", "application/json");

    // Enviar o arquivo
    res.json(config);
  } catch (error) {
    console.error("Erro ao gerar arquivo de configuração SAML:", error);
    req.flash("error", "Erro ao gerar arquivo de configuração SAML");
    res.redirect("/admin/saml-info");
  }
};

module.exports = {
  initiateLogin,
  handleCallback,
  logout,
  getMetadata,
  downloadConfig,
};
