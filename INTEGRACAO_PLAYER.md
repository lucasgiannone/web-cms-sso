# Integração do Gustavo Player com o Sistema Web CMS

## Visão Geral

Este documento descreve as modificações necessárias para integrar o Gustavo Player diretamente com o sistema Web CMS, removendo qualquer dependência do Xibo. O player será adaptado para solicitar autorização ao sistema Web CMS e reproduzir playlists e mídias diretamente do nosso sistema.

## Modificações Necessárias

### 1. Autenticação e Autorização

#### No Sistema Web CMS:

1. **Criar API de Registro de Player:**

   - Endpoint: `POST /api/players/register`
   - Função: Registrar um novo player no sistema
   - Parâmetros: `name`, `description`, `hardware_id`
   - Retorno: `player_id` e `auth_token`

2. **Criar API de Autenticação de Player:**

   - Endpoint: `POST /api/players/auth`
   - Função: Autenticar um player existente
   - Parâmetros: `player_id`, `hardware_id`
   - Retorno: `auth_token`

3. **Criar API para Atribuição de Playlist:**

   - Endpoint: `GET /api/players/:id/playlist`
   - Função: Obter a playlist atribuída ao player
   - Parâmetros: `id` (player_id)
   - Retorno: Objeto playlist com itens e mídias

4. **Criar API para Status do Player:**
   - Endpoint: `POST /api/players/:id/status`
   - Função: Receber atualizações de status do player
   - Parâmetros: `id` (player_id), `status`, `current_media`, `logs`

#### No Gustavo Player:

1. **Remover Dependências do Xibo:**

   - Eliminar todas as referências ao Xibo no código
   - Remover funções de integração com o Xibo

2. **Implementar Tela de Configuração:**

   - Adicionar campos para URL do servidor
   - Adicionar opção para registro de novo player
   - Adicionar opção para autenticação de player existente

3. **Implementar Autenticação:**
   - Armazenar `player_id` e `auth_token` no arquivo de configuração
   - Implementar lógica para renovação automática do token

### 2. Sincronização de Playlists

#### No Sistema Web CMS:

1. **Adaptar Modelo de Playlist:**

   - Garantir que o formato de playlist seja compatível com o player
   - Incluir URLs completas para as mídias

2. **Implementar Cache de Mídias:**
   - Adicionar cabeçalhos de cache apropriados para as mídias
   - Implementar sistema de versão para detectar alterações

#### No Gustavo Player:

1. **Implementar Download de Playlist:**

   - Substituir a leitura do XML do Xibo pela API do Web CMS
   - Implementar verificação periódica de atualizações

2. **Implementar Cache Local:**
   - Armazenar mídias localmente para reprodução offline
   - Implementar sistema de verificação de integridade

### 3. Reprodução de Mídias

#### No Gustavo Player:

1. **Adaptar Sistema de Reprodução:**

   - Modificar o sistema para usar o formato de playlist do Web CMS
   - Implementar suporte para todos os tipos de mídia (imagens, vídeos, HTML)

2. **Implementar Relatórios de Reprodução:**
   - Enviar logs de reprodução para o servidor
   - Reportar erros e problemas de reprodução

### 4. Interface de Usuário

#### No Sistema Web CMS:

1. **Criar Interface de Gerenciamento de Players:**
   - Listar todos os players registrados
   - Permitir atribuição de playlists aos players
   - Mostrar status e logs dos players

#### No Gustavo Player:

1. **Adaptar Interface de Configuração:**
   - Simplificar a interface para focar na integração com o Web CMS
   - Adicionar opções de diagnóstico e solução de problemas

## Integração com Fontes RSS

O CMS agora suporta a sincronização de fontes RSS para o player, permitindo que os conteúdos RSS possam ser acessados mesmo quando o player estiver offline ou em situações de conexão limitada.

### Configuração da Sincronização RSS

Para implementar a sincronização de RSS no player, siga os passos abaixo:

#### 1. Inicializar o Sistema de Sincronização

O sistema de sincronização RSS disponibiliza os seguintes recursos:

- API para obter metadados de todas as fontes RSS
- API para baixar uma fonte RSS específica
- API para baixar o pacote completo de fontes RSS
- API para verificar atualizações desde a última sincronização

#### 2. Endpoints da API de Sincronização

| Endpoint                    | Método | Descrição                                                            | Parâmetros                                                      |
| --------------------------- | ------ | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/api/rss/metadata`         | GET    | Obtém metadados de todas as fontes RSS ativas                        | Nenhum                                                          |
| `/api/rss/download/:source` | GET    | Baixa uma fonte RSS específica compactada em ZIP                     | `:source` - Nome da pasta da fonte                              |
| `/api/rss/download-full`    | GET    | Baixa todo o pacote combo_rss compactado em ZIP                      | Nenhum                                                          |
| `/api/rss/check-updates`    | GET    | Verifica quais fontes foram atualizadas desde a última sincronização | `lastSyncTimestamp` (query) - Timestamp da última sincronização |

#### 3. Implementação no Player

O CMS fornece um cliente JavaScript pronto para uso no arquivo `/public/js/rss-sync-client.js`. Este cliente implementa:

- Verificação periódica de atualizações
- Download e extração de fontes RSS
- Gestão de armazenamento local
- Cache de metadados

Para integrar o cliente no player, você precisa:

1. Incluir o script no seu player:

   ```html
   <script src="http://seu-servidor/public/js/rss-sync-client.js"></script>
   ```

2. Implementar wrappers para o sistema de arquivos e manipulação de ZIP:

   ```javascript
   // Exemplos de wrappers (adapte para seu ambiente)
   const FileSystem = {
     exists: async (path) => {
       /* implementação específica */
     },
     mkdir: async (path, options) => {
       /* implementação específica */
     },
     writeFile: async (path, data) => {
       /* implementação específica */
     },
     unlink: async (path) => {
       /* implementação específica */
     },
     readFile: async (path) => {
       /* implementação específica */
     },
   };

   const ZipHandler = {
     extract: async (zipPath, destPath) => {
       /* implementação específica */
     },
   };
   ```

3. Inicializar o cliente RSS:

   ```javascript
   const rssSync = new RSSSync({
     serverUrl: "http://seu-servidor-cms",
     localStoragePath: "./data/rss",
     fileSystem: FileSystem,
     zipHandler: ZipHandler,
     onUpdate: (result) => {
       console.log("Atualizações RSS recebidas:", result);
       // Atualizar interface ou recarregar fontes
     },
   });

   // Verificar atualizações manualmente
   rssSync.checkForUpdates();

   // Baixar o pacote completo (primeira execução)
   rssSync.downloadFullPackage();
   ```

4. Reproduzir uma fonte RSS:

   ```javascript
   // Verificar se a fonte está disponível localmente
   const isAvailable = await rssSync.isSourceAvailableLocally("conectaVerde");

   if (!isAvailable) {
     await rssSync.downloadSource("conectaVerde");
   }

   // Obter o caminho local para a fonte
   const localPath = rssSync.getLocalRSSPath("conectaVerde");

   // Carregar a fonte no player (ex: iframe ou webview)
   document.getElementById("rss-frame").src = `file://${localPath}`;
   ```

#### 4. Fluxo de Sincronização Recomendado

1. Na inicialização do player, verificar se é a primeira execução
2. Se for a primeira execução, baixar o pacote completo de RSS
3. Se não for a primeira execução, verificar se há atualizações
4. Configurar verificação periódica de atualizações (a cada 30-60 minutos)
5. Ao receber atualizações, baixar apenas as fontes modificadas
6. Ao reproduzir uma fonte RSS, verificar se está disponível localmente
7. Se não estiver disponível, baixá-la antes de reproduzir

#### 5. Considerações de Segurança e Desempenho

- Recomendamos que o player mantenha um limite de armazenamento para arquivos RSS
- Implemente uma lógica para excluir fontes não utilizadas após um período
- Configure a frequência de verificação considerando o consumo de dados e bateria
- Utilize conexões seguras (HTTPS) para todas as comunicações com o servidor

#### 6. Exemplo de Integração Completa

Um exemplo completo de integração está disponível no arquivo `/public/js/player-rss-handler.js`. Este exemplo demonstra:

- Inicialização do sistema de sincronização
- Verificação de atualizações
- Download e gestão de fontes RSS
- Reprodução de conteúdo RSS no player

Consulte este arquivo para ver uma implementação de referência que pode ser adaptada para seu player específico.

## Estrutura de Dados

### Configuração do Player (config.json)

```json
{
  "serverUrl": "http://177.71.165.181",
  "playerId": "player_id",
  "authToken": "jwt_token",
  "hardwareId": "unique_hardware_id",
  "refreshInterval": 60000,
  "cacheDir": "./cache"
}
```

### Formato de Playlist

```json
{
  "id": "playlist_id",
  "name": "Nome da Playlist",
  "items": [
    {
      "id": "item_id",
      "type": "image",
      "url": "http://177.71.165.181/media/image.jpg",
      "duration": 10000,
      "order": 1
    },
    {
      "id": "item_id",
      "type": "video",
      "url": "http://177.71.165.181/media/video.mp4",
      "duration": 0,
      "order": 2
    },
    {
      "id": "item_id",
      "type": "webpage",
      "url": "http://177.71.165.181/media/page.html",
      "duration": 15000,
      "order": 3
    }
  ]
}
```

### Status do Player

```json
{
  "playerId": "player_id",
  "status": "playing",
  "currentMedia": "item_id",
  "lastSync": "2023-03-04T12:00:00Z",
  "version": "1.0.0",
  "logs": [
    {
      "timestamp": "2023-03-04T12:00:00Z",
      "level": "info",
      "message": "Reproduzindo mídia: image.jpg"
    }
  ]
}
```

## Fluxo de Operação

1. **Inicialização:**

   - O player carrega as configurações do arquivo `config.json`
   - Se não houver `playerId` ou `authToken`, exibe a tela de configuração
   - Se houver, tenta autenticar com o servidor usando o token existente

2. **Registro/Autenticação:**

   - Novo player: Envia solicitação de registro e recebe `playerId` e `authToken`
   - Player existente: Envia solicitação de autenticação e recebe novo `authToken`
   - Armazena as credenciais no arquivo de configuração

3. **Obtenção de Playlist:**

   - Solicita a playlist atribuída ao player
   - Se não houver playlist atribuída, exibe mensagem de erro
   - Se houver, baixa a playlist e as mídias necessárias

4. **Reprodução:**
   - Inicia a reprodução da playlist
   - Envia atualizações de status periodicamente
   - Verifica por atualizações na playlist conforme configurado

## Implementação

A implementação será dividida em fases:

1. **Fase 1: Remoção das Dependências do Xibo**

   - Eliminar todas as referências ao Xibo no código
   - Adaptar o sistema para funcionar sem o Xibo

2. **Fase 2: Implementação da Autenticação**

   - Desenvolver as APIs de autenticação no Web CMS
   - Implementar o sistema de autenticação no player

3. **Fase 3: Implementação da Sincronização de Playlists**

   - Desenvolver as APIs de playlist no Web CMS
   - Implementar o sistema de download e cache no player

4. **Fase 4: Adaptação da Interface**
   - Desenvolver a interface de gerenciamento de players no Web CMS
   - Adaptar a interface de configuração do player

## Considerações de Segurança

- Utilizar HTTPS para todas as comunicações
- Implementar autenticação baseada em JWT com expiração
- Validar todas as entradas de usuário
- Implementar mecanismos de proteção contra ataques de força bruta

## Próximos Passos

1. Desenvolver as APIs necessárias no sistema Web CMS
2. Adaptar o código do Gustavo Player para se integrar com as novas APIs
3. Testar a integração em ambiente controlado
4. Implementar melhorias baseadas nos resultados dos testes
5. Preparar documentação para usuários finais
