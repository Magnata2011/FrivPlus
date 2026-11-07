# FrivPlus

Catálogo de jogos com painel administrativo protegido por Supabase Auth. A interface pública mantém os jogos legados de `data/games.json` e acrescenta os jogos publicados no banco.

## Requisitos

- Node.js 20.9 ou superior e npm.
- Projeto Supabase com Auth e Storage.
- Projeto conectado à Vercel para publicação.

## Configuração local

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local`.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` com os valores do projeto Supabase. `NEXT_PUBLIC_LEGACY_GAMES_BASE_URL` já aponta para a raiz pública dos jogos no GitHub Pages. A chave `service_role` é exclusivamente server-side; nunca use um prefixo `NEXT_PUBLIC_` nela.
4. Configure `FRIV_ADMIN_EMAIL_1` e `FRIV_ADMIN_EMAIL_2` com os dois e-mails autorizados. Esses valores são lidos apenas pelo servidor.
5. Aplique as migrations `supabase/migrations/20261107000000_game_admin.sql`, `supabase/migrations/20261107010000_game_custom_ids_and_cover_urls.sql` e `supabase/migrations/20261107020000_user_profiles.sql` pelo Supabase CLI (`supabase db push`) ou pelo SQL Editor, nesta ordem.
6. Crie no Supabase Auth as contas dos dois administradores, usando os e-mails definidos nas variáveis privadas. O cadastro público cria contas comuns, sem privilégios administrativos.
7. Para habilitar Google, configure o provedor Google em **Supabase → Authentication → Providers** e adicione `http://localhost:3000/auth/callback` (e o domínio de produção seguido de `/auth/callback`) à lista de URLs de redirecionamento do Supabase. Credenciais OAuth do Google são configuradas no painel Supabase, nunca no navegador.
8. Execute `npm run dev` e acesse `http://localhost:3000`.

O painel fica em `/admin`. Usuários autenticados que não correspondam a um dos e-mails autorizados recebem acesso negado. A comparação do e-mail usa `trim()` e ignora diferenças entre maiúsculas e minúsculas.
Na página inicial, a pessoa não autenticada vê **Entrar**. Após autenticação, somente os e-mails administrativos autorizados veem **Adicionar jogo**, com campos para ID, nome, link HTTPS da capa, tags e link HTTPS do jogo. O cadastro rápido publica o jogo diretamente. A rota de gravação verifica novamente a identidade e a autorização no servidor.

O formulário de entrada também oferece **Criar conta** e **Entrar com Google**. A disponibilidade destes recursos depende da configuração de cadastro e do provedor Google no Supabase Auth.

## Hospedagem do app e dos jogos

O app Next.js deve ser publicado na Vercel. Os arquivos grandes dos jogos continuam na pasta `games/` do GitHub Pages e não são copiados para a implantação da Vercel. `NEXT_PUBLIC_LEGACY_GAMES_BASE_URL` aponta para a raiz pública dos jogos e, por padrão, usa `https://magnata2011.github.io/FrivPlus/`. Se o endereço do GitHub Pages mudar, atualize essa variável na Vercel.

Não redirecione a página inicial do GitHub Pages para uma URL de preview protegida da Vercel. Faça a troca somente depois que existir um domínio de produção público e o app estiver configurado; mantenha a pasta `games/` no GitHub Pages para que os links dos jogos continuem funcionando.

## Perfis de usuário

Usuários autenticados podem acessar `/profile` para definir nome de exibição, nome de usuário único, biografia, foto e banner. As imagens aceitas são JPEG, PNG e WebP, com verificação de formato e tamanho no servidor (foto até 2 MB, banner até 2,5 MB, envio combinado até 3,5 MB). O bucket é privado e as políticas RLS restringem cada registro e arquivo ao seu proprietário. O perfil é privado na versão atual; uma página pública de perfil pode ser acrescentada separadamente.

## Viabilidade de salvar progresso dos jogos existentes

O catálogo tem 17 jogos. A verificação foi feita nos pontos de entrada e runtimes existentes no repositório, procurando APIs de armazenamento do navegador e dos runtimes WebAssembly. Isso identifica mecanismos locais, mas não garante por si só compatibilidade de sincronização por conta; cada jogo precisa de uma ponte específica, teste de conflito e validação de origem.

| Jogos | Evidência encontrada | Viabilidade de sincronizar progresso do jogo com a conta |
| --- | --- | --- |
| Sonic Mania | O HTML inicial monta `IDBFS` em `/saves`, chama `FS.syncfs` e copia `SaveData.bin`. | Alta para uma integração específica com o runtime e seus arquivos de save. |
| Plants vs. Zombies | O HTML monta `IDBFS` em `/saves` e sincroniza o filesystem periodicamente. | Alta para integração específica com IDBFS, após confirmar os nomes e formato dos arquivos de progresso. |
| Celeste | O bundle usa `localStorage` para dados do jogo e também expõe acesso a saves via filesystem .NET/IDBFS e funções de exportação. | Alta, mas requer escolher/implementar uma ponte para o formato de save correto. |
| Half-Life 2 | O HTML substitui `FS.syncfs` no runtime. | Possível; o shim observado precisa ser investigado e um formato de save validado antes de sincronizar. |
| Hollow Knight | O HTML usa IndexedDB para armazenar recursos/cache do jogo. | Não confirmado para progresso: o IndexedDB observado salva recursos do jogo; não basta para concluir que os saves estão nessa base. |
| Minecraft | O jogo é um bundle web grande/minificado; nenhum mecanismo de save compatível com conta foi confirmado no ponto de entrada. | Indeterminada; requer inspecionar o runtime e identificar formato e API de mundos locais. |
| Cuphead, Plague Inc, Mario 64, FNAF 1–4, Pizzeria Simulator, UCN, Sister Location e Bendy | Nenhuma API de save sincronizável foi confirmada nos pontos de entrada inspecionados. Mario 64 também informa que IDBFS não está incluído naquele build. | Não oferecer sincronização automática sem adaptar/testar cada runtime; “não detectado” não prova que o jogo não salva localmente. |

O salvamento na conta não está ativado por enquanto. Não é seguro copiar todo o `localStorage` ou IndexedDB do domínio: os bancos podem misturar cache e configurações com saves, conter formatos binários grandes ou variar entre builds. A próxima etapa recomendada é integrar e testar primeiro os jogos com sinal claro de `IDBFS`/arquivos de save (Sonic Mania, Plants vs. Zombies e Celeste) com exportação/importação isolada, armazenamento por usuário e proteção contra substituir um progresso mais novo por um antigo.

## Variáveis na Vercel

No projeto da Vercel, abra **Settings → Environment Variables** e cadastre:

| Nome | Uso | Exposição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto Supabase | Navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública/anon do Supabase | Navegador |
| `NEXT_PUBLIC_LEGACY_GAMES_BASE_URL` | Raiz pública da pasta `games/` no GitHub Pages | Navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações administrativas do servidor | **Privada** |
| `FRIV_ADMIN_EMAIL_1` | Primeiro e-mail autorizado | **Privada** |
| `FRIV_ADMIN_EMAIL_2` | Segundo e-mail autorizado | **Privada** |

Adicione as duas variáveis `FRIV_ADMIN_EMAIL_*` manualmente na Vercel para cada ambiente de implantação necessário (Production, Preview e/ou Development). Não coloque os e-mails reais no `.env.example`, no código, em arquivos públicos ou em logs. Depois de salvar as variáveis, faça um novo deploy para aplicá-las.

O `.env.example` contém somente os nomes, sem valores. A `SUPABASE_SERVICE_ROLE_KEY` não deve ser compartilhada nem adicionada a variáveis públicas.

## Segurança e armazenamento

- `/admin` valida a sessão no servidor; cada rota `/api/admin/*` autentica novamente o usuário no Supabase Auth e compara seu e-mail com a lista privada do servidor.
- O `service_role` é carregado apenas por módulos `server-only` e só é usado após essa autorização.
- Não há função ou coluna de perfil que permita ao usuário promover a própria conta.
- A RLS permite a leitura pública somente de jogos publicados. Usuários autenticados não recebem permissões de escrita.
- O bucket privado `game-assets` só permite leitura de arquivos vinculados a jogos publicados. Não há políticas de escrita para usuários comuns; uploads e exclusões passam pelas rotas server-side autorizadas.
- Imagens aceitas: JPEG, PNG e WebP, até 1 MB, com validação da assinatura do conteúdo. Jogos aceitos: HTML, até 2,5 MB. O envio combinado é limitado a 3,5 MB para caber no limite de requisição da Vercel.
- HTML de jogos e URLs externas são exibidos em um `iframe` com sandbox e sem acesso à origem do painel.

## Comandos

- `npm run dev` — servidor local.
- `npm run build` — build de produção.
- `npm start` — servidor de produção local.
