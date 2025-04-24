const Template = require("../models/template.model");
const { JSDOM } = require("jsdom");
const Media = require("../models/media.model");
const fs = require("fs");
const path = require("path");
const Group = require("../models/group.model");

/**
 * Extrai as variáveis dinâmicas do HTML de um template
 * @param {string} htmlContent - Conteúdo HTML do template
 * @returns {Array} Lista de variáveis dinâmicas encontradas
 */
const extractDynamicVariables = (htmlContent) => {
  const variables = [];
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;

  // Conjunto para rastrear nomes de variáveis já processados (evita duplicatas)
  const processedVars = new Set();

  // Busca por elementos com atributo data-var
  const elementsWithDataVar = document.querySelectorAll("[data-var]");

  console.log(
    `Encontrados ${elementsWithDataVar.length} elementos com atributo data-var`
  );

  elementsWithDataVar.forEach((element) => {
    const name = element.getAttribute("data-var");

    // Verificamos se o nome da variável começa com 'dynamic_'
    if (name && name.startsWith("dynamic_") && !processedVars.has(name)) {
      processedVars.add(name);
      const type = element.getAttribute("data-var-type") || "text";

      // Valor padrão baseado no tipo
      let defaultValue = null;

      if (type === "text") {
        defaultValue = element.textContent || "";
      } else if (type === "image") {
        const img = element.querySelector("img");
        defaultValue = img ? img.getAttribute("src") : "";
      }

      variables.push({
        name,
        type,
        value: defaultValue,
      });
    }
  });

  // Também busca por elementos com atributo data-variable-name (para compatibilidade)
  const elementsWithVariableName = document.querySelectorAll(
    "[data-variable-name]"
  );

  console.log(
    `Encontrados ${elementsWithVariableName.length} elementos com atributo data-variable-name`
  );

  elementsWithVariableName.forEach((element) => {
    const name = element.getAttribute("data-variable-name");

    // Verificamos se o nome da variável começa com 'dynamic_' e se ainda não foi processada
    if (name && name.startsWith("dynamic_") && !processedVars.has(name)) {
      processedVars.add(name);
      const type = element.getAttribute("data-type") || "text";

      // Valor padrão baseado no tipo
      let defaultValue = null;

      if (type === "text") {
        defaultValue = element.textContent || "";
      } else if (type === "image") {
        const img = element.querySelector("img");
        defaultValue = img ? img.getAttribute("src") : "";
      }

      variables.push({
        name,
        type,
        value: defaultValue,
      });
    }
  });

  console.log(`Total de variáveis dinâmicas encontradas: ${variables.length}`);
  return variables;
};

/**
 * Lista todos os templates
 */
exports.list = async (req, res) => {
  try {
    const templates = await Template.find({ active: true })
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name")
      .sort({ updatedAt: -1 });

    res.render("templates/list", {
      templates,
      user: req.user,
      title: "Gerenciar Templates",
      active: "templates",
    });
  } catch (error) {
    console.error("Erro ao listar templates:", error);
    req.flash("error", "Erro ao carregar templates");
    res.redirect("/dashboard");
  }
};

/**
 * Exibe o formulário para criar um novo template
 */
exports.createForm = (req, res) => {
  res.render("templates/create", {
    user: req.user,
    title: "Criar Novo Template",
    active: "templates",
  });
};

/**
 * Cria um novo template
 */
exports.create = async (req, res) => {
  try {
    const { name, description, htmlContent } = req.body;
    let htmlData = htmlContent;

    // Se um arquivo foi enviado, usar o conteúdo dele
    if (req.file) {
      const fs = require("fs");
      htmlData = fs.readFileSync(req.file.path, "utf8");

      // Remover o arquivo temporário
      fs.unlinkSync(req.file.path);
    }

    // Verificar se temos conteúdo HTML
    if (!htmlData) {
      req.flash("error", "É necessário fornecer o conteúdo HTML do template");
      return res.redirect("/templates/create");
    }

    // Extrair variáveis dinâmicas do HTML
    const variables = extractDynamicVariables(htmlData);

    const template = new Template({
      name,
      description,
      htmlContent: htmlData,
      variables,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });

    await template.save();

    req.flash("success", "Template criado com sucesso");
    res.redirect("/templates");
  } catch (error) {
    console.error("Erro ao criar template:", error);
    req.flash("error", "Erro ao criar template");
    res.redirect("/templates/create");
  }
};

/**
 * Exibe detalhes de um template
 */
exports.details = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name");

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    // Buscar mensagens (mídias HTML) relacionadas a este template
    const messages = await Media.find({
      type: "html",
      "metadata.templateId": req.params.id,
    }).sort({ createdAt: -1 });

    // Calcular estatísticas de mensagens ativas e inativas
    const activeMessages = messages.filter((msg) => msg.active).length;
    const inactiveMessages = messages.filter((msg) => !msg.active).length;

    console.log(
      `Encontradas ${messages.length} mensagens para o template ${template.name} (${activeMessages} ativas, ${inactiveMessages} inativas)`
    );

    res.render("templates/details", {
      template,
      messages,
      activeMessages,
      inactiveMessages,
      user: req.user,
      title: `Template - ${template.name}`,
      active: "templates",
    });
  } catch (error) {
    console.error("Erro ao carregar detalhes do template:", error);
    req.flash("error", "Erro ao carregar template");
    res.redirect("/templates");
  }
};

/**
 * Exibe o formulário para editar um template
 */
exports.editForm = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    res.render("templates/edit", {
      template,
      user: req.user,
      title: `Editar Template - ${template.name}`,
      active: "templates",
    });
  } catch (error) {
    console.error("Erro ao carregar formulário de edição:", error);
    req.flash("error", "Erro ao carregar formulário de edição");
    res.redirect("/templates");
  }
};

/**
 * Atualiza um template
 */
exports.update = async (req, res) => {
  try {
    const { name } = req.body;

    const template = await Template.findById(req.params.id);

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    // Atualiza apenas o nome do template
    template.name = name;
    template.lastModifiedBy = req.user._id;

    await template.save();

    req.flash("success", "Nome do template atualizado com sucesso");
    res.redirect(`/templates/${req.params.id}`);
  } catch (error) {
    console.error("Erro ao atualizar template:", error);
    req.flash("error", "Erro ao atualizar nome do template");
    res.redirect(`/templates/edit/${req.params.id}`);
  }
};

/**
 * Remove um template (marcando como inativo)
 */
exports.delete = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    // Marca como inativo em vez de excluir
    template.active = false;
    template.lastModifiedBy = req.user._id;

    await template.save();

    req.flash("success", "Template removido com sucesso");
    res.redirect("/templates");
  } catch (error) {
    console.error("Erro ao remover template:", error);
    req.flash("error", "Erro ao remover template");
    res.redirect("/templates");
  }
};

/**
 * Exibe o editor de variáveis dinâmicas
 */
exports.editVariables = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    res.render("templates/edit_variables", {
      template,
      user: req.user,
      title: `Editar Variáveis - ${template.name}`,
      active: "templates",
    });
  } catch (error) {
    console.error("Erro ao carregar editor de variáveis:", error);
    req.flash("error", "Erro ao carregar editor de variáveis");
    res.redirect("/templates");
  }
};

/**
 * Atualiza as variáveis dinâmicas de um template
 */
exports.updateVariables = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    // Recebe as variáveis atualizadas do formulário
    let updatedVariables = [];

    // Verifica como os dados das variáveis estão vindo (pode variar dependendo do método de envio do formulário)
    if (req.body.variables) {
      // Se veio como object ou array direto
      if (Array.isArray(req.body.variables)) {
        updatedVariables = req.body.variables;
      } else if (
        typeof req.body.variables === "object" &&
        !Array.isArray(req.body.variables)
      ) {
        // Convertendo de objeto para array (caso venha no formato variables[0], variables[1], etc)
        updatedVariables = Object.values(req.body.variables);
      } else if (typeof req.body.variables === "string") {
        // Se veio como string (JSON), tenta parsear
        try {
          updatedVariables = JSON.parse(req.body.variables);
        } catch (parseError) {
          console.error("Erro ao parsear variáveis:", parseError);
          req.flash("error", "Formato de variáveis inválido");
          return res.redirect(`/templates/variables/${req.params.id}`);
        }
      }
    }

    // Log para debug
    console.log(
      "Variáveis recebidas do formulário:",
      JSON.stringify(updatedVariables, null, 2)
    );

    // Atualiza as variáveis no template
    if (updatedVariables && updatedVariables.length > 0) {
      template.variables = updatedVariables.map((variable) => ({
        name: variable.name,
        type: variable.type,
        value: variable.value || "",
      }));
    }

    template.lastModifiedBy = req.user._id;
    await template.save();

    console.log(
      "Variáveis salvas com sucesso:",
      JSON.stringify(template.variables, null, 2)
    );
    req.flash("success", "Variáveis atualizadas com sucesso");
    res.redirect(`/templates/${req.params.id}`);
  } catch (error) {
    console.error("Erro ao atualizar variáveis:", error);
    req.flash("error", `Erro ao atualizar variáveis: ${error.message}`);
    res.redirect(`/templates/variables/${req.params.id}`);
  }
};

/**
 * Exibe o formulário para criar uma nova mensagem a partir de um template
 */
exports.createMessageForm = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name");

    if (!template) {
      req.flash("error", "Template não encontrado");
      return res.redirect("/templates");
    }

    // Buscar todos os grupos ativos
    const groups = await Group.find({ active: true }).sort("name");

    res.render("templates/create_message", {
      template,
      groups,
      user: req.user,
      title: `Nova Mensagem - ${template.name}`,
      active: "templates",
    });
  } catch (error) {
    console.error("Erro ao carregar formulário de nova mensagem:", error);
    req.flash("error", "Erro ao carregar formulário de nova mensagem");
    res.redirect("/templates");
  }
};

/**
 * Cria uma nova mensagem (mídia) a partir de um template
 */
exports.createMessage = async (req, res) => {
  try {
    console.log("Iniciando criação de mensagem a partir do template");
    const templateId = req.params.id;
    console.log(`ID do template: ${templateId}`);

    // Verificar se o template existe
    const template = await Template.findById(templateId);
    if (!template) {
      console.error(`Template com ID ${templateId} não encontrado`);
      return res
        .status(404)
        .json({ success: false, message: "Template não encontrado" });
    }

    // Obter o HTML diretamente do template (sem buscar arquivo)
    const html = template.htmlContent;
    if (!html) {
      console.error(`Template com ID ${templateId} não possui conteúdo HTML`);
      return res
        .status(404)
        .json({ success: false, message: "Conteúdo HTML não encontrado" });
    }
    console.log(`Tamanho do HTML original: ${html.length} caracteres`);

    // Logging detalhado sobre o corpo da requisição e arquivos
    console.log("Dados do formulário recebidos:");
    console.log("Corpo da requisição:", JSON.stringify(req.body, null, 2));
    console.log(
      "Arquivos enviados:",
      req.files ? Object.keys(req.files) : "Nenhum arquivo recebido"
    );

    // Processar as variáveis recebidas do formulário
    let variables = [];

    // Criar um mapa de tipo de variável nome -> tipo usando as variáveis do template
    const variableTypeMap = {};
    if (template.variables && template.variables.length > 0) {
      template.variables.forEach((variable) => {
        variableTypeMap[variable.name] = variable.type;
      });
    }

    // Identificar todos os campos que começam com "variables["
    for (const key in req.body) {
      if (key.startsWith("variables[")) {
        // Extrair o nome da variável usando regex
        const match = key.match(/variables\[([^\]]+)\]/);
        if (match) {
          const varName = match[1];
          const value = req.body[key];

          console.log(
            `Campo encontrado: ${key}, nome=${varName}, valor=${value}`
          );

          // Obter o tipo da variável do mapa criado anteriormente
          const varType = variableTypeMap[varName] || "text"; // Padrão para text se não encontrado

          // Adicionar à lista de variáveis no formato esperado pelo código de substituição
          variables.push({
            name: varName,
            type: varType,
            value: value,
          });
        }
      }
    }

    // Adicionar variáveis de imagem que não foram incluídas acima
    // Isso garante que todas as variáveis do template sejam processadas
    if (template.variables && template.variables.length > 0) {
      template.variables.forEach((templateVar) => {
        // Verificar se a variável já foi adicionada
        const existingVar = variables.find((v) => v.name === templateVar.name);

        // Se não foi adicionada e é do tipo imagem, adicionar
        if (!existingVar && templateVar.type === "image") {
          console.log(
            `Adicionando variável de imagem não encontrada no body: ${templateVar.name}`
          );
          variables.push({
            name: templateVar.name,
            type: "image",
            value: templateVar.value || "",
          });
        }
      });
    }

    console.log(`Total de variáveis processadas: ${variables.length}`);
    console.log(`Variáveis processadas: ${JSON.stringify(variables, null, 2)}`);

    // Processar uploads de imagens
    if (req.files) {
      console.log("Processando arquivos de imagem:", Object.keys(req.files));
      console.log("Detalhes dos arquivos:", JSON.stringify(req.files, null, 2));

      // Garantir que o diretório de uploads exista
      const uploadDir = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "images"
      );
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Diretório de uploads criado: ${uploadDir}`);
      }

      // Processar cada variável e verificar se há um arquivo associado
      for (let i = 0; i < variables.length; i++) {
        const variable = variables[i];

        if (variable.type === "image") {
          // Correção: Usar o formato que corresponde ao nome do campo no frontend
          const fileKey = `variable_file_${variable.name}`;
          console.log(`Procurando arquivo com chave: ${fileKey}`);

          console.log(
            `Verificando arquivo para variável ${variable.name} (tipo: ${variable.type}, campo: ${fileKey})`
          );

          if (req.files && req.files[fileKey]) {
            const file = req.files[fileKey];
            console.log(
              `Arquivo encontrado para ${variable.name}: ${file.name}, tamanho: ${file.size} bytes`
            );

            // Criar um nome de arquivo único
            const fileExt = path.extname(file.name);
            const fileName = `${Date.now()}-${Math.round(
              Math.random() * 1000
            )}${fileExt}`;
            const filePath = path.join(uploadDir, fileName);

            // Caminho relativo para acesso via URL (sem a parte "public")
            const relativeFilePath = `/uploads/images/${fileName}`;

            // Mover o arquivo para o diretório de uploads
            try {
              await file.mv(filePath);
              console.log(`Arquivo salvo em: ${filePath}`);

              // Atualizar o valor da variável com o caminho para acesso via URL
              variable.value = relativeFilePath;
              console.log(
                `Variável ${variable.name} atualizada com o caminho: ${variable.value}`
              );
            } catch (fileError) {
              console.error(`Erro ao salvar arquivo: ${fileError.message}`);
            }
          } else {
            // Se não encontrou o arquivo, verificar se há algum arquivo que possa corresponder
            // Isso é útil para casos onde o nome do campo pode ter sido alterado
            let foundFile = false;

            // Verificar todos os arquivos enviados
            for (const key in req.files) {
              if (
                key.includes(variable.name) ||
                variable.name.includes(key.replace("variable_file_", ""))
              ) {
                const file = req.files[key];
                console.log(
                  `Arquivo alternativo encontrado para ${variable.name} com chave ${key}: ${file.name}, tamanho: ${file.size} bytes`
                );

                // Criar um nome de arquivo único
                const fileExt = path.extname(file.name);
                const fileName = `${Date.now()}-${Math.round(
                  Math.random() * 1000
                )}${fileExt}`;
                const filePath = path.join(uploadDir, fileName);

                // Caminho relativo para acesso via URL
                const relativeFilePath = `/uploads/images/${fileName}`;

                // Mover o arquivo
                try {
                  await file.mv(filePath);
                  console.log(`Arquivo alternativo salvo em: ${filePath}`);

                  // Atualizar o valor da variável
                  variable.value = relativeFilePath;
                  console.log(
                    `Variável ${variable.name} atualizada com o caminho alternativo: ${variable.value}`
                  );

                  foundFile = true;
                  break; // Sair do loop após encontrar um arquivo correspondente
                } catch (fileError) {
                  console.error(
                    `Erro ao salvar arquivo alternativo: ${fileError.message}`
                  );
                }
              }
            }

            if (!foundFile) {
              console.log(
                `Nenhum arquivo encontrado para a variável ${
                  variable.name
                }, mantendo URL existente: ${variable.value || "nenhum"}`
              );
            }
          }
        }
      }
    } else {
      console.log("Nenhum arquivo enviado com o formulário");
    }

    // Aplicar as variáveis ao HTML
    console.log(`Aplicando ${variables.length} variáveis ao HTML`);

    // Usar JSDOM para manipular o HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Rastrear substituições realizadas
    let substituicoes = [];

    // Processar cada variável
    for (const variable of variables) {
      // Encontrar elementos que correspondem à variável
      let elements = [];
      let elementsVar = document.querySelectorAll(
        `[data-var="${variable.name}"]`
      );
      let elementsVarName = document.querySelectorAll(
        `[data-variable-name="${variable.name}"]`
      );

      console.log(
        `Variável ${variable.name} (tipo: ${variable.type}): encontrados ${elementsVar.length} elementos com data-var e ${elementsVarName.length} elementos com data-variable-name`
      );

      // Combinar os resultados (pode haver duplicatas)
      elements = [...elementsVar, ...elementsVarName];

      // Registrar estado antes da substituição
      const elementosInfo = elements.map((el) => ({
        tag: el.tagName,
        tipo: variable.type,
        valorAntes:
          variable.type === "text"
            ? el.textContent
            : el.src || el.style.backgroundColor || "",
        valorDepois: variable.value || "",
      }));

      // Aplicar a substituição com base no tipo de variável
      elements.forEach((element) => {
        if (variable.type === "text") {
          const oldValue = element.textContent;
          element.textContent = variable.value || "";
          console.log(
            `Texto alterado em ${element.tagName}: "${oldValue}" -> "${variable.value}"`
          );
        } else if (variable.type === "image") {
          console.log(`Processando elemento de imagem: ${element.tagName}`);

          // Caso 1: O próprio elemento é uma tag IMG
          if (element.tagName === "IMG") {
            const oldSrc = element.getAttribute("src");
            element.setAttribute("src", variable.value || "");
            console.log(
              `Imagem diretamente alterada em ${element.tagName}: "${oldSrc}" -> "${variable.value}"`
            );
          }
          // Caso 2: O elemento contém uma tag IMG como filho
          else {
            const imgElement = element.querySelector("img");
            if (imgElement) {
              const oldSrc = imgElement.getAttribute("src");
              imgElement.setAttribute("src", variable.value || "");
              console.log(
                `Imagem dentro de ${element.tagName} alterada: "${oldSrc}" -> "${variable.value}"`
              );
            } else {
              console.log(
                `Elemento ${element.tagName} com variável de imagem '${variable.name}' não contém tag IMG`
              );

              // Tentar encontrar imagens em elementos filhos mais profundos
              const deepImgs = element.querySelectorAll("img");
              if (deepImgs.length > 0) {
                console.log(
                  `Encontradas ${deepImgs.length} imagens em níveis mais profundos`
                );
                deepImgs.forEach((img, idx) => {
                  const oldSrc = img.getAttribute("src");
                  img.setAttribute("src", variable.value || "");
                  console.log(
                    `Imagem ${
                      idx + 1
                    } em nível profundo alterada: "${oldSrc}" -> "${
                      variable.value
                    }"`
                  );
                });
              } else {
                // Se não encontrou nenhuma imagem, tenta criar uma
                console.log(
                  `Nenhuma imagem encontrada, tentando criar uma nova`
                );
                const newImg = document.createElement("img");
                newImg.setAttribute("src", variable.value || "");
                newImg.setAttribute("alt", variable.name);
                newImg.setAttribute("style", "max-width: 100%;");
                element.innerHTML = ""; // Limpa o conteúdo atual
                element.appendChild(newImg);
                console.log(
                  `Nova imagem criada e adicionada ao elemento ${element.tagName}`
                );
              }
            }
          }
        } else if (["rect", "circle", "triangle"].includes(variable.type)) {
          const oldStyle = element.style.backgroundColor;
          element.style.backgroundColor = variable.value || "";
          console.log(
            `Cor alterada em ${element.tagName}: "${oldStyle}" -> "${variable.value}"`
          );
        }
      });

      // Registrar as substituições realizadas
      substituicoes.push({
        variavel: variable.name,
        tipo: variable.type,
        valor: variable.value,
        elementosAlterados: elementosInfo,
        quantidade: elements.length,
      });
    }

    // Log de resumo das substituições
    console.log("Resumo das substituições:");
    console.log(JSON.stringify(substituicoes, null, 2));

    // Obter o HTML atualizado
    const updatedHtml = dom.serialize();
    console.log(`Tamanho do HTML atualizado: ${updatedHtml.length} caracteres`);
    console.log(
      `Mudança no tamanho: ${updatedHtml.length - html.length} bytes`
    );
    console.log(`HTML alterado: ${html === updatedHtml ? "Não" : "Sim"}`);

    // Garantir que o diretório de mensagens exista
    const mediaDir = path.join(__dirname, "..", "public", "uploads", "media");
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
      console.log(`Diretório de mensagens criado: ${mediaDir}`);
    }

    // Gerar um nome de arquivo único para a nova mensagem
    const fileName = `msg-${Date.now()}.html`;
    const messagePath = path.join(mediaDir, fileName);

    // Caminho relativo para acesso via URL (sem a parte "public")
    const relativeMessagePath = `/uploads/media/${fileName}`;

    // Salvar o HTML atualizado como uma nova mensagem
    fs.writeFileSync(messagePath, updatedHtml);
    console.log(`Nova mensagem salva em: ${messagePath}`);

    // Criar um registro de mídia no banco de dados
    const media = new Media({
      name: req.body.name || `${template.name} - Nova Mensagem`,
      description:
        req.body.description ||
        `Mensagem criada a partir do template ${template.name}`,
      type: "html",
      filePath: messagePath,
      downloadUrl: relativeMessagePath,
      fileSize: Buffer.byteLength(updatedHtml, "utf8"),
      mimeType: "text/html",
      duration: 10,
      uploadedBy: req.user._id,
      group: req.user.group,
      metadata: {
        isTemplateMessage: true,
        templateId: template._id,
        templateName: template.name,
        variables: variables,
      },
    });

    console.log(
      "Objeto Media a ser salvo:",
      JSON.stringify(
        {
          name: media.name,
          type: media.type,
          filePath: media.filePath,
          downloadUrl: media.downloadUrl,
          fileSize: media.fileSize,
        },
        null,
        2
      )
    );

    const savedMedia = await media.save();
    console.log(`Registro de mídia criado com ID: ${savedMedia._id}`);

    req.flash(
      "success",
      "Mensagem criada com sucesso e adicionada à biblioteca de mídias"
    );
    res.redirect(`/media/${savedMedia._id}`);
  } catch (error) {
    console.error("Erro ao criar mensagem a partir de template:", error);
    req.flash("error", `Erro ao criar mensagem: ${error.message}`);
    res.redirect(`/templates/create-message/${req.params.id}`);
  }
};

/**
 * Visualiza a prévia de um template
 */
exports.previewTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).send("Template não encontrado");
    }

    // Retornar o HTML do template diretamente
    res.header("Content-Type", "text/html");
    res.send(template.htmlContent);
  } catch (error) {
    console.error("Erro ao carregar prévia do template:", error);
    res.status(500).send("Erro ao carregar prévia do template");
  }
};

/**
 * Processa a prévia de uma mensagem em criação
 * Similar a createMessage, mas apenas retorna o HTML processado sem salvar
 */
exports.previewMessage = async (req, res) => {
  try {
    console.log("Processando prévia de mensagem a partir do template");
    const templateId = req.params.id;
    console.log(`ID do template: ${templateId}`);

    // Verificar se o template existe
    const template = await Template.findById(templateId);
    if (!template) {
      console.error(`Template com ID ${templateId} não encontrado`);
      return res.status(404).send("Template não encontrado");
    }

    // Obter o HTML diretamente do template
    const html = template.htmlContent;
    if (!html) {
      console.error(`Template com ID ${templateId} não possui conteúdo HTML`);
      return res.status(404).send("Conteúdo HTML não encontrado");
    }

    // Logging detalhado sobre o corpo da requisição e arquivos
    console.log("Dados do formulário recebidos para prévia:");
    console.log("Corpo da requisição:", JSON.stringify(req.body, null, 2));
    console.log(
      "Arquivos enviados:",
      req.files ? Object.keys(req.files) : "Nenhum arquivo recebido"
    );

    // Processar as variáveis recebidas do formulário
    let variables = [];

    // Criar um mapa de tipo de variável nome -> tipo usando as variáveis do template
    const variableTypeMap = {};
    if (template.variables && template.variables.length > 0) {
      template.variables.forEach((variable) => {
        variableTypeMap[variable.name] = variable.type;
      });
    }

    // Identificar todos os campos que começam com "variables["
    for (const key in req.body) {
      if (key.startsWith("variables[")) {
        // Extrair o nome da variável usando regex
        const match = key.match(/variables\[([^\]]+)\]/);
        if (match) {
          const varName = match[1];
          const value = req.body[key];

          // Obter o tipo da variável do mapa criado anteriormente
          const varType = variableTypeMap[varName] || "text"; // Padrão para text se não encontrado

          // Adicionar à lista de variáveis no formato esperado pelo código de substituição
          variables.push({
            name: varName,
            type: varType,
            value: value,
          });
        }
      }
    }

    // Adicionar variáveis de imagem que não foram incluídas acima
    if (template.variables && template.variables.length > 0) {
      template.variables.forEach((templateVar) => {
        // Verificar se a variável já foi adicionada
        const existingVar = variables.find((v) => v.name === templateVar.name);

        // Se não foi adicionada e é do tipo imagem, adicionar
        if (!existingVar && templateVar.type === "image") {
          variables.push({
            name: templateVar.name,
            type: "image",
            value: templateVar.value || "",
          });
        }
      });
    }

    // Processar uploads de imagens temporários para a prévia
    if (req.files) {
      for (let i = 0; i < variables.length; i++) {
        const variable = variables[i];

        if (variable.type === "image") {
          const fileKey = `variable_file_${variable.name}`;

          if (req.files && req.files[fileKey]) {
            const file = req.files[fileKey];

            // Para a prévia, usamos uma URL de dados (data URL) em vez de salvar o arquivo
            const base64Data = file.data.toString("base64");
            const dataUrl = `data:${file.mimetype};base64,${base64Data}`;

            // Atualizar o valor da variável com a URL de dados
            variable.value = dataUrl;
          } else {
            // Verificar arquivos alternativos
            for (const key in req.files) {
              if (
                key.includes(variable.name) ||
                variable.name.includes(key.replace("variable_file_", ""))
              ) {
                const file = req.files[key];

                // Criar URL de dados
                const base64Data = file.data.toString("base64");
                const dataUrl = `data:${file.mimetype};base64,${base64Data}`;

                // Atualizar o valor da variável
                variable.value = dataUrl;
                break;
              }
            }
          }
        }
      }
    }

    // Aplicar as variáveis ao HTML
    console.log(`Aplicando ${variables.length} variáveis à prévia do HTML`);

    // Usar JSDOM para manipular o HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Processar cada variável
    for (const variable of variables) {
      // Encontrar elementos que correspondem à variável
      let elements = [];
      let elementsVar = document.querySelectorAll(
        `[data-var="${variable.name}"]`
      );
      let elementsVarName = document.querySelectorAll(
        `[data-variable-name="${variable.name}"]`
      );

      // Combinar os resultados
      elements = [...elementsVar, ...elementsVarName];

      // Aplicar a substituição com base no tipo de variável
      elements.forEach((element) => {
        if (variable.type === "text") {
          element.textContent = variable.value || "";
        } else if (variable.type === "image") {
          // Caso 1: O próprio elemento é uma tag IMG
          if (element.tagName === "IMG") {
            element.setAttribute("src", variable.value || "");
          }
          // Caso 2: O elemento contém uma tag IMG como filho
          else {
            const imgElement = element.querySelector("img");
            if (imgElement) {
              imgElement.setAttribute("src", variable.value || "");
            } else {
              // Tentar encontrar imagens em elementos filhos mais profundos
              const deepImgs = element.querySelectorAll("img");
              if (deepImgs.length > 0) {
                deepImgs.forEach((img) => {
                  img.setAttribute("src", variable.value || "");
                });
              } else {
                // Se não encontrou nenhuma imagem, tenta criar uma
                const newImg = document.createElement("img");
                newImg.setAttribute("src", variable.value || "");
                newImg.setAttribute("alt", variable.name);
                newImg.setAttribute("style", "max-width: 100%;");
                element.innerHTML = ""; // Limpa o conteúdo atual
                element.appendChild(newImg);
              }
            }
          }
        } else if (["rect", "circle", "triangle"].includes(variable.type)) {
          element.style.backgroundColor = variable.value || "";
        }
      });
    }

    // Obter o HTML atualizado
    const updatedHtml = dom.serialize();

    // Retornar o HTML processado
    res.header("Content-Type", "text/html");
    res.send(updatedHtml);
  } catch (error) {
    console.error("Erro ao processar prévia da mensagem:", error);
    res
      .status(500)
      .send(
        `<div class="alert alert-danger">Erro ao processar prévia: ${error.message}</div>`
      );
  }
};
