# Guia de Integração do Player Gustavo com o CMS Web

Este documento descreve as adaptações necessárias para integrar o Player Gustavo com o novo sistema de gerenciamento de conteúdo (CMS) web.

## Visão Geral das Mudanças

O Player Gustavo precisa ser adaptado para:

1. Autenticar-se no CMS web
2. Verificar sua autorização
3. Baixar playlists do CMS
4. Reproduzir as mídias conforme configurado

## Endpoints da API para Integração

### Autorização do Player

- **Verificar Autorização**
  - Endpoint: `GET /api/players/check/:uniqueId`
  - Descrição: Verifica se o player está autorizado e retorna informações sobre a playlist associada
  - Parâmetros:
    - `uniqueId`: ID único do player
  - Resposta:
    ```json
    {
      "success": true,
      "data": {
        "authorized": true,
        "playerId": "player_id",
        "playlist": "playlist_id"
      }
    }
    ```

### Download de Playlist

- **Obter Playlist**
  - Endpoint: `GET /api/playlists/:id/export`
  - Descrição: Obtém a playlist formatada para o player
  - Autenticação: Necessária (token JWT)
  - Resposta:
    ```json
    {
      "success": true,
      "data": {
        "id": "playlist_id",
        "name": "Nome da Playlist",
        "description": "Descrição da playlist",
        "items": [
          {
            "id": "item_id",
            "mediaId": "media_id",
            "name": "Nome da Mídia",
            "type": "image|video",
            "duration": 10,
            "order": 0,
            "filePath": "/api/media/file/media_id",
            "mimeType": "image/jpeg"
          }
        ]
      }
    }
    ```

### Download de Mídia

- **Obter Arquivo de Mídia**
  - Endpoint: `GET /api/media/:id/file`
  - Descrição: Obtém o arquivo de mídia
  - Autenticação: Necessária (token JWT)
  - Resposta: Arquivo binário da mídia

## Adaptações Necessárias no Player

### 1. Configuração

Adicionar ao arquivo `config.json` do player:

```json
{
  "cmsUrl": "http://177.71.165.181",
  "uniqueId": "player-id-único",
  "authToken": null
}
```

### 2. Autenticação

Adicionar ao `main.js` do player:

```javascript
async function authenticateWithCMS() {
  try {
    const config = loadConfig();

    // Verifica se o player está autorizado
    const response = await fetch(
      `${config.cmsUrl}/api/players/check/${config.uniqueId}`
    );
    const data = await response.json();

    if (data.success && data.data.authorized) {
      writeDebugLog("Player autorizado no CMS");

      // Se tiver uma playlist associada, baixa ela
      if (data.data.playlist) {
        await downloadPlaylist(data.data.playlist);
      } else {
        writeDebugLog("Nenhuma playlist associada a este player");
      }
    } else {
      writeDebugLog("Player não autorizado no CMS");
    }
  } catch (error) {
    writeDebugLog(`Erro na autenticação com o CMS: ${error}`);
  }
}
```

### 3. Download de Playlist

Adicionar ao `main.js` do player:

```javascript
async function downloadPlaylist(playlistId) {
  try {
    const config = loadConfig();

    // Obtém a playlist do CMS
    const response = await fetch(
      `${config.cmsUrl}/api/playlists/${playlistId}/export`
    );
    const data = await response.json();

    if (data.success) {
      writeDebugLog(`Playlist obtida com sucesso: ${data.data.name}`);

      // Salva a playlist localmente
      fs.writeFileSync(
        path.join(__dirname, "playlist.json"),
        JSON.stringify(data.data.items, null, 2)
      );

      // Baixa as mídias
      await downloadMediaFiles(data.data.items);
    } else {
      writeDebugLog("Erro ao obter playlist do CMS");
    }
  } catch (error) {
    writeDebugLog(`Erro ao baixar playlist: ${error}`);
  }
}

async function downloadMediaFiles(items) {
  try {
    const config = loadConfig();
    const assetsDir = path.join(__dirname, "assets");

    // Cria o diretório de assets se não existir
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Baixa cada mídia
    for (const item of items) {
      const mediaUrl = `${config.cmsUrl}${item.filePath}`;
      const filePath = path.join(
        assetsDir,
        `${item.mediaId}${path.extname(item.name)}`
      );

      writeDebugLog(`Baixando mídia: ${item.name}`);

      // Baixa o arquivo
      const mediaResponse = await fetch(mediaUrl);
      const buffer = await mediaResponse.buffer();

      // Salva o arquivo localmente
      fs.writeFileSync(filePath, buffer);

      // Atualiza o caminho do arquivo na playlist
      item.filePath = filePath;
    }

    writeDebugLog("Todas as mídias foram baixadas com sucesso");
  } catch (error) {
    writeDebugLog(`Erro ao baixar mídias: ${error}`);
  }
}
```

### 4. Verificação Periódica

Adicionar ao `main.js` do player:

```javascript
// Verifica atualizações a cada 10 minutos
setInterval(async () => {
  await authenticateWithCMS();
}, 10 * 60 * 1000);

// Inicia a autenticação quando o player é iniciado
app.on("ready", async () => {
  await authenticateWithCMS();
  createWindow();
});
```

## Considerações Finais

- O player deve armazenar localmente as mídias e a playlist para funcionar offline
- A verificação periódica permite atualizar o conteúdo quando houver conexão
- O ID único do player deve ser configurado manualmente ou gerado na primeira execução
- É recomendável implementar um mecanismo de retry para lidar com falhas de conexão
