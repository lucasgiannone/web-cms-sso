const passport = require("passport");
const { Strategy: SamlStrategy } = require("passport-saml");
const User = require("../models/user.model");
const samlConfig = require("./saml.config");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Verifica o ambiente
const isDev = process.env.NODE_ENV !== "production";

// Configuração do Passport
module.exports = function (app) {
  // Inicializa o passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialização do usuário
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialização do usuário
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).populate("group");
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // Gerar par de chaves compatível com Node.js 22+
  if (isDev) {
    try {
      // Gerar certificado autoassinado compatível com Node.js 22+
      if (!samlConfig.cert || !samlConfig.privateKey) {
        console.log(
          "Gerando novo par de chaves RSA para ambiente de desenvolvimento..."
        );

        // Gerar novo par de chaves RSA
        const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        });

        // Usar a chave pública como certificado (simplificação para ambiente de dev)
        samlConfig.cert = publicKey;
        samlConfig.privateKey = privateKey;

        console.log("Par de chaves RSA gerado com sucesso");
      }
    } catch (error) {
      console.error("Erro ao gerar par de chaves:", error.message);
    }
  }

  try {
    // Configuração da estratégia SAML
    passport.use(
      new SamlStrategy(
        {
          // Configurações básicas
          entryPoint: samlConfig.entryPoint,
          callbackUrl: samlConfig.callbackUrl,
          issuer: samlConfig.issuer,
          logoutUrl: samlConfig.logoutUrl,

          // Certificados
          cert: samlConfig.cert,
          privateKey: samlConfig.privateKey,

          // Outras configurações
          disableRequestedAuthnContext: samlConfig.disableRequestedAuthnContext,
          signatureAlgorithm: samlConfig.signatureAlgorithm || "sha256",
          digestAlgorithm: samlConfig.digestAlgorithm || "sha256",
          identifierFormat: samlConfig.identifierFormat,
          acceptedClockSkewMs: samlConfig.acceptedClockSkewMs,

          // Configurações de validação
          validateInResponseTo: samlConfig.validateInResponseTo,
          requestIdExpirationPeriodMs: samlConfig.requestIdExpirationPeriodMs,
          forceAuthn: samlConfig.forceAuthn,
          passive: samlConfig.passive,

          // Transforma os atributos para formato amigável em camelCase
          transformAssertion: (assertion) => {
            return assertion;
          },
        },
        // Função para verificar o usuário após autenticação
        async (profile, done) => {
          try {
            if (!profile) {
              return done(new Error("Perfil SAML não fornecido"), null);
            }

            return done(null, profile);
          } catch (err) {
            return done(err, null);
          }
        }
      )
    );
    console.log("Estratégia SAML configurada com sucesso");
  } catch (error) {
    console.error("Erro ao configurar estratégia SAML:", error.message);
    console.log("O sistema continuará funcionando sem suporte a SSO");
  }

  return passport;
};
