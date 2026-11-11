"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SearchProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function CatalogSearch() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const normalizedQuery = query.trim().replace(/^@/, "");

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setProfiles([]);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        const result = await response.json() as { profiles?: SearchProfile[]; error?: string };
        if (!response.ok || !result.profiles) {
          setError(result.error ?? "Não foi possível pesquisar perfis.");
          setProfiles([]);
          return;
        }
        setProfiles(result.profiles);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("Erro de conexão ao pesquisar perfis.");
        setProfiles([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [normalizedQuery]);

  const showResults = normalizedQuery.length >= 2;

  return (
    <div className="catalog-search-wrap">
      <label className="sr-only" htmlFor="catalog-search">Buscar jogos ou perfis</label>
      <input
        className="search-input"
        id="catalog-search"
        type="search"
        value={query}
        placeholder="Buscar jogo ou perfil..."
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />
      {showResults && (
        <div className="profile-search-results" id="profile-search-results">
          <div className="profile-search-heading">Perfis</div>
          {loading && <p className="profile-search-message" role="status">Buscando perfis...</p>}
          {!loading && error && <p className="profile-search-message form-error" role="alert">{error}</p>}
          {!loading && !error && profiles.length === 0 && (
            <p className="profile-search-message">Nenhum perfil encontrado.</p>
          )}
          {!loading && !error && profiles.length > 0 && (
            <ul>
              {profiles.map((profile) => (
                <li key={profile.username}>
                  <Link
                    className="profile-search-result"
                    href={`/u/${encodeURIComponent(profile.username)}`}
                  >
                    {profile.avatarUrl ? (
                      <span
                        className="profile-search-avatar profile-search-avatar-image"
                        role="img"
                        aria-label={`Foto de ${profile.displayName}`}
                        style={{ backgroundImage: `url("${profile.avatarUrl}")` }}
                      />
                    ) : (
                      <span className="profile-search-avatar" aria-hidden="true">
                        {profile.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="profile-search-identity">
                      <strong>{profile.displayName}</strong>
                      <span>@{profile.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
