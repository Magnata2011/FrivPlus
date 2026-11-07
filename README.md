# FrivPlus

Catálogo público de jogos. A lista e os dados dos cards ficam em `data/games.json`; os arquivos dos jogos são servidos pelo GitHub Pages na pasta `games/`.

## Desenvolvimento

- Requer Node.js 20.9 ou superior e npm.
- `npm install` — instala as dependências.
- `npm run dev` — inicia o app local em `http://localhost:3000`.
- `npm run lint` — executa o ESLint.
- `npm run build` — gera o build de produção.

Não é necessário configurar banco de dados ou variáveis de ambiente.

## Publicação

O app Next.js é publicado na Vercel. Os jogos continuam no GitHub Pages em `https://magnata2011.github.io/FrivPlus/`; mantenha a pasta `games/` no repositório para que os links do catálogo funcionem.
