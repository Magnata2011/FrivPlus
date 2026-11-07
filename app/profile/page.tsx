import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileEditor } from "@/components/profile-editor";
import { getCurrentUserStatus } from "@/lib/admin-auth";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const status = await getCurrentUserStatus();
  if (!status.signedIn) redirect("/login?next=%2Fprofile");

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">F</span>
            <span>FrivPlus</span>
          </Link>
          <div className="admin-actions">
            <Link className="button button-outline button-small" href="/">Voltar ao catálogo</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="wrap profile-page">
        <div className="profile-heading">
          <div className="eyebrow">Sua conta</div>
          <h1>Meu perfil</h1>
          <p>Personalize seu espaço no FrivPlus.</p>
        </div>
        <ProfileEditor />
      </main>
    </>
  );
}
