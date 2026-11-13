import { notFound, redirect } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { catalogGames } from "@/lib/catalog-games";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = catalogGames.find((item) => item.id === gameId);

  if (!game) notFound();
  if (game.openExternal) redirect(game.gameUrl);

  return (
    <main className="wrap">
      <GamePlayer game={game} />
    </main>
  );
}
