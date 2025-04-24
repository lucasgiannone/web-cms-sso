/**
 * Templates.js
 * Script para funcionalidades interativas do módulo de templates
 */

document.addEventListener("DOMContentLoaded", function () {
  // Inicialização de componentes
  initializeTemplateComponents();

  // Detectar e iniciar visualizações específicas
  initSpecificViews();
});

/**
 * Inicializa componentes gerais do módulo de templates
 */
function initializeTemplateComponents() {
  // Inicializar tooltips
  const tooltips = document.querySelectorAll("[data-template-tooltip]");
  tooltips.forEach((tooltip) => {
    tooltip.addEventListener("mouseenter", function () {
      const message = this.getAttribute("data-template-tooltip");

      // Criar e posicionar o tooltip
      const tip = document.createElement("div");
      tip.classList.add("template-tooltip");
      tip.textContent = message;

      document.body.appendChild(tip);

      const rect = this.getBoundingClientRect();
      tip.style.top = `${rect.top - tip.offsetHeight - 10}px`;
      tip.style.left = `${rect.left + rect.width / 2 - tip.offsetWidth / 2}px`;

      // Adicionar classe para mostrar com animação
      setTimeout(() => {
        tip.classList.add("show");
      }, 10);

      // Remover ao sair do elemento
      this.addEventListener("mouseleave", function onMouseLeave() {
        tip.classList.remove("show");

        // Remover após a animação
        setTimeout(() => {
          document.body.removeChild(tip);
        }, 200);

        this.removeEventListener("mouseleave", onMouseLeave);
      });
    });
  });

  // Toggle de visualização (Grade/Lista)
  const viewToggles = document.querySelectorAll("[data-template-view-toggle]");
  viewToggles.forEach((toggle) => {
    toggle.addEventListener("click", function () {
      const targetView = this.getAttribute("data-template-view-toggle");
      const viewContainer = document.querySelector(".template-view-container");

      // Remover classes ativas dos toggles
      viewToggles.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");

      // Alternar classe de visualização
      viewContainer.className = viewContainer.className.replace(
        /template-view-(grid|list)/g,
        ""
      );
      viewContainer.classList.add(`template-view-${targetView}`);

      // Salvar preferência do usuário
      localStorage.setItem("templateViewMode", targetView);
    });
  });

  // Restaurar visualização preferida
  const savedViewMode = localStorage.getItem("templateViewMode");
  if (savedViewMode) {
    const toggle = document.querySelector(
      `[data-template-view-toggle="${savedViewMode}"]`
    );
    if (toggle) {
      toggle.click();
    }
  }

  // Dropzone para upload de arquivos
  const dropzones = document.querySelectorAll(".template-dropzone");
  dropzones.forEach((dropzone) => {
    const input = dropzone.querySelector('input[type="file"]');

    if (!input) return;

    // Clicar no dropzone ativa o input
    dropzone.addEventListener("click", () => {
      input.click();
    });

    // Eventos de drag and drop
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("active");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("active");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("active");

      if (e.dataTransfer.files.length > 0) {
        input.files = e.dataTransfer.files;

        // Disparar evento change para atualizar UI
        const event = new Event("change", { bubbles: true });
        input.dispatchEvent(event);
      }
    });

    // Atualizar UI ao selecionar arquivos
    input.addEventListener("change", () => {
      if (input.files.length > 0) {
        const fileInfo = dropzone.querySelector(".template-dropzone-info");
        if (fileInfo) {
          if (input.files.length === 1) {
            fileInfo.textContent = `Arquivo selecionado: ${input.files[0].name}`;
          } else {
            fileInfo.textContent = `${input.files.length} arquivos selecionados`;
          }
        }

        // Adicionar classe para styling
        dropzone.classList.add("has-files");
      }
    });
  });
}

/**
 * Inicializa visualizações específicas com base na página atual
 */
function initSpecificViews() {
  // Editor de Variáveis
  if (document.querySelector(".template-variables-editor")) {
    initVariablesEditor();
  }

  // Criação de Mensagem
  if (document.querySelector(".template-message-creator")) {
    initMessageCreator();
  }

  // Visualizador de Templates (agora checando mais classes para compatibilidade)
  if (
    document.querySelector(".template-viewer") ||
    document.querySelector(".template-tab-button")
  ) {
    initTemplateViewer();
  }

  // Preview de Templates
  if (document.querySelector(".template-preview-container")) {
    initTemplatePreview();
  }

  // Criador de Template
  if (document.querySelector(".template-creator")) {
    initTemplateCreator();
  }

  // Inicializar imediatamente as abas se existirem
  initTemplateViewer();
}

/**
 * Inicializa o editor de variáveis
 */
function initVariablesEditor() {
  const variablesContainer = document.querySelector(
    ".template-variables-container"
  );
  const previewFrame = document.querySelector(".template-preview-frame");
  const variableInputs = document.querySelectorAll(".template-variable-input");

  if (!variablesContainer || !previewFrame) return;

  // Atualizar preview quando variáveis são alteradas
  variableInputs.forEach((input) => {
    // Selecionar evento apropriado para o tipo de input
    const eventType =
      input.tagName === "TEXTAREA" || input.type === "text"
        ? "input"
        : "change";

    input.addEventListener(eventType, updatePreview);
  });

  // Manipular uploads de imagem
  const imageUploads = document.querySelectorAll(
    '.template-image-upload input[type="file"]'
  );
  imageUploads.forEach((upload) => {
    upload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const variableName = this.getAttribute("data-variable-name");
        const previewElement = document.querySelector(
          `.template-image-preview[data-variable-name="${variableName}"]`
        );

        // Criar URL temporária da imagem
        const objectUrl = URL.createObjectURL(this.files[0]);

        // Atualizar preview da imagem
        if (previewElement) {
          previewElement.src = objectUrl;
          previewElement.classList.add("has-image");

          // Revogar URL quando a imagem carregar
          previewElement.onload = () => {
            URL.revokeObjectURL(objectUrl);
          };
        }

        // Atualizar o preview do template
        updatePreview();
      }
    });
  });

  // Destacar variável ao clicar nela
  const variableItems = document.querySelectorAll(".template-variable-item");
  variableItems.forEach((item) => {
    item.addEventListener("click", function () {
      variableItems.forEach((i) => i.classList.remove("active"));
      this.classList.add("active");

      // Destacar a variável no preview
      const variableName = this.getAttribute("data-variable-name");
      highlightVariableInPreview(variableName);
    });
  });

  // Função para atualizar o preview com valores atuais
  function updatePreview() {
    if (!previewFrame.contentDocument) return;

    // Atualizar cada variável no preview
    variableInputs.forEach((input) => {
      const variableName = input.getAttribute("data-variable-name");
      const variableType = input.getAttribute("data-variable-type");

      if (!variableName) return;

      const elements = previewFrame.contentDocument.querySelectorAll(
        `[data-var="${variableName}"], [data-variable-name="${variableName}"]`
      );

      elements.forEach((element) => {
        // Atualizar baseado no tipo de variável
        if (variableType === "text") {
          element.textContent = input.value;
        } else if (variableType === "image") {
          // Para inputs de file, precisamos verificar se temos uma imagem selecionada
          if (input.type === "file" && input.files && input.files[0]) {
            // A imagem já deve ter sido processada no evento change
          } else if (input.type === "text" || input.type === "url") {
            // Para URLs de imagem
            const img = element.querySelector("img") || element;
            if (img.tagName === "IMG") {
              img.src = input.value;
            }
          }
        } else if (
          variableType === "color" ||
          variableType === "rect" ||
          variableType === "circle"
        ) {
          element.style.backgroundColor = input.value;
        }
      });
    });
  }

  // Função para destacar visualmente uma variável no preview
  function highlightVariableInPreview(variableName) {
    if (!previewFrame.contentDocument) return;

    // Remover destaque anterior
    const previousHighlights = previewFrame.contentDocument.querySelectorAll(
      ".variable-highlight"
    );
    previousHighlights.forEach((el) => {
      el.classList.remove("variable-highlight");
    });

    // Adicionar novo destaque
    const elements = previewFrame.contentDocument.querySelectorAll(
      `[data-var="${variableName}"], [data-variable-name="${variableName}"]`
    );

    elements.forEach((element) => {
      element.classList.add("variable-highlight");

      // Scroll para a variável destacada
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Inicializar preview
  updatePreview();
}

/**
 * Inicializa o criador de mensagens
 */
function initMessageCreator() {
  const messageForm = document.querySelector(".template-message-form");
  const previewContainer = document.querySelector(".template-message-preview");
  const variableInputs = document.querySelectorAll(".template-variable-input");

  if (!messageForm || !previewContainer) return;

  // Similar ao editor de variáveis, mas com campos adicionais para metadados da mensagem
  variableInputs.forEach((input) => {
    const eventType =
      input.tagName === "TEXTAREA" || input.type === "text"
        ? "input"
        : "change";
    input.addEventListener(eventType, updateMessagePreview);
  });

  // Processar uploads de imagem
  const imageUploads = document.querySelectorAll(
    '.template-image-upload input[type="file"]'
  );
  imageUploads.forEach((upload) => {
    upload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const variableName = this.getAttribute("data-variable-name");
        const previewElement = document.querySelector(
          `.template-image-preview[data-variable-name="${variableName}"]`
        );

        if (previewElement) {
          const objectUrl = URL.createObjectURL(this.files[0]);
          previewElement.src = objectUrl;
          previewElement.classList.add("has-image");

          // Atualizar o preview
          updateMessagePreview();

          previewElement.onload = () => {
            URL.revokeObjectURL(objectUrl);
          };
        }
      }
    });
  });

  // Função para atualizar o preview de mensagem
  function updateMessagePreview() {
    // Usar o template HTML original como base
    const templateHTML = messageForm.getAttribute("data-template-html");
    if (!templateHTML) return;

    // Criar um documento temporário
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = templateHTML;

    // Atualizar cada variável
    variableInputs.forEach((input) => {
      const variableName = input.getAttribute("data-variable-name");
      const variableType = input.getAttribute("data-variable-type");

      if (!variableName) return;

      const elements = tempDiv.querySelectorAll(
        `[data-var="${variableName}"], [data-variable-name="${variableName}"]`
      );

      elements.forEach((element) => {
        // Atualizar baseado no tipo de variável
        if (variableType === "text") {
          element.textContent = input.value;
        } else if (variableType === "image") {
          if (input.type === "file" && input.files && input.files[0]) {
            const previewImg = document.querySelector(
              `.template-image-preview[data-variable-name="${variableName}"]`
            );
            if (previewImg && previewImg.src) {
              const img = element.querySelector("img") || element;
              if (img.tagName === "IMG") {
                img.src = previewImg.src;
              }
            }
          } else if (input.type === "text" || input.type === "url") {
            const img = element.querySelector("img") || element;
            if (img.tagName === "IMG") {
              img.src = input.value;
            }
          }
        } else if (
          variableType === "color" ||
          variableType === "rect" ||
          variableType === "circle"
        ) {
          element.style.backgroundColor = input.value;
        }
      });
    });

    // Atualizar o preview
    previewContainer.innerHTML = tempDiv.innerHTML;
  }

  // Inicializar preview ao carregar
  updateMessagePreview();
}

/**
 * Inicializa o visualizador de templates
 */
function initTemplateViewer() {
  const tabButtons = document.querySelectorAll(".template-tab-button");
  const tabContents = document.querySelectorAll(".template-tab-content");

  if (!tabButtons.length || !tabContents.length) return;

  // Alternar entre abas
  tabButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const tabId = this.getAttribute("data-tab");

      // Ativar botão
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Mostrar conteúdo da aba
      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.getAttribute("data-tab") === tabId) {
          content.classList.add("active");
        }
      });
    });
  });

  // Ativar a primeira aba por padrão
  if (tabButtons[0]) {
    tabButtons[0].click();
  }
}

/**
 * Inicializa o criador de templates
 */
function initTemplateCreator() {
  const htmlInput = document.querySelector(".template-creator-file");
  const previewContainer = document.querySelector(".template-creator-preview");
  const variablesContainer = document.querySelector(
    ".template-creator-variables"
  );

  if (!htmlInput || !previewContainer || !variablesContainer) return;

  // Processar arquivo HTML e extrair variáveis
  htmlInput.addEventListener("change", function () {
    if (this.files && this.files[0]) {
      const file = this.files[0];
      const reader = new FileReader();

      reader.onload = function (e) {
        const html = e.target.result;

        // Atualizar preview
        previewContainer.innerHTML = html;

        // Extrair variáveis do HTML
        const variables = extractVariables(html);

        // Atualizar lista de variáveis
        updateVariablesList(variables);
      };

      reader.readAsText(file);
    }
  });

  // Função para extrair variáveis do HTML
  function extractVariables(html) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const variables = [];

    // Buscar elementos com data-var ou data-variable-name
    const elements = [
      ...tempDiv.querySelectorAll("[data-var]"),
      ...tempDiv.querySelectorAll("[data-variable-name]"),
    ];

    elements.forEach((element) => {
      const name =
        element.getAttribute("data-var") ||
        element.getAttribute("data-variable-name");
      let type =
        element.getAttribute("data-var-type") ||
        element.getAttribute("data-type") ||
        "text";

      // Determinar tipo se não estiver especificado
      if (type === "text" && element.querySelector("img")) {
        type = "image";
      }

      // Evitar duplicatas
      if (!variables.some((v) => v.name === name)) {
        variables.push({
          name,
          type,
          value: type === "text" ? element.textContent.trim() : "",
        });
      }
    });

    return variables;
  }

  // Função para atualizar a lista de variáveis na UI
  function updateVariablesList(variables) {
    variablesContainer.innerHTML = "";

    if (variables.length === 0) {
      variablesContainer.innerHTML =
        '<p class="text-muted">Nenhuma variável encontrada no template.</p>';
      return;
    }

    variables.forEach((variable, index) => {
      const variableElement = document.createElement("div");
      variableElement.classList.add("template-variable-item");

      variableElement.innerHTML = `
        <div class="template-variable-header">
          <h5 class="template-variable-name">${variable.name}</h5>
          <span class="template-variable-type ${variable.type}">${
        variable.type
      }</span>
        </div>
        
        <div class="template-form-group">
          <input type="hidden" name="variables[${index}][name]" value="${
        variable.name
      }">
          <input type="hidden" name="variables[${index}][type]" value="${
        variable.type
      }">
          
          ${
            variable.type === "text"
              ? `<textarea class="template-form-control" name="variables[${index}][value]" rows="2">${variable.value}</textarea>`
              : ""
          }
          
          ${
            variable.type === "image"
              ? `<div class="template-image-upload">
                <button type="button" class="template-btn template-btn-outline-secondary">
                  <i class="fas fa-image"></i> Selecionar Imagem
                </button>
                <input type="file" name="variables[${index}][file]" accept="image/*">
              </div>
              <input type="text" class="template-form-control mt-2" name="variables[${index}][value]" placeholder="ou URL da imagem">`
              : ""
          }
            
          ${
            variable.type === "rect" ||
            variable.type === "circle" ||
            variable.type === "color"
              ? `<input type="color" class="template-form-control" name="variables[${index}][value]" value="#ffffff">`
              : ""
          }
        </div>
      `;

      variablesContainer.appendChild(variableElement);
    });
  }
}

/**
 * Inicializa o preview de template
 */
function initTemplatePreview() {
  const previewContainer = document.querySelector(
    ".template-preview-container"
  );

  if (!previewContainer) return;

  // Adicionar controles de zoom
  const zoomControls = document.createElement("div");
  zoomControls.classList.add("template-preview-controls");

  zoomControls.innerHTML = `
    <button type="button" class="template-btn template-btn-sm" data-zoom="out">
      <i class="fas fa-search-minus"></i>
    </button>
    <span class="template-preview-zoom-level">100%</span>
    <button type="button" class="template-btn template-btn-sm" data-zoom="in">
      <i class="fas fa-search-plus"></i>
    </button>
    <button type="button" class="template-btn template-btn-sm" data-zoom="reset">
      <i class="fas fa-redo"></i>
    </button>
  `;

  previewContainer.appendChild(zoomControls);

  // Funcionalidade de zoom
  let zoomLevel = 100;
  const zoomLevelDisplay = zoomControls.querySelector(
    ".template-preview-zoom-level"
  );
  const previewContent =
    previewContainer.querySelector(".template-preview-content") ||
    previewContainer.firstElementChild;

  if (previewContent) {
    // Botões de zoom
    zoomControls
      .querySelector('[data-zoom="in"]')
      .addEventListener("click", () => {
        zoomLevel += 10;
        updateZoom();
      });

    zoomControls
      .querySelector('[data-zoom="out"]')
      .addEventListener("click", () => {
        zoomLevel = Math.max(50, zoomLevel - 10);
        updateZoom();
      });

    zoomControls
      .querySelector('[data-zoom="reset"]')
      .addEventListener("click", () => {
        zoomLevel = 100;
        updateZoom();
      });

    // Funcão para atualizar o zoom
    function updateZoom() {
      previewContent.style.transform = `scale(${zoomLevel / 100})`;
      previewContent.style.transformOrigin = "top left";
      zoomLevelDisplay.textContent = `${zoomLevel}%`;
    }
  }
}
