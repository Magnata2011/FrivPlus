// FrivPlus: catálogo, busca, filtro por categoria e formulário de sugestões.
(function () {
  "use strict";

  const GAMES_JSON_PATH = "data/games.json";
  const grid = document.getElementById("games-grid");
  const statusMsg = document.getElementById("status-msg");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  let allGames = [];

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
      img.onerror = null;
      img.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="#1b212c"/><text x="50%" y="50%" fill="#9aa1ad" font-family="sans-serif" font-size="16" text-anchor="middle">Capa indisponível</text></svg>`
      );
    };
    imageWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = game.title;
    body.appendChild(title);

    if (Array.isArray(game.tags) && game.tags.length) {
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
    link.append(imageWrap, body);
    li.appendChild(link);
    return li;
  }

  function renderGames(games) {
    grid.replaceChildren();
    if (!games.length) {
      statusMsg.textContent = "Nenhum jogo encontrado. Tente outra busca ou categoria.";
      return;
    }
    statusMsg.textContent = `${games.length} jogo${games.length === 1 ? "" : "s"} encontrado${games.length === 1 ? "" : "s"}.`;
    const fragment = document.createDocumentFragment();
    games.forEach((game) => fragment.appendChild(createGameCard(game)));
    grid.appendChild(fragment);
  }

  function renderCategoryOptions() {
    if (!categoryFilter) return;
    const selected = categoryFilter.value;
    const categories = [...new Set(allGames.flatMap((game) =>
      Array.isArray(game.tags) ? game.tags : []
    ))].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    categoryFilter.replaceChildren(new Option("Todas as categorias", ""));
    categories.forEach((category) => categoryFilter.add(new Option(category, category)));
    if (categories.includes(selected)) categoryFilter.value = selected;
  }

  function getFilteredGames() {
    const query = (searchInput ? searchInput.value : "").trim().toLocaleLowerCase("pt-BR");
    const category = categoryFilter ? categoryFilter.value : "";
    return allGames.filter((game) => {
      const title = String(game.title || "").toLocaleLowerCase("pt-BR");
      const tags = Array.isArray(game.tags) ? game.tags : [];
      const matchesSearch = !query || title.includes(query) || tags.some((tag) =>
        String(tag).toLocaleLowerCase("pt-BR").includes(query)
      );
      const matchesCategory = !category || tags.includes(category);
      return matchesSearch && matchesCategory;
    });
  }

  function renderFilteredGames() {
    renderGames(getFilteredGames());
  }

  async function loadGames() {
    if (statusMsg) statusMsg.textContent = "Carregando jogos...";
    try {
      const response = await fetch(GAMES_JSON_PATH, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const games = await response.json();
      if (!Array.isArray(games)) throw new Error("Formato inválido em games.json: esperado um array.");
      allGames = games.filter((game) => game && typeof game.title === "string" && typeof game.url === "string");
      renderCategoryOptions();
      renderFilteredGames();
    } catch (error) {
      console.error("Erro ao carregar games.json:", error);
      statusMsg.textContent = "Não foi possível carregar o catálogo. Confira se data/games.json existe e se o site está sendo servido por um servidor web.";
    }
  }

  if (searchInput) searchInput.addEventListener("input", renderFilteredGames);
  if (categoryFilter) categoryFilter.addEventListener("change", renderFilteredGames);
  loadGames();

  // ===== Formulário de sugestões =====
  const form = document.getElementById("suggestion-form");
  const feedback = document.getElementById("form-feedback");

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = "form-feedback" + (type ? ` ${type}` : "");
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector(".btn-submit");
      const formData = new FormData(form);
      if (formData.get("_gotcha")) {
        form.reset();
        showFeedback("Sugestão enviada. Obrigado!", "success");
        return;
      }
      if (form.action.includes("SEU_FORM_ID")) {
        showFeedback("Configure o endpoint do Formspree no arquivo index.html antes de enviar sugestões.", "error");
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      showFeedback("Enviando...", "");
      try {
        const response = await fetch(form.action, {
          method: "POST", body: formData, headers: { Accept: "application/json" }
        });
        if (response.ok) {
          form.reset();
          showFeedback("Sugestão enviada com sucesso. Obrigado!", "success");
        } else {
          const data = await response.json().catch(() => null);
          const message = data && data.errors ? data.errors.map((item) => item.message).join(", ") : "Não foi possível enviar sua sugestão agora.";
          showFeedback(message, "error");
        }
      } catch (error) {
        console.error("Erro ao enviar sugestão:", error);
        showFeedback("Erro de conexão. Tente novamente em instantes.", "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();
