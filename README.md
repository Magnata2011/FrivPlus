# FrivPlus

Catálogo público de jogos. As contas são opcionais; é possível abrir os jogos sem fazer login. Os dados dos cards ficam em `data/games.json`; o Undertale é servido pelo GitHub Pages e o Deltarune usa a publicação original do projeto.

## Desenvolvimento

- Requer Node.js 20.9 ou superior e npm.
- `npm install` — instala as dependências.
- `npm run dev` — inicia o app local em `http://localhost:3000`.
- `npm run lint` — executa o ESLint.
- `npm run build` — gera o build de produção.

### Autenticação

1. Configure um projeto Supabase e habilite autenticação por e-mail e senha. O login com Google também pode ser habilitado seguindo [vercelREADME.md](./vercelREADME.md).
2. Execute `supabase/migrations/20261110000000_site_maintenance.sql` no SQL Editor do Supabase.
3. Execute também `supabase/migrations/20261111010000_user_profiles.sql` para criar perfis privados automaticamente quando novas contas forem cadastradas.
4. Execute `supabase/migrations/20261111020000_profile_avatars.sql` para habilitar fotos de perfil.
5. Execute `supabase/migrations/20261111030000_profile_theme.sql` para habilitar a preferência de tema por conta.
6. Execute `supabase/migrations/20261111040000_public_profile_search_and_banners.sql` para habilitar banners e busca pública de perfis.
7. Execute `supabase/migrations/20261111050000_account_deletion_and_friendships.sql` para habilitar exclusão de conta e solicitações de amizade.
8. Execute `supabase/migrations/20261111060000_chat_and_changelogs.sql` para habilitar mensagens privadas, grupos, envio de imagens e changelogs públicos.
9. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase, `NEXT_PUBLIC_SITE_URL` e `MAINTENANCE_ADMIN_EMAIL` com o e-mail da conta autorizada.
10. No Supabase, defina a URL do site e permita os callbacks `http://localhost:3000/auth/callback**` e `https://SEU-DOMINIO/auth/callback**`.
11. Configure as mesmas variáveis no ambiente de produção da Vercel. `SUPABASE_SERVICE_ROLE_KEY` é usada somente no servidor para controles administrativos, publicação de changelogs e exclusão segura de contas; nunca a exponha no navegador.

O cadastro pode exigir confirmação por e-mail, conforme a configuração do Supabase. A chave `SUPABASE_SERVICE_ROLE_KEY` é necessária somente no servidor para salvar configurações administrativas e excluir contas; nunca deve ser exposta no navegador.

Depois de entrar com o e-mail autorizado, use o botão de manutenção no cartaz ou no cabeçalho para ligar/desligar o aviso. O estado fica salvo no Supabase.

Quando a manutenção estiver ligada, qualquer visitante pode escolher **Continuar mesmo assim** para abrir o catálogo; isso não desliga o aviso para os demais. O acesso às contas continua opcional.

## Avatares e salvamento de progresso

A migration de avatares cria um bucket público para imagens de perfil. Somente o usuário autenticado pode enviar ou substituir seu próprio avatar; são aceitos PNG, JPG e WebP de até 3 MB. Antes do envio, a pessoa pode pré-visualizar a foto, arrastá-la e ajustar o zoom para escolher o recorte circular.

A migration `20261111040000_public_profile_search_and_banners.sql` cria um bucket público de banners (PNG, JPG ou WebP, até 5 MB) e funções RPC que expõem somente nome, usuário, bio e caminhos das imagens públicas dos perfis com usuário definido. Execute essa migration no Supabase antes de usar o envio de banner ou a busca pública de perfis.

A migration `20261111050000_account_deletion_and_friendships.sql` habilita solicitações de amizade nos perfis públicos. Uma solicitação recebida pode ser aceita pelo mesmo botão.

A migration `20261111060000_chat_and_changelogs.sql` habilita conversas privadas com amizades aceitas, grupos de até 20 participantes e imagens privadas de até 5 MB. No painel administrativo, o responsável pode publicar changelogs com título e mensagem; eles aparecem na página inicial e podem ser dispensados pelo visitante. A publicação administrativa e a exclusão de conta exigem `SUPABASE_SERVICE_ROLE_KEY` configurada no servidor.

O módulo `lib/game-progress.ts` prepara salvamentos locais usando localStorage para dados pequenos e IndexedDB para dados maiores, com um controlador de autosave que jogos podem chamar após mudanças no progresso. A integração de um jogo deve carregar seu estado com `loadGameProgress` e chamar `schedule` do `createGameProgressAutoSave` quando o progresso mudar. Isso ainda não integra os jogos automaticamente nem sincroniza progresso entre dispositivos: cada jogo precisa chamar a API de salvamento. Jogos abertos em outros domínios também não podem ser acessados pelo FrivPlus sem integração explícita deles.

## Publicação

O app Next.js é publicado na Vercel. O Undertale e os jogos legados ficam no GitHub Pages em `https://magnata2011.github.io/FrivPlus/`. O diretório local do Deltarune é excluído da publicação por ultrapassar o limite do CDN usado por essa cópia; o catálogo abre a publicação funcional em `https://byalvaro19.github.io/deltarune/`.

Para configurar a autenticação e o controle de manutenção na Vercel, siga [vercelREADME.md](./vercelREADME.md).
