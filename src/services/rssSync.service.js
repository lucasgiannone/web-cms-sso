/**
 * Serviço para gerenciar a sincronização de fontes RSS para os players
 */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { promisify } = require("util");
const RSS = require("../models/rss.model");

// Converter funções fs para Promises
const fsExists = promisify(fs.exists);
const fsReaddir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const fsMkdir = promisify(fs.mkdir);
const fsWriteFile = promisify(fs.writeFile);

// Caminho para a pasta combo_rss
const COMBO_RSS_PATH = path.join(__dirname, "../../combo_rss");
const TEMP_DIR = path.join(__dirname, "../../temp");
const METADATA_PATH = path.join(COMBO_RSS_PATH, "metadata.json");

/**
 * Obter metadados atualizados de todas as fontes RSS
 */
const getRSSMetadata = async () => {
  try {
    // Buscar todas as fontes RSS ativas do banco de dados
    const rssSources = await RSS.find({ active: true })
      .select("name source url updatedAt")
      .lean();

    return rssSources.map((source) => ({
      id: source._id.toString(),
      name: source.name,
      source: source.source,
      url: source.url,
      version: source.updatedAt ? source.updatedAt.getTime() : 0,
    }));
  } catch (error) {
    console.error("Erro ao obter metadados RSS:", error);
    throw error;
  }
};

/**
 * Gerar e salvar arquivo de metadados das fontes RSS
 * Este arquivo será usado pelos players para verificar quais fontes estão disponíveis
 * e quais foram atualizadas
 */
const generateAndSaveMetadata = async () => {
  try {
    // Obter metadados atualizados
    const metadata = await getRSSMetadata();

    // Adicionar timestamp da geração
    const metadataObject = {
      sources: metadata,
      generatedAt: Date.now(),
      totalSources: metadata.length,
    };

    // Verificar se o diretório combo_rss existe
    if (!fs.existsSync(COMBO_RSS_PATH)) {
      await fsMkdir(COMBO_RSS_PATH, { recursive: true });
    }

    // Salvar metadados em arquivo JSON
    await fsWriteFile(METADATA_PATH, JSON.stringify(metadataObject, null, 2));

    console.log(`Metadados RSS gerados e salvos em ${METADATA_PATH}`);
    return metadataObject;
  } catch (error) {
    console.error("Erro ao gerar e salvar metadados RSS:", error);
    throw error;
  }
};

/**
 * Criar um arquivo ZIP contendo a pasta de uma fonte RSS específica
 * @param {string} source - O nome da pasta fonte (ex: "conectaVerde")
 * @returns {Promise<string>} - Caminho para o arquivo ZIP criado
 */
const createRSSSourceZip = async (source) => {
  try {
    // Verificar se a pasta da fonte existe
    const sourcePath = path.join(COMBO_RSS_PATH, source);
    const exists = await fsExists(sourcePath);

    if (!exists) {
      throw new Error(`Pasta da fonte RSS "${source}" não encontrada`);
    }

    // Criar diretório temporário se não existir
    if (!fs.existsSync(TEMP_DIR)) {
      await fsMkdir(TEMP_DIR, { recursive: true });
    }

    // Caminho para o arquivo ZIP de saída
    const outputPath = path.join(TEMP_DIR, `${source}.zip`);

    // Criar um fluxo de escrita para o arquivo ZIP
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Nível máximo de compressão
    });

    // Pipe do arquivo zip para o fluxo de escrita
    archive.pipe(output);

    // Adicionar a pasta da fonte ao arquivo ZIP
    archive.directory(sourcePath, source);

    // Finalizar o arquivo
    await archive.finalize();

    return outputPath;
  } catch (error) {
    console.error(`Erro ao criar ZIP para fonte RSS ${source}:`, error);
    throw error;
  }
};

/**
 * Criar um arquivo ZIP contendo toda a estrutura combo_rss
 * @returns {Promise<string>} - Caminho para o arquivo ZIP criado
 */
const createFullRSSZip = async () => {
  try {
    // Gerar metadados atualizados antes de criar o ZIP
    await generateAndSaveMetadata();

    // Criar diretório temporário se não existir
    if (!fs.existsSync(TEMP_DIR)) {
      await fsMkdir(TEMP_DIR, { recursive: true });
    }

    // Caminho para o arquivo ZIP de saída
    const outputPath = path.join(TEMP_DIR, "combo_rss_full.zip");

    // Criar um fluxo de escrita para o arquivo ZIP
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Nível máximo de compressão
    });

    // Pipe do arquivo zip para o fluxo de escrita
    archive.pipe(output);

    // Adicionar a pasta combo_rss ao arquivo ZIP, excluindo pasta .git
    archive.glob(
      "**/*",
      {
        cwd: COMBO_RSS_PATH,
        ignore: [".git/**", ".vscode/**", "*.log", "example.log"],
      },
      { prefix: "combo_rss" }
    );

    // Finalizar o arquivo
    await archive.finalize();

    return outputPath;
  } catch (error) {
    console.error("Erro ao criar ZIP completo de RSS:", error);
    throw error;
  }
};

/**
 * Verificar se uma fonte RSS foi atualizada desde a última sincronização
 * @param {string} source - Nome da fonte RSS
 * @param {number} lastSyncTimestamp - Timestamp da última sincronização
 * @returns {Promise<boolean>} - True se a fonte foi atualizada
 */
const isSourceUpdated = async (source, lastSyncTimestamp) => {
  try {
    // Buscar a fonte RSS do banco de dados
    const rssSource = await RSS.findOne({ source, active: true }).lean();

    if (!rssSource) {
      return false;
    }

    // Verificar se a data de atualização é posterior à última sincronização
    const updateTimestamp = rssSource.updatedAt.getTime();
    return updateTimestamp > lastSyncTimestamp;
  } catch (error) {
    console.error(
      `Erro ao verificar atualizações da fonte RSS ${source}:`,
      error
    );
    return false;
  }
};

/**
 * Limpar arquivos temporários antigos
 */
const cleanupTempFiles = async () => {
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      return;
    }

    const files = await fsReaddir(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fsStat(filePath);

      // Remover arquivos com mais de 1 hora
      if (now - stats.mtimeMs > 60 * 60 * 1000) {
        fs.unlink(filePath, (err) => {
          if (err)
            console.error(`Erro ao remover arquivo temporário ${file}:`, err);
        });
      }
    }
  } catch (error) {
    console.error("Erro ao limpar arquivos temporários:", error);
  }
};

// Exportar funções do serviço
module.exports = {
  getRSSMetadata,
  generateAndSaveMetadata,
  createRSSSourceZip,
  createFullRSSZip,
  isSourceUpdated,
  cleanupTempFiles,
};
