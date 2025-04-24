# Documentação do Sistema Web CMS

## Visão Geral

O sistema Web CMS é uma plataforma de gerenciamento de conteúdo digital desenvolvida para controlar e distribuir mídias para players remotos. O sistema permite o gerenciamento de usuários, grupos, mídias, playlists e players através de uma interface web intuitiva.

## Arquitetura

O sistema foi desenvolvido utilizando as seguintes tecnologias:

- **Backend**: Node.js com Express.js
- **Frontend**: EJS (Embedded JavaScript) para renderização de templates
- **Banco de Dados**: MongoDB com Mongoose
- **Autenticação**: JWT (JSON Web Tokens)

A arquitetura segue o padrão MVC (Model-View-Controller), com separação clara entre as camadas de dados, lógica de negócios e apresentação.

## Estrutura de Diretórios

```
web-cms/
├── node_modules/
├── src/
│   ├── controllers/     # Controladores para cada entidade
│   ├── middleware/      # Middlewares de autenticação e autorização
│   ├── models/          # Modelos de dados (Mongoose)
│   ├── routes/          # Rotas da API e web
│   ├── views/           # Templates EJS
│   ├── app.js           # Configuração da aplicação
│   └── server.js        # Ponto de entrada da aplicação
├── .env                 # Variáveis de ambiente
├── package.json         # Dependências do projeto
└── README.md            # Documentação geral
```

## Funcionalidades Implementadas

### Sistema de Autenticação

- Login e logout de usuários
- Autenticação baseada em tokens JWT
- Middleware para proteção de rotas
- Verificação de permissões baseada em papéis (admin, usuário comum)

### Gerenciamento de Usuários

- Criação, visualização, edição e exclusão de usuários
- Atribuição de usuários a grupos
- Definição de papéis e permissões

### Gerenciamento de Grupos

- Criação, visualização, edição e exclusão de grupos
- Definição de permissões para grupos
- Estatísticas de uso por grupo (usuários, mídias, playlists, players)

### Gerenciamento de Mídias

- Upload, visualização, edição e exclusão de mídias
- Organização de mídias por grupo
- Suporte a diferentes tipos de mídia:
  - Imagens (JPG, PNG, GIF)
  - Vídeos (MP4, WEBM)
  - Templates HTML interativos
- Preview integrado para todos os tipos de mídia:
  - Miniaturas responsivas na biblioteca de mídias
  - Visualização em tela cheia para avaliação de conteúdo
  - Preview embutido para HTML com renderização em tempo real

### Gerenciamento de Playlists

- Criação, visualização, edição e exclusão de playlists
- Adição de mídias às playlists com visualização prévia
- Organização de playlists por grupo
- Suporte a todos os tipos de mídia em uma playlist
- Visualização de miniaturas de cada item da playlist, incluindo templates HTML

### Gerenciamento de Players

- Registro, visualização, edição e exclusão de players
- Atribuição de playlists a players
- Monitoramento de status dos players

### Dashboard

- Visão geral do sistema
- Estatísticas de uso
- Itens recentes com previews para todos os tipos de mídia
- Visualização em tempo real de templates HTML

## Suporte a Templates HTML

- Upload e gerenciamento de templates HTML interativos
- Previsualização em tempo real em todas as áreas do sistema:
  - Biblioteca de mídias
  - Página de visualização individual
  - Página de edição de mídia
  - Visualização de playlist
  - Dashboard
- Visualização em tela cheia para análise detalhada
- Renderização segura com sandbox para scripts
- Integração total com o player Gustavo para exibição

## Fluxo de Dados

1. **Autenticação**:

   - O usuário acessa a página de login
   - Após autenticação bem-sucedida, um token JWT é gerado e armazenado na sessão
   - O token é utilizado para autenticar requisições à API

2. **Gerenciamento de Recursos**:
   - As páginas web utilizam rotas específicas para cada operação CRUD
   - Os formulários enviam dados para rotas web que processam os dados
   - As rotas web fazem requisições à API utilizando o token de autenticação
   - A API processa as requisições e retorna os resultados

## Segurança

- Autenticação via JWT
- Middleware de autorização para verificar permissões
- Validação de dados de entrada
- Proteção contra CSRF
- Mensagens flash para feedback ao usuário
- Sandbox seguro para templates HTML

## Melhorias Recentes

### Suporte a Templates HTML

- Implementação de upload e gerenciamento de arquivos HTML
- Desenvolvimento de sistema de preview em tempo real para templates
- Integração com Template Builder para criação de conteúdo
- Renderização segura com sandbox para isolamento de scripts

### Melhorias na Interface do Usuário

- Adição de previews para todos os tipos de mídia
- Visualização em tela cheia para avaliação detalhada de conteúdo
- Interface responsiva e moderna

### Correção do Problema de Autenticação na API

- Implementação de middleware para verificar o token tanto no header quanto na sessão
- Modificação do middleware de autenticação para buscar o token da sessão quando não presente no header

### Melhoria no Gerenciamento de Grupos

- Atualização do modelo de grupo para incluir permissões detalhadas
- Implementação de rotas web para processamento de formulários de grupos
- Utilização do Axios para fazer requisições à API a partir das rotas web

### Implementação de Feedback ao Usuário

- Utilização de mensagens flash para informar o resultado das operações
- Redirecionamento adequado após operações de criação, edição e exclusão

## Integração com Players

O sistema possui integração com players remotos através de uma API dedicada. Os players podem:

- Registrar-se no sistema
- Obter playlists atribuídas
- Reportar status e logs
- Baixar mídias para exibição
- Exibir templates HTML com suporte completo a interatividade

## Próximos Passos

- Implementação de relatórios de uso
- Melhorias adicionais na interface do usuário
- Implementação de funcionalidades avançadas de agendamento
- Otimização de performance para grandes volumes de dados
- Implementação de testes automatizados
- Suporte avançado a templates interativos

## Considerações Finais

O sistema Web CMS oferece uma solução completa para gerenciamento de conteúdo digital e distribuição para players remotos. A arquitetura modular e a separação clara entre frontend e backend facilitam a manutenção e a evolução do sistema.
