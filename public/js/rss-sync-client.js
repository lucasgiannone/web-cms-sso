/**
 * Cliente de sincronização de RSS para o Player
 * Este script permite que o player baixe e sincronize conteúdo RSS
 * mesmo quando estiver offline ou com conexão limitada.
 */

class RSSSync {
  /**
   * Inicializa o cliente de sincronização
   * @param {Object} options - Opções de configuração
   * @param {string} options.serverUrl - URL do servidor CMS
   * @param {string} options.localStoragePath - Caminho local para armazenar os arquivos
   * @param {Object} options.fileSystem - Interface para operações de sistema de arquivos
   * @param {Object} options.zipHandler - Interface para manipulação de arquivos ZIP
   * @param {Function} options.onUpdate - Callback chamado quando houver atualizações
   */
  constructor(options) {
    this.serverUrl = options.serverUrl.replace(/\/$/, "");
    this.localStoragePath = options.localStoragePath;
    this.fs = options.fileSystem;
    this.zipHandler = options.zipHandler;
    this.onUpdate = options.onUpdate || (() => {});

    this.metadataPath = `${this.localStoragePath}/metadata.json`;
    this.lastSyncTimestamp = 0;
    this.sources = [];

    // Carregar metadados se existirem
    this.loadMetadata();
  }

  /**
   * Carrega metadados salvos localmente
   */
  async loadMetadata() {
    try {
      // Verificar se o diretório existe
      if (!(await this.fs.exists(this.localStoragePath))) {
        await this.fs.mkdir(this.localStoragePath, { recursive: true });
      }

      // Verificar se o arquivo de metadados existe
      if (await this.fs.exists(this.metadataPath)) {
        const metadataContent = await this.fs.readFile(
          this.metadataPath,
          "utf8"
        );
        const metadata = JSON.parse(metadataContent);

        this.sources = metadata.sources || [];
        this.lastSyncTimestamp = metadata.generatedAt || 0;

        console.log(
          `Metadados RSS carregados: ${this.sources.length} fontes encontradas`
        );
      } else {
        console.log(
          "Arquivo de metadados não encontrado. Será criado na próxima sincronização."
        );
      }
    } catch (error) {
      console.error("Erro ao carregar metadados:", error);
    }
  }

  /**
   * Salva metadados localmente
   * @param {Object} metadata - Metadados a serem salvos
   */
  async saveMetadata(metadata) {
    try {
      await this.fs.writeFile(
        this.metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf8"
      );

      this.sources = metadata.sources || [];
      this.lastSyncTimestamp = metadata.generatedAt || Date.now();

      console.log("Metadados RSS salvos com sucesso");
    } catch (error) {
      console.error("Erro ao salvar metadados:", error);
    }
  }

  /**
   * Verifica se há atualizações disponíveis no servidor
   * @returns {Promise<Array>} - Array de fontes atualizadas
   */
  async checkForUpdates() {
    try {
      console.log("Verificando atualizações RSS...");

      const response = await fetch(
        `${this.serverUrl}/api/rss/check-updates?lastSyncTimestamp=${this.lastSyncTimestamp}`
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const result = {
          updatedSources: data.data.updatedSources,
          currentTimestamp: data.data.currentTimestamp,
        };

        // Atualizar o timestamp da última sincronização
        this.lastSyncTimestamp = data.data.currentTimestamp;

        // Notificar sobre as atualizações
        if (result.updatedSources.length > 0) {
          console.log(
            `${result.updatedSources.length} fontes RSS atualizadas disponíveis`
          );
          this.onUpdate(result);
        } else {
          console.log("Nenhuma atualização disponível");
        }

        return result;
      } else {
        throw new Error(data.message || "Erro ao verificar atualizações");
      }
    } catch (error) {
      console.error("Erro ao verificar atualizações RSS:", error);
      return { updatedSources: [], currentTimestamp: this.lastSyncTimestamp };
    }
  }

  /**
   * Baixa e extrai uma fonte RSS específica
   * @param {string} source - O nome da fonte RSS (ex: "conectaVerde")
   * @returns {Promise<boolean>} - Sucesso da operação
   */
  async downloadSource(source) {
    try {
      console.log(`Baixando fonte RSS: ${source}`);

      // Caminho temporário para o arquivo ZIP
      const tempZipPath = `${this.localStoragePath}/${source}.zip`;

      // Baixar o arquivo ZIP
      const response = await fetch(
        `${this.serverUrl}/api/rss/download/${source}`
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      // Converter resposta para ArrayBuffer e salvar como arquivo
      const buffer = await response.arrayBuffer();
      await this.fs.writeFile(tempZipPath, new Uint8Array(buffer));

      // Extrair o arquivo ZIP
      await this.zipHandler.extract(tempZipPath, this.localStoragePath);

      // Remover o arquivo ZIP após a extração
      await this.fs.unlink(tempZipPath);

      console.log(`Fonte RSS baixada e extraída: ${source}`);
      return true;
    } catch (error) {
      console.error(`Erro ao baixar fonte RSS ${source}:`, error);
      return false;
    }
  }

  /**
   * Baixa e extrai o pacote completo de RSS
   * @returns {Promise<boolean>} - Sucesso da operação
   */
  async downloadFullPackage() {
    try {
      console.log("Baixando pacote completo de RSS...");

      // Caminho temporário para o arquivo ZIP
      const tempZipPath = `${this.localStoragePath}/combo_rss_full.zip`;

      // Baixar o arquivo ZIP
      const response = await fetch(`${this.serverUrl}/api/rss/download-full`);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      // Converter resposta para ArrayBuffer e salvar como arquivo
      const buffer = await response.arrayBuffer();
      await this.fs.writeFile(tempZipPath, new Uint8Array(buffer));

      // Extrair o arquivo ZIP
      await this.zipHandler.extract(tempZipPath, this.localStoragePath);

      // Remover o arquivo ZIP após a extração
      await this.fs.unlink(tempZipPath);

      // Carregar metadados atualizados
      await this.loadMetadata();

      console.log("Pacote completo de RSS baixado e extraído com sucesso");
      return true;
    } catch (error) {
      console.error("Erro ao baixar pacote completo de RSS:", error);
      return false;
    }
  }

  /**
   * Verifica se uma fonte está disponível localmente
   * @param {string} source - O nome da fonte RSS
   * @returns {Promise<boolean>} - Se a fonte está disponível
   */
  async isSourceAvailableLocally(source) {
    try {
      const sourcePath = `${this.localStoragePath}/${source}`;
      return await this.fs.exists(sourcePath);
    } catch (error) {
      console.error(
        `Erro ao verificar disponibilidade da fonte ${source}:`,
        error
      );
      return false;
    }
  }

  /**
   * Obtém o caminho local para uma fonte RSS
   * @param {string} source - O nome da fonte RSS
   * @returns {string} - Caminho local para a fonte
   */
  getLocalRSSPath(source) {
    return `${this.localStoragePath}/${source}`;
  }

  /**
   * Atualiza fontes RSS modificadas
   * @returns {Promise<Array>} - Fontes atualizadas
   */
  async updateModifiedSources() {
    try {
      // Verificar atualizações
      const updates = await this.checkForUpdates();

      if (updates.updatedSources.length === 0) {
        return [];
      }

      // Baixar cada fonte atualizada
      const updatedSources = [];

      for (const source of updates.updatedSources) {
        const success = await this.downloadSource(source.source);

        if (success) {
          updatedSources.push(source);
        }
      }

      return updatedSources;
    } catch (error) {
      console.error("Erro ao atualizar fontes modificadas:", error);
      return [];
    }
  }

  /**
   * Limpa fontes RSS não utilizadas para economizar espaço
   * @param {Array<string>} activeSources - Lista de fontes ativas a manter
   * @returns {Promise<number>} - Número de fontes removidas
   */
  async cleanupUnusedSources(activeSources) {
    try {
      if (!Array.isArray(activeSources) || activeSources.length === 0) {
        return 0;
      }

      // Listar as pastas de fonte no armazenamento local
      const localDirs = await this.fs.readdir(this.localStoragePath);

      let removed = 0;

      // Identificar e remover fontes que não estão na lista de ativas
      for (const dir of localDirs) {
        // Pular arquivos e diretórios especiais
        if (
          dir === "metadata.json" ||
          dir.endsWith(".zip") ||
          dir === "." ||
          dir === ".."
        ) {
          continue;
        }

        // Verificar se a fonte está na lista de ativas
        if (!activeSources.includes(dir)) {
          const sourcePath = `${this.localStoragePath}/${dir}`;

          // Verificar se é um diretório
          const stats = await this.fs.stat(sourcePath);

          if (stats.isDirectory()) {
            // Remover o diretório
            await this.fs.rmdir(sourcePath, { recursive: true });
            removed++;
            console.log(`Fonte RSS removida: ${dir}`);
          }
        }
      }

      console.log(`${removed} fontes RSS não utilizadas foram removidas`);
      return removed;
    } catch (error) {
      console.error("Erro ao limpar fontes não utilizadas:", error);
      return 0;
    }
  }
}

// Exportar a classe para uso em diferentes ambientes
if (typeof module !== "undefined" && module.exports) {
  module.exports = RSSSync;
} else if (typeof window !== "undefined") {
  window.RSSSync = RSSSync;
}
