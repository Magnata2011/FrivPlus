import Link from "next/link";

export function ProfileSettingsTabs({ active }: { active: "profile" | "delete" }) {
  return (
    <nav className="profile-settings-tabs" aria-label="Configurações do perfil">
      <Link
        href="/profile/edit"
        aria-current={active === "profile" ? "page" : undefined}
      >
        Perfil
      </Link>
      <Link
        className="profile-settings-delete-tab"
        href="/profile/edit/delete"
        aria-current={active === "delete" ? "page" : undefined}
      >
        Excluir conta
      </Link>
    </nav>
  );
}
