/**
 * CMS Web - Player Gustavo
 * Arquivo JavaScript principal
 */

// Encapsular todo o código em uma IIFE para evitar poluição do escopo global
(function () {
  // Variável global para armazenar se a ordem foi alterada
  let playlistOrderChanged = false;

  document.addEventListener("DOMContentLoaded", function () {
    // Inicializa tooltips do Bootstrap
    const tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Inicializa popovers do Bootstrap
    const popoverTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="popover"]')
    );
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });

    // Fecha alertas automaticamente após 5 segundos
    setTimeout(function () {
      const alerts = document.querySelectorAll(".alert");
      alerts.forEach(function (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      });
    }, 5000);

    // Confirmação para exclusão
    const deleteButtons = document.querySelectorAll(".btn-delete");
    deleteButtons.forEach(function (button) {
      button.addEventListener("click", function (e) {
        if (
          !confirm(
            "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
          )
        ) {
          e.preventDefault();
        }
      });
    });

    // Preview de imagem para upload
    const imageInput = document.getElementById("mediaFile");
    const imagePreview = document.getElementById("imagePreview");

    if (imageInput && imagePreview) {
      imageInput.addEventListener("change", function () {
        const file = this.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = "block";
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Inicializar a funcionalidade de reordenação de playlist
    initPlaylistSorting();

    // Inicializar o botão de salvar ordem da playlist
    const saveOrderButton = document.getElementById("save-playlist-order");
    if (saveOrderButton) {
      saveOrderButton.addEventListener("click", function (e) {
        e.preventDefault();
        savePlaylistOrder();
      });
    }

    // Filtro de tabelas
    initTableFilter();

    // Validação de formulários
    initFormValidation();

    // Remover scripts externos problemáticos ou corrigir problemas de CORS
    removeProblematicScripts();
  });

  // Função para remover scripts externos problemáticos
  function removeProblematicScripts() {
    // Remover qualquer script que esteja causando problemas de CORS (dlnk.one)
    const scripts = document.querySelectorAll('script[src*="dlnk.one"]');
    scripts.forEach((script) => {
      script.remove();
    });
  }

  /**
   * Inicializa a funcionalidade de arrastar e soltar para reordenar itens da playlist
   */
  function initPlaylistSorting() {
    const playlistContainer = document.getElementById("playlist-items");
    if (!playlistContainer) return;

    // Verificar se o navegador suporta a API de Drag and Drop
    if (typeof document.createElement("div").draggable === "undefined") {
      console.error(
        "Seu navegador não suporta a funcionalidade de arrastar e soltar"
      );
      return;
    }

    // Adicionar eventos para cada item da playlist
    const items = playlistContainer.querySelectorAll(".playlist-item");
    if (items.length === 0) return;

    // Configurar cada item para ser arrastável
    items.forEach((item) => {
      // Tornar o item arrastável
      item.setAttribute("draggable", "true");

      // Adicionar classe visual para indicar que é arrastável
      item.classList.add("draggable");

      // Evento quando começa a arrastar
      item.addEventListener("dragstart", function (e) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", this.dataset.itemId);
        this.classList.add("dragging");
      });

      // Evento quando termina de arrastar
      item.addEventListener("dragend", function () {
        this.classList.remove("dragging");
        // Mostrar o botão de salvar alterações
        showSaveOrderButton();
      });

      // Eventos para quando um item está sobre outro
      item.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        return false;
      });

      item.addEventListener("dragenter", function () {
        this.classList.add("drag-over");
      });

      item.addEventListener("dragleave", function () {
        this.classList.remove("drag-over");
      });

      // Evento quando um item é solto sobre outro
      item.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();

        this.classList.remove("drag-over");

        const draggedItemId = e.dataTransfer.getData("text/plain");
        const draggedItem = document.querySelector(
          `.playlist-item[data-item-id="${draggedItemId}"]`
        );

        if (draggedItem && this !== draggedItem) {
          // Determinar se deve inserir antes ou depois do item alvo
          const rect = this.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          const insertBefore = e.clientY < midpoint;

          if (insertBefore) {
            playlistContainer.insertBefore(draggedItem, this);
          } else {
            playlistContainer.insertBefore(draggedItem, this.nextSibling);
          }

          // Atualizar os números de ordem visíveis
          updateVisibleOrder();

          // Mostrar o botão de salvar alterações
          showSaveOrderButton();
        }

        return false;
      });
    });

    // Também permitir soltar no container da playlist
    playlistContainer.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      return false;
    });

    playlistContainer.addEventListener("drop", function (e) {
      e.preventDefault();

      const draggedItemId = e.dataTransfer.getData("text/plain");
      const draggedItem = document.querySelector(
        `.playlist-item[data-item-id="${draggedItemId}"]`
      );

      if (draggedItem) {
        // Verificar se o cursor está mais próximo do último item
        const items = this.querySelectorAll(".playlist-item");
        const lastItem = items[items.length - 1];

        if (lastItem) {
          const rect = lastItem.getBoundingClientRect();
          const afterLastItem = e.clientY > rect.top + rect.height;

          if (afterLastItem) {
            this.appendChild(draggedItem);
            updateVisibleOrder();
            showSaveOrderButton();
          }
        }
      }

      return false;
    });
  }

  /**
   * Atualiza os números de ordem visíveis nos itens da playlist
   */
  function updateVisibleOrder() {
    const items = document.querySelectorAll("#playlist-items .playlist-item");

    items.forEach((item, index) => {
      const orderBadge = item.querySelector(".badge");
      if (orderBadge) {
        orderBadge.textContent = index + 1;
      }
    });
  }

  /**
   * Mostra o botão de salvar alterações e exibe uma mensagem
   */
  function showSaveOrderButton() {
    const saveButton = document.getElementById("save-playlist-order");
    if (saveButton) {
      saveButton.classList.remove("d-none");
      showToast(
        "Ordem alterada. Clique em 'Salvar alterações' para confirmar.",
        "warning"
      );
    }
  }

  /**
   * Salva a ordem dos itens da playlist no servidor
   */
  function savePlaylistOrder() {
    const playlistContainer = document.getElementById("playlist-items");
    if (!playlistContainer) {
      console.error("Container da playlist não encontrado");
      return;
    }

    const playlistId = playlistContainer.dataset.playlistId;
    if (!playlistId) {
      console.error("ID da playlist não encontrado");
      showToast("Erro ao salvar: ID da playlist não encontrado", "danger");
      return;
    }

    // Coletar os IDs dos itens na ordem atual
    const items = playlistContainer.querySelectorAll(".playlist-item");
    const orderData = [];

    items.forEach((item, index) => {
      const itemId = item.dataset.itemId;
      if (itemId) {
        orderData.push({
          id: itemId,
          order: index,
        });
      }
    });

    if (orderData.length === 0) {
      console.error("Nenhum item encontrado para reordenar");
      showToast("Erro ao salvar: Nenhum item encontrado", "danger");
      return;
    }

    // Mostrar indicador de carregamento
    const saveButton = document.getElementById("save-playlist-order");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    }

    // Enviar a nova ordem para o servidor
    fetch(`/api/playlists/${playlistId}/reorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: orderData }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          showToast("Ordem atualizada com sucesso!", "success");

          // Esconder o botão de salvar
          if (saveButton) {
            saveButton.classList.add("d-none");
            saveButton.disabled = false;
            saveButton.innerHTML =
              '<i class="bi bi-save me-1"></i>Salvar alterações';
          }
        } else {
          throw new Error(data.message || "Erro ao atualizar a ordem");
        }
      })
      .catch((error) => {
        console.error("Erro ao salvar a ordem:", error);
        showToast(`Erro ao salvar: ${error.message}`, "danger");

        // Restaurar o botão
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.innerHTML =
            '<i class="bi bi-save me-1"></i>Salvar alterações';
        }
      });
  }

  /**
   * Inicializa o filtro de tabelas
   */
  function initTableFilter() {
    const tableFilter = document.getElementById("tableFilter");

    if (!tableFilter) return;

    tableFilter.addEventListener("keyup", function () {
      const filterValue = this.value.toLowerCase();
      const table = document.querySelector(this.dataset.tableTarget);
      const rows = table.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filterValue) ? "" : "none";
      });
    });
  }

  /**
   * Inicializa a validação de formulários
   */
  function initFormValidation() {
    const forms = document.querySelectorAll(".needs-validation");

    Array.from(forms).forEach((form) => {
      form.addEventListener(
        "submit",
        (event) => {
          if (!form.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
          }

          form.classList.add("was-validated");
        },
        false
      );
    });
  }

  /**
   * Exibe um toast de notificação
   */
  function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toast-container");

    if (!toastContainer) {
      const container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      document.body.appendChild(container);
    }

    const toastId = "toast-" + Date.now();
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.id = toastId;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
    `;

    document.getElementById("toast-container").appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, {
      autohide: true,
      delay: 5000,
    });

    bsToast.show();

    // Remover o toast do DOM após ser escondido
    toast.addEventListener("hidden.bs.toast", function () {
      this.remove();
    });
  }

  // Exportar apenas o que for necessário para o escopo global
  window.CMS = window.CMS || {};
  window.CMS.savePlaylistOrder = savePlaylistOrder;
  window.CMS.showToast = showToast;
})(); // Fim da IIFE
