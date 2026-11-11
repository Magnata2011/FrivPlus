import games from "@/data/games.json";

const LEGACY_GAMES_BASE_URL = "https://magnata2011.github.io/FrivPlus/";

export const catalogGames = games.map((game) => ({
  id: game.id,
  title: game.title,
  coverUrl: game.cardImage,
  category: game.tags[0] ?? "Jogos",
  tags: game.tags,
  gameUrl: new URL(game.url, LEGACY_GAMES_BASE_URL).toString(),
}));
