"use client";

import { useState, type FormEvent } from "react";
import { LogoutButton } from "@/components/logout-button";

export function DeleteAccountForm({ username }: { username: string | null }) {
  const confirmationUsername = `@${username ?? "sem_usuario"}`;
  const [typedUsername, setTypedUsername] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!confirmed || typedUsername !== confirmationUsername) {
      setError("Confirme a exclusão e digite exatamente o nome de usuário acima.");
      return;
    }
    if (!window.confirm("Tem certeza? A exclusão da conta é permanente e não pode ser desfeita.")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: typedUsername, confirmed }),
      });
      const result = await response.json() as { deleted?: boolean; cleanupWarning?: boolean; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fprofile%2Fedit%2Fdelete");
        return;
      }
      if (!response.ok || !result.deleted) {
        setError(result.error ?? "Não foi possível excluir sua conta.");
        return;
      }
      if (result.cleanupWarning) {
        window.alert("A conta foi excluída, mas alguns arquivos públicos não puderam ser removidos automaticamente.");
      }
      window.location.assign("/");
    } catch {
      setError("Erro de conexão ao solicitar a exclusão da conta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="delete-account-panel" aria-labelledby="delete-account-title">
      <div className="eyebrow delete-account-eyebrow">Zona de perigo</div>
      <h2 id="delete-account-title">Excluir conta permanentemente</h2>
      <p>
        Esta ação remove sua conta, seu perfil e seu acesso ao FrivPlus. Ela não pode ser desfeita.
        Suas solicitações e amizades também serão removidas.
      </p>
      {!username && (
        <p className="delete-account-warning">
          Esta conta não tem nome de usuário. Para confirmar, digite <strong>@sem_usuario</strong>.
        </p>
      )}
      <form className="delete-account-form" onSubmit={submit}>
        <label className="delete-account-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Entendo que a exclusão é permanente.
        </label>
        <label className="label" htmlFor="delete-account-username">
          Digite este nome de usuário para confirmar:
          <strong className="delete-account-username">{confirmationUsername}</strong>
          <input
            className="field-input"
            id="delete-account-username"
            autoComplete="off"
            spellCheck={false}
            value={typedUsername}
            onChange={(event) => setTypedUsername(event.target.value)}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="delete-account-logout">
          <div>
            <strong>Não quer excluir sua conta?</strong>
            <span>Você pode apenas sair e voltar quando quiser.</span>
          </div>
          <LogoutButton />
        </div>
        <button
          className="button button-danger-bright"
          type="submit"
          disabled={deleting || !confirmed || typedUsername !== confirmationUsername}
        >
          {deleting ? "Excluindo conta..." : "Excluir conta permanentemente"}
        </button>
      </form>
    </section>
  );
}
