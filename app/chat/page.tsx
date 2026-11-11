import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatWorkspace, type ChatFriend, type ChatConversation } from "@/components/chat-workspace";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type FriendRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
};

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Chat indisponível</h1>
          <p>Configure a autenticação para conversar com seus amigos.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão para abrir o chat.", authError);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Não foi possível abrir o chat</h1>
          <p role="alert">Tente atualizar a página ou entrar novamente.</p>
          <Link className="button button-primary" href="/login?next=%2Fchat">Entrar</Link>
        </section>
      </main>
    );
  }
  if (!user) redirect("/login?next=%2Fchat");

  const { data, error } = await supabase.rpc("list_accepted_friends");
  if (error) {
    console.error("Não foi possível carregar os amigos do chat.", error);
    return (
      <main className="wrap chat-page">
        <h1>Chat</h1>
        <p className="form-error" role="alert">
          Não foi possível carregar sua lista de amigos. Execute a migration de chat do Supabase.
        </p>
      </main>
    );
  }

  const friends: ChatFriend[] = ((data ?? []) as FriendRow[]).map((friend) => ({
    id: friend.id,
    username: friend.username,
    displayName: friend.display_name || friend.username,
    avatarPath: friend.avatar_path,
    avatarUrl: friend.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(friend.avatar_path).data.publicUrl
      : null,
  }));
  const { data: conversationsData, error: conversationsError } = await supabase.rpc("list_my_chat_conversations");
  if (conversationsError) {
    console.error("Não foi possível carregar as conversas.", conversationsError);
    return (
      <main className="wrap chat-page">
        <h1>Chat</h1>
        <p className="form-error" role="alert">Não foi possível carregar suas conversas.</p>
      </main>
    );
  }

  const conversations: ChatConversation[] = conversationsData ?? [];
  return (
    <main className="wrap chat-page">
      <div className="eyebrow">Seus amigos, sempre por perto</div>
      <h1>Chat</h1>
      <ChatWorkspace friends={friends} initialConversations={conversations} currentUserId={user.id} />
    </main>
  );
}
