// app.js
// Responsável por:
// 1) Carregar data/games.json e renderizar os cards de jogos
// 2) Filtrar jogos pela busca
// 3) Enviar o formulário de sugestões via fetch (sem recarregar a página)

(function () {
  "use strict";

  const GAMES_JSON_PATH = "data/games.json";

  const grid = document.getElementById("games-grid");
  const statusMsg = document.getElementById("status-msg");
  const searchInput = document.getElementById("search-input");

  let allGames = [];

  /**
   * Cria o elemento <li> de um card de jogo.
   * Cada card é um link que abre o jogo em nova aba,
   * preservando a aba do catálogo.
   */
  function createGameCard(game) {
    const li = document.createElement("li");
    li.className = "game-card";

    const link = document.createElement("a");
    link.className = "card-link";
    link.href = game.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Abrir ${game.title} em nova aba`);

    const imageWrap = document.createElement("div");
    imageWrap.className = "card-image-wrap";

    const img = document.createElement("img");
    img.src = game.cardImage;
    img.alt = `Capa do jogo ${game.title}`;
    img.loading = "lazy";
    img.onerror = function () {
      // Fallback simples caso a imagem do card não carregue
      img.src =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">
            <rect width="100%" height="100%" fill="#1d212b"/>
            <text x="50%" y="50%" fill="#9aa1ad" font-family="sans-serif" font-size="16" text-anchor="middle">${game.title}</text>
          </svg>`
        );
    };

    imageWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = game.title;
    body.appendChild(title);

    if (Array.isArray(game.tags) && game.tags.length > 0) {
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "card-tags";
      game.tags.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "card-tag";
        tagEl.textContent = tag;
        tagsWrap.appendChild(tagEl);
      });
      body.appendChild(tagsWrap);
    }

    link.appendChild(imageWrap);
    link.appendChild(body);
    li.appendChild(link);

    return li;
  }

  function renderGames(games) {
    grid.innerHTML = "";

    if (games.length === 0) {
      statusMsg.textContent = "Nenhum jogo encontrado.";
      return;
    }

    statusMsg.textContent = `${games.length} jogo${games.length === 1 ? "" : "s"} encontrado${games.length === 1 ? "" : "s"}.`;

    const fragment = document.createDocumentFragment();
    games.forEach((game) => fragment.appendChild(createGameCard(game)));
    grid.appendChild(fragment);
  }

  function filterGames(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allGames;

    return allGames.filter((game) => {
      const inTitle = game.title.toLowerCase().includes(normalized);
      const inTags =
        Array.isArray(game.tags) &&
        game.tags.some((tag) => tag.toLowerCase().includes(normalized));
      return inTitle || inTags;
    });
  }

  async function loadGames() {
    statusMsg.textContent = "Carregando jogos...";
    try {
      const response = await fetch(GAMES_JSON_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const games = await response.json();

      if (!Array.isArray(games)) {
        throw new Error("Formato inválido em games.json (esperado um array).");
      }

      allGames = games;
      renderGames(allGames);
    } catch (err) {
      console.error("Erro ao carregar games.json:", err);
      statusMsg.textContent =
        "Não foi possível carregar o catálogo de jogos. Verifique data/games.json.";
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      renderGames(filterGames(event.target.value));
    });
  }

  loadGames();

  // ===== Formulário de sugestões =====

  const form = document.getElementById("suggestion-form");
  const feedback = document.getElementById("form-feedback");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitBtn = form.querySelector(".btn-submit");
      const formData = new FormData(form);

      // Honeypot: se o campo escondido foi preenchido, provavelmente é um bot.
      // Finge sucesso sem enviar nada.
      if (formData.get("_gotcha")) {
        form.reset();
        showFeedback("Sugestão enviada. Obrigado!", "success");
        return;
      }

      submitBtn.disabled = true;
      showFeedback("Enviando...", "");

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        if (response.ok) {
          form.reset();
          showFeedback("Sugestão enviada com sucesso. Obrigado!", "success");
        } else {
          const data = await response.json().catch(() => null);
          const message =
            data && data.errors
              ? data.errors.map((e) => e.message).join(", ")
              : "Não foi possível enviar sua sugestão agora.";
          showFeedback(message, "error");
        }
      } catch (err) {
        console.error("Erro ao enviar sugestão:", err);
        showFeedback(
          "Erro de conexão. Tente novamente em instantes.",
          "error"
        );
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = "form-feedback" + (type ? ` ${type}` : "");
  }
})();
