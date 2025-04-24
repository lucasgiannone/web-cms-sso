/**
 * Simulador de IdP SAML para testes de desenvolvimento
 * Este módulo simula um provedor de identidade SAML básico
 * para permitir testar o SSO sem um parceiro externo.
 */

const crypto = require("crypto");
const samlp = require("samlp");
const fs = require("fs");
const path = require("path");

// Gera pares de chaves para assinatura se não existirem
const keysFolder = path.join(__dirname, "..", "..", "keys");
const certFile = path.join(keysFolder, "idp-cert.pem");
const keyFile = path.join(keysFolder, "idp-key.pem");

// Garante que a pasta de chaves exista
if (!fs.existsSync(keysFolder)) {
  fs.mkdirSync(keysFolder, { recursive: true });
}

// Gera um novo par de chaves se não existir
if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
  console.log("Gerando par de chaves para simulação de IdP SAML...");

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

  fs.writeFileSync(keyFile, privateKey);
  fs.writeFileSync(certFile, publicKey);

  console.log("Par de chaves gerado com sucesso para simulação de IdP");
}

// Configuração do IdP de simulação
const idpConfig = {
  cert: fs.readFileSync(certFile, "utf-8"),
  key: fs.readFileSync(keyFile, "utf-8"),
  issuer: "urn:idp-simulator",
  serviceProviderId: "http://177.71.165.181/sso",
  audience: "http://177.71.165.181/sso",
  redirectEndpointPath: "/simulated-idp/login",
  logoutEndpointPath: "/simulated-idp/logout",
  loginTemplate: path.join(__dirname, "../views/saml-login-template.ejs"),
};

// Middlewares para Express
const setupIdpSimulator = (app) => {
  // Configura o middleware samlp para simular um IdP
  app.get("/simulated-idp/metadata", (req, res) => {
    res.set("Content-Type", "text/xml");
    const metadata = samlp.metadata({
      issuer: idpConfig.issuer,
      cert: idpConfig.cert,
      postEndpoint: `${req.protocol}://${req.get("host")}${
        idpConfig.redirectEndpointPath
      }`,
    });
    res.send(metadata);
  });

  // Endpoint de login simulado
  app.get("/simulated-idp", (req, res) => {
    res.render("saml-login-simulator", {
      title: "Simulador de Login SAML",
      serviceProvider: idpConfig.serviceProviderId,
    });
  });

  // Endpoint que processa o formulário de login simulado e envia a resposta SAML
  app.post("/simulated-idp/auth", (req, res) => {
    const email = req.body.email || "usuario.teste@empresa.com.br";
    const nome = req.body.nome || "Usuário de Teste";

    // Gerar resposta SAML
    samlp.auth({
      issuer: idpConfig.issuer,
      cert: idpConfig.cert,
      key: idpConfig.key,
      getPostURL: (audience, samlRequestDom, req, callback) => {
        // URL para onde a resposta SAML será enviada (nosso callback do SP)
        callback(null, "http://localhost:3003/auth/saml/callback");
      },
      getUserFromRequest: (req) => {
        // Retorna os atributos do usuário para a resposta SAML
        return {
          id: email,
          emails: [email],
          displayName: nome,
          name: {
            givenName: nome.split(" ")[0],
            familyName: nome.split(" ").slice(1).join(" "),
          },
        };
      },
      responseHandler: (response, opts, req, res) => {
        // Em vez de enviar o HTML, enviamos os dados brutos da resposta
        res.set("Content-Type", "text/html");
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Redirecionando...</title>
          </head>
          <body>
            <form id="samlform" action="http://localhost:3003/auth/saml/callback" method="post">
              <input type="hidden" name="SAMLResponse" value="${Buffer.from(
                response
              ).toString("base64")}" />
              <noscript>
                <p>Clique no botão para continuar</p>
                <input type="submit" value="Continuar" />
              </noscript>
            </form>
            <script>document.getElementById('samlform').submit();</script>
          </body>
          </html>
        `);
      },
    })(req, res);
  });

  console.log("Simulador de IdP SAML configurado e pronto para uso");
  console.log("URL do simulador: http://localhost:3003/simulated-idp");
  console.log("URL de metadados: http://localhost:3003/simulated-idp/metadata");
};

module.exports = {
  setupIdpSimulator,
  idpConfig,
};
