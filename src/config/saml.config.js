const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Carrega as variáveis de ambiente
dotenv.config();

// Verificar ambiente
const isDev = process.env.NODE_ENV !== "production";

// URL base da aplicação
const BASE_URL = process.env.APP_URL || "http://177.71.165.181";

// URL do IdP simulado em ambiente de desenvolvimento
const DEV_IDP_URL = "http://177.71.165.181/simulated-idp";

// Configuração SAML
const samlConfig = {
  // Identificador da entidade (Entity ID)
  entryPoint: isDev
    ? process.env.SAML_ENTRY_POINT || `${DEV_IDP_URL}/login`
    : process.env.SAML_ENTRY_POINT ||
      "https://idp.parceiro.com.br/saml2/idp/sso",

  // URL para onde o IdP enviará as respostas SAML (Reply URL / Assertion Consumer Service URL)
  callbackUrl: `${BASE_URL}/auth/saml/callback`,

  // Identificador da aplicação (Entity ID da Service Provider)
  issuer: process.env.SAML_ISSUER || `${BASE_URL}/sso`,

  // URL de logout
  logoutUrl: process.env.SAML_LOGOUT_URL || `${BASE_URL}/auth/logout`,

  // Outros parâmetros
  disableRequestedAuthnContext: true,
  signatureAlgorithm: "sha256",
  digestAlgorithm: "sha256",

  // Configuração de certificados
  // Caminho para o certificado da IdP (caso seja fornecido)
  cert: process.env.SAML_CERT || "",

  // Se precisar usar arquivos de certificado
  privateKey: process.env.SAML_PRIVATE_KEY || "",

  // Mapeamento de atributos
  identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
  acceptedClockSkewMs: 5000,

  // Validações adicionais
  validateInResponseTo: true,
  requestIdExpirationPeriodMs: 60 * 60 * 1000, // 1 hora

  // Outras configurações
  forceAuthn: false,
  passive: false,
};

// No modo de desenvolvimento, carrega o certificado do IdP simulado se existir
if (isDev) {
  try {
    const idpCertPath = path.join(
      __dirname,
      "..",
      "..",
      "keys",
      "idp-cert.pem"
    );
    if (fs.existsSync(idpCertPath)) {
      samlConfig.cert = fs.readFileSync(idpCertPath, "utf-8");
      console.log("Certificado do IdP simulado carregado");
    }
  } catch (error) {
    console.error("Erro ao carregar certificado simulado:", error.message);
  }
}

module.exports = samlConfig;
