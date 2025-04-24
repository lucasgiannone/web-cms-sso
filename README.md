# Sistema de Gerenciamento de Conteúdo (CMS) para Player Gustavo

Este é um sistema web para gerenciamento de conteúdo multimídia, usuários, grupos e players. O sistema permite o upload de mídias, criação de playlists e autorização de players.

## Funcionalidades

- **Gerenciamento de Usuários e Grupos**

  - Cadastro de usuários e grupos
  - Controle de acesso baseado em grupos
  - Perfis de administrador e usuário comum

- **Biblioteca de Mídias**

  - Upload de imagens, vídeos e templates HTML
  - Organização por grupo
  - Visualização restrita por grupo
  - Preview em tempo real para todos os tipos de mídia
  - Visualização em tela cheia para avaliação de conteúdo

- **Templates HTML**

  - Suporte completo a templates HTML interativos
  - Preview embutido em todas as áreas do sistema
  - Integração com Template Builder para criação
  - Visualização em tempo real no dashboard e biblioteca
  - Suporte a scripts com sandbox seguro

- **Criação de Playlists**

  - Ordenação de mídias com preview visual
  - Definição de tempo de exibição
  - Exportação para o player
  - Suporte a todos os tipos de mídia em uma playlist
  - Miniaturas visuais para cada item da playlist

- **Autorização de Players**
  - Registro de players
  - Autorização e revogação de acesso
  - Associação com grupos e playlists
  - Monitoramento de status em tempo real

## Requisitos

- Node.js (v14+)
- MongoDB
- NPM ou Yarn

## Instalação

1. Clone o repositório:

   ```
   git clone <url-do-repositorio>
   cd web-cms
   ```

2. Instale as dependências:

   ```
   npm install
   ```

3. Configure as variáveis de ambiente:

   - Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/cms
   JWT_SECRET=sua_chave_secreta_muito_segura
   SESSION_SECRET=outra_chave_secreta_para_sessao
   NODE_ENV=development
   UPLOAD_PATH=./src/public/uploads/media
   ```

4. Inicialize o banco de dados com o usuário admin:

   ```
   npm run init-db
   ```

5. Inicie o servidor:
   ```
   npm run dev
   ```

## Uso

Após iniciar o servidor, acesse `http://177.71.165.181` no navegador.

### Credenciais padrão:

- Email: admin@sistema.com
- Senha: admin123

### Dashboard

O dashboard apresenta uma visão geral do sistema, com estatísticas e mídias recentes, incluindo previews para templates HTML.

### Biblioteca de Mídias

A biblioteca permite o upload, visualização e gerenciamento de todos os tipos de mídia, com previews em tempo real para templates HTML.

### Playlists

O sistema permite criar e gerenciar playlists com diferentes tipos de mídia, incluindo imagens, vídeos e templates HTML.

## Integração com o Player

O player Gustavo deve ser configurado para se autenticar neste sistema e baixar as playlists. O player renderiza perfeitamente todos os tipos de mídia, incluindo templates HTML com as adaptações necessárias para exibição em tela cheia.

## Integração com Template Builder

O Template Builder permite criar templates HTML visualmente, que podem ser exportados e carregados diretamente no Web CMS. O sistema exibe previews em tempo real desses templates em todas as áreas.

## Estrutura do Projeto

```
web-cms/
├── src/
│   ├── controllers/     # Controladores da aplicação
│   ├── models/          # Modelos de dados (Mongoose)
│   ├── routes/          # Rotas da API
│   ├── middleware/      # Middlewares
│   ├── config/          # Configurações
│   ├── public/          # Arquivos estáticos
│   │   └── uploads/     # Uploads de mídia
│   ├── views/           # Templates
│   ├── app.js           # Configuração do Express
│   └── server.js        # Ponto de entrada
├── .env                 # Variáveis de ambiente
├── package.json
└── README.md
```

## Licença

ISC
