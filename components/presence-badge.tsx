"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function PresenceBadge({
  online,
  gameName,
}: {
  online: boolean;
  gameName: string | null;
}) {
  const router = useRouter();
  const label = !online ? "Offline" : gameName ? `Jogando ${gameName}` : "Online";
  const state = !online ? "offline" : gameName ? "playing" : "online";

  useEffect(() => {
    const intervalId = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(intervalId);
  }, [router]);

  return (
    <span className={`presence-badge presence-badge-${state}`} aria-label={label}>
      <span className="presence-badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
