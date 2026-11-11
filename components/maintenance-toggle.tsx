"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MaintenanceToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function toggleMaintenance() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível atualizar o aviso.");
        return;
      }

      router.refresh();
    } catch {
      setError("Erro de conexão ao atualizar o aviso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="maintenance-control">
      <button
        className="button button-outline"
        disabled={loading}
        onClick={toggleMaintenance}
        type="button"
      >
        {loading
          ? "Salvando..."
          : enabled
            ? "Desligar aviso de manutenção"
            : "Ligar aviso de manutenção"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
