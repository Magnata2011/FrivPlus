"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { AdminGame } from "@/lib/types";

type GameResponse = { games?: AdminGame[]; game?: AdminGame; error?: string; warning?: string };

export function AdminDashboard() {
  const [games, setGames] = useState<AdminGame[]>([]);
  const [query, setQuery] = useState("");
  const [activeGame, setActiveGame] = useState<AdminGame | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/games", { cache: "no-store" });
      const result = (await response.json()) as GameResponse;
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fadmin");
        return;
      }
      if (!response.ok) {
        setError(result.error ?? "Não foi possível carregar os jogos.");
        return;
      }
      setGames(result.games ?? []);
    } catch {
      setError("Erro de conexão ao carregar os jogos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadGames(); }, [loadGames]);

  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return games;
    return games.filter((game) =>
      [game.title, game.category, ...game.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [games, query]);

  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) window.location.assign("/");
      else setError("Não foi possível encerrar a sessão.");
    } catch {
      setError("Erro de conexão ao encerrar a sessão.");
    }
  }

  async function deleteGame(game: AdminGame) {
    if (!window.confirm(`Excluir "${game.title}"? Esta ação não pode ser desfeita.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/games/${game.id}`, { method: "DELETE" });
      const result = (await response.json()) as GameResponse;
      if (!response.ok) {
        setError(result.error ?? "Não foi possível excluir o jogo.");
        return;
      }
      setNotice(result.warning ?? "Jogo excluído.");
      await loadGames();
    } catch {
      setError("Erro de conexão ao excluir o jogo.");
    }
  }

  async function saveGame(form: FormData, game: AdminGame | null) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        game ? `/api/admin/games/${game.id}` : "/api/admin/games",
        { method: game ? "PATCH" : "POST", body: form },
      );
      const result = (await response.json()) as GameResponse;
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fadmin");
        return;
      }
      if (!response.ok) {
        setError(result.error ?? "Não foi possível salvar o jogo.");
        return;
      }
      setActiveGame(undefined);
      setNotice(result.warning ?? (game ? "Jogo atualizado." : "Jogo adicionado."));
      await loadGames();
    } catch {
      setError("Erro de conexão ao salvar o jogo.");
    }
  }

  const publishedCount = games.filter((game) => game.published).length;
  const draftCount = games.length - publishedCount;

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">F</span>
            <span>FrivPlus <span className="field-hint">/ Administração</span></span>
          </Link>
          <div className="admin-actions">
            <Link className="button button-outline button-small" href="/">Ver catálogo</Link>
            <button className="button button-small" onClick={signOut} type="button">Sair</button>
          </div>
        </div>
      </header>
      <main className="wrap admin-shell">
        <div className="admin-top">
          <div>
            <div className="eyebrow">Painel administrativo</div>
            <h1>Gerenciar jogos</h1>
            <p>Cadastre, edite e publique jogos no catálogo.</p>
          </div>
          <button className="button button-primary" onClick={() => setActiveGame(null)} type="button">
            <span aria-hidden="true">＋</span> Adicionar jogo
          </button>
        </div>

        <section className="stat-grid" aria-label="Resumo do catálogo">
          <div className="stat-card"><span>Total de jogos</span><strong>{games.length}</strong></div>
          <div className="stat-card"><span>Publicados</span><strong>{publishedCount}</strong></div>
          <div className="stat-card"><span>Rascunhos</span><strong>{draftCount}</strong></div>
        </section>

        {notice && <p className="notice admin-message" role="status">{notice}</p>}
        {error && <p className="form-error admin-message" role="alert">{error}</p>}

        <section className="admin-list" aria-label="Jogos cadastrados">
          <div className="admin-tools">
            <label className="sr-only" htmlFor="admin-search">Pesquisar jogos</label>
            <input
              className="search-input"
              id="admin-search"
              type="search"
              placeholder="Pesquisar jogos..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="button button-outline button-small" onClick={() => void loadGames()} type="button">
              Atualizar lista
            </button>
          </div>
          <div className="admin-list-head" aria-hidden="true">
            <span>Jogo</span><span>Categoria</span><span>Status</span><span>Ações</span>
          </div>
          {loading ? (
            <p className="empty-state">Carregando jogos...</p>
          ) : visibleGames.length === 0 ? (
            <p className="empty-state">
              {games.length ? "Nenhum jogo corresponde à pesquisa." : "Ainda não há jogos cadastrados."}
            </p>
          ) : visibleGames.map((game) => (
            <div className="admin-row" key={game.id}>
              <div className="admin-game">
                <img className="admin-thumb" src={game.coverUrl} alt="" />
                <div>
                  <div className="admin-game-name">{game.title}</div>
                  <div className="admin-game-description">{game.description || "Sem descrição"}</div>
                </div>
              </div>
              <span>{game.category}</span>
              <span className={`status-pill${game.published ? " status-live" : ""}`}>
                {game.published ? "Publicado" : "Rascunho"}
              </span>
              <div className="row-actions">
                <button className="button button-outline button-small" onClick={() => setActiveGame(game)} type="button">
                  Editar
                </button>
                <button className="button button-danger button-small" onClick={() => void deleteGame(game)} type="button">
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
      {activeGame !== undefined && (
        <GameForm
          game={activeGame}
          onClose={() => setActiveGame(undefined)}
          onSave={saveGame}
        />
      )}
    </>
  );
}

function GameForm({
  game,
  onClose,
  onSave,
}: {
  game: AdminGame | null;
  onClose: () => void;
  onSave: (form: FormData, game: AdminGame | null) => Promise<void>;
}) {
  const [cover, setCover] = useState<File | null>(null);
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(game?.coverUrl ?? "");
  const [gamePreview, setGamePreview] = useState(game?.gameUrl ?? "");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cover) return;
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  useEffect(() => {
    if (!gameFile) return;
    const url = URL.createObjectURL(gameFile);
    setGamePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [gameFile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    if (cover) form.set("cover", cover);
    if (gameFile) form.set("gameFile", gameFile);
    form.set("featured", String(form.get("featured") === "on"));
    form.set("published", String(form.get("published") === "on"));
    if (!game && !cover) {
      setError("Selecione uma imagem de capa.");
      return;
    }
    if (!game && !gameFile && !String(form.get("gameUrl") ?? "").trim()) {
      setError("Envie um arquivo HTML ou uma URL HTTPS para o jogo.");
      return;
    }
    setSaving(true);
    await onSave(form, game);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-form-title">
        <div className="modal-heading">
          <div>
            <div className="eyebrow">{game ? "Editar cadastro" : "Novo cadastro"}</div>
            <h2 id="game-form-title">{game ? "Editar jogo" : "Adicionar jogo"}</h2>
          </div>
          <button className="button button-outline button-small" onClick={onClose} type="button" aria-label="Fechar">
            Fechar
          </button>
        </div>
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <label className="label">
              Nome do jogo *
              <input className="field-input" name="title" defaultValue={game?.title} maxLength={100} required />
            </label>
            <label className="label">
              Categoria *
              <input className="field-input" name="category" defaultValue={game?.category} maxLength={50} required />
            </label>
            <label className="label full-width">
              Descrição
              <textarea className="field-textarea" name="description" defaultValue={game?.description} maxLength={1500} />
            </label>
            <label className="label full-width">
              Tags <span className="field-hint">Separe as tags por vírgula (até 10).</span>
              <input className="field-input" name="tags" defaultValue={game?.tags.join(", ")} maxLength={310} />
            </label>
            <label className="label full-width">
              Imagem de capa {game ? "(opcional para manter a atual)" : "*"}
              <input
                className="file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setCover(event.target.files?.[0] ?? null)}
                required={!game}
              />
              <span className="field-hint">JPEG, PNG ou WebP · máximo 1 MB</span>
              <input type="hidden" name="coverUrl" value={game?.coverExternalUrl ?? ""} />
              {coverPreview && <img className="admin-thumb" src={coverPreview} alt="Prévia da capa" />}
            </label>
            <label className="label full-width">
              Arquivo HTML do jogo (opcional)
              <input
                className="file-input"
                type="file"
                accept=".html,.htm,text/html"
                onChange={(event) => setGameFile(event.target.files?.[0] ?? null)}
              />
              <span className="field-hint">HTML · máximo 2,5 MB. Se enviar um arquivo, ele substitui a URL atual.</span>
            </label>
            <label className="label full-width">
              Ou URL HTTPS de hospedagem
              <input
                className="field-input"
                type="url"
                name="gameUrl"
                placeholder="https://..."
                defaultValue={game?.externalGameUrl ?? ""}
                onChange={(event) => {
                  if (event.target.value) {
                    setGameFile(null);
                    setGamePreview(event.target.value);
                  } else {
                    setGamePreview(game?.gameUrl ?? "");
                  }
                }}
              />
            </label>
            <div className="checkbox-row full-width">
              <label className="checkbox-label">
                <input type="checkbox" name="featured" defaultChecked={game?.featured} />
                Destacar jogo
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="published" defaultChecked={game?.published} />
                Publicar agora
              </label>
            </div>
            {gamePreview && (
              <div className="preview-box full-width">
                <button
                  className="button button-outline button-small"
                  onClick={() => setPreviewVisible((visible) => !visible)}
                  type="button"
                >
                  {previewVisible ? "Ocultar prévia" : "Visualizar antes de publicar"}
                </button>
                {previewVisible && (
                  <iframe
                    className="preview-frame"
                    src={gamePreview}
                    title="Prévia do jogo"
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            )}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-footer">
            <span className="field-hint">Arquivos: até 3,5 MB no total.</span>
            <div className="modal-footer-actions">
              <button className="button button-outline" onClick={onClose} type="button">Cancelar</button>
              <button className="button button-primary" disabled={saving} type="submit">
                {saving ? "Salvando..." : game ? "Salvar alterações" : "Salvar jogo"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
