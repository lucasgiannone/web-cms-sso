/**
 * Controlador para API de sincronização de fontes RSS
 */

const fs = require("fs");
const path = require("path");
const RSS = require("../models/rss.model");
const rssSyncService = require("../services/rssSync.service");

/**
 * Obter metadados de todas as fontes RSS
 */
exports.getRSSMetadata = async (req, res) => {
  try {
    const metadata = await rssSyncService.getRSSMetadata();
    res.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    console.error("Erro ao obter metadados RSS:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao obter metadados RSS",
      error: error.message,
    });
  }
};

/**
 * Gerar e salvar metadados em arquivo JSON
 */
exports.generateMetadata = async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Acesso negado. Apenas administradores podem executar esta operação.",
      });
    }

    const metadata = await rssSyncService.generateAndSaveMetadata();

    res.json({
      success: true,
      message: "Metadados RSS gerados e salvos com sucesso",
      data: metadata,
    });
  } catch (error) {
    console.error("Erro ao gerar metadados RSS:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao gerar metadados RSS",
      error: error.message,
    });
  }
};

/**
 * Fazer download do ZIP de uma fonte RSS específica
 */
exports.downloadRSSSource = async (req, res) => {
  try {
    const { source } = req.params;

    // Verificar se a fonte existe
    const rssSource = await RSS.findOne({ source, active: true });
    if (!rssSource) {
      return res.status(404).json({
        success: false,
        message: `Fonte RSS "${source}" não encontrada ou inativa`,
      });
    }

    // Criar o arquivo ZIP da fonte
    const zipPath = await rssSyncService.createRSSSourceZip(source);

    // Enviar o arquivo para download
    res.download(zipPath, `${source}.zip`, (err) => {
      if (err) {
        console.error(`Erro ao enviar arquivo ZIP da fonte ${source}:`, err);
      }

      // Remover o arquivo temporário após o download
      fs.unlink(zipPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `Erro ao remover arquivo temporário para ${source}:`,
            unlinkErr
          );
        }
      });
    });
  } catch (error) {
    console.error(
      `Erro ao criar ZIP para fonte RSS ${req.params.source}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: `Erro ao criar ZIP para fonte RSS "${req.params.source}"`,
      error: error.message,
    });
  }
};

/**
 * Fazer download do ZIP com todas as fontes RSS
 */
exports.downloadFullRSS = async (req, res) => {
  try {
    // Criar o arquivo ZIP completo
    const zipPath = await rssSyncService.createFullRSSZip();

    // Enviar o arquivo para download
    res.download(zipPath, "combo_rss_full.zip", (err) => {
      if (err) {
        console.error("Erro ao enviar arquivo ZIP completo:", err);
      }

      // Remover o arquivo temporário após o download
      fs.unlink(zipPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            "Erro ao remover arquivo temporário completo:",
            unlinkErr
          );
        }
      });
    });
  } catch (error) {
    console.error("Erro ao criar ZIP completo de RSS:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao criar ZIP completo de RSS",
      error: error.message,
    });
  }
};

/**
 * Verificar quais fontes RSS foram atualizadas desde a última sincronização
 */
exports.checkUpdates = async (req, res) => {
  try {
    // Obter o timestamp da última sincronização do cliente
    const { lastSyncTimestamp } = req.query;
    const lastSync = parseInt(lastSyncTimestamp) || 0;

    // Obter todas as fontes RSS ativas
    const rssSources = await RSS.find({ active: true })
      .select("source name updatedAt")
      .lean();

    // Verificar quais fontes foram atualizadas
    const updatedSources = [];

    for (const source of rssSources) {
      const updateTime = source.updatedAt ? source.updatedAt.getTime() : 0;

      if (updateTime > lastSync) {
        updatedSources.push({
          id: source._id.toString(),
          source: source.source,
          name: source.name,
          updatedAt: updateTime,
        });
      }
    }

    // Retornar a lista de fontes atualizadas
    res.json({
      success: true,
      data: {
        updatedSources,
        currentTimestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("Erro ao verificar atualizações RSS:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao verificar atualizações RSS",
      error: error.message,
    });
  }
};

/**
 * Limpar arquivos temporários manualmente
 */
exports.cleanupTempFiles = async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Acesso negado. Apenas administradores podem executar esta operação.",
      });
    }

    await rssSyncService.cleanupTempFiles();

    res.json({
      success: true,
      message: "Arquivos temporários limpos com sucesso",
    });
  } catch (error) {
    console.error("Erro ao limpar arquivos temporários:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao limpar arquivos temporários",
      error: error.message,
    });
  }
};
