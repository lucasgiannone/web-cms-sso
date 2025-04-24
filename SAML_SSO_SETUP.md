# Configuração do SAML Single Sign-On (SSO)

Este documento descreve como configurar o SAML SSO para integração com provedores de identidade.

## Visão Geral

O Single Sign-On (SSO) permite que usuários acessem nosso CMS usando suas credenciais existentes de um provedor de identidade (IdP) como Azure AD, Okta, OneLogin, etc. Isso elimina a necessidade de criar e gerenciar credenciais separadas para o CMS.

## Pré-requisitos

- Ter acesso administrativo ao CMS
- Ter acesso ao provedor de identidade SAML (IdP) para configuração
- Certificado X.509 do provedor de identidade (se necessário)

## Informações Necessárias para Integração

Para configurar o SSO em seu provedor de identidade, você precisará das seguintes informações:

1. **Entity ID (Identificador da Entidade)**: `http://177.71.165.181/sso` (configurável via variável de ambiente)
2. **Reply URL (URL de Resposta)**: `http://177.71.165.181/auth/saml/callback` (configurável via variável de ambiente)
3. **Metadata URL**: `http://177.71.165.181/auth/saml/metadata`

Essas informações podem ser visualizadas na página "Configuração SSO" no menu Administração do CMS.

## Configuração no Provedor de Identidade

A configuração específica depende do provedor de identidade que você está usando. Geralmente, os passos incluem:

1. Criar um novo aplicativo ou integração SAML
2. Configurar o Entity ID e Reply URL conforme fornecidos acima
3. Configurar os atributos que serão enviados (geralmente email, nome, etc.)
4. Obter o URL de login (Entry Point) e certificado X.509 do IdP

## Configuração no CMS

1. Acesse o arquivo `.env` na raiz do projeto e configure as seguintes variáveis:

```
SAML_ENTRY_POINT=https://idp.parceiro.com.br/saml2/idp/sso
SAML_ISSUER=http://177.71.165.181/sso
SAML_CERT=certificado_base64_do_idp
SAML_PRIVATE_KEY=chave_privada_se_necessario
SAML_LOGOUT_URL=http://177.71.165.181/auth/logout
APP_URL=http://177.71.165.181
```

2. Reinicie o servidor após configurar as variáveis de ambiente

## Solução de Problemas

Se encontrar problemas na autenticação SAML:

1. Verifique se as configurações no provedor de identidade correspondem exatamente às fornecidas pelo CMS
2. Certifique-se de que o certificado do IdP foi configurado corretamente
3. Verifique os logs do servidor para mensagens de erro específicas
4. Teste a autenticação em um navegador em modo privado/anônimo

## Atributos SAML

O CMS espera receber pelo menos os seguintes atributos do provedor de identidade:

- `nameID` ou `email`: O endereço de email do usuário (obrigatório)
- `displayName` ou `firstName`: O nome do usuário (opcional, mas recomendado)

## Suporte

Para mais informações ou suporte para configuração do SAML SSO, entre em contato com o administrador do sistema.
