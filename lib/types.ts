export type PublicGame = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  category: string;
  tags: string[];
  featured: boolean;
  gameUrl: string;
};

export type AdminGame = PublicGame & {
  published: boolean;
  coverPath: string;
  coverExternalUrl: string | null;
  gameFilePath: string | null;
  externalGameUrl: string | null;
};
