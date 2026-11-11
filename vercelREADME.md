# Configuração do FrivPlus na Vercel

Este guia configura o login e o controle do aviso de manutenção. O e-mail definido em `MAINTENANCE_ADMIN_EMAIL` é o único autorizado a ligar ou desligar o aviso.

## 1. Configure o Supabase

1. Crie ou selecione um projeto em [supabase.com](https://supabase.com/).
2. Em **Authentication → Providers**, habilite o provedor **Email**. Contas são opcionais para visitantes que só querem jogar.
3. Crie uma conta no FrivPlus usando o e-mail que será o administrador e confirme o endereço, caso a confirmação esteja habilitada.
4. No **SQL Editor**, execute em snippets separados e nesta ordem: [`supabase/migrations/20261110000000_site_maintenance.sql`](./supabase/migrations/20261110000000_site_maintenance.sql), [`supabase/migrations/20261111010000_user_profiles.sql`](./supabase/migrations/20261111010000_user_profiles.sql) e [`supabase/migrations/20261111020000_profile_avatars.sql`](./supabase/migrations/20261111020000_profile_avatars.sql). A primeira cria o aviso de manutenção, inicialmente ligado; a segunda configura perfis privados; a terceira cria o armazenamento de avatares.
5. Em **Settings → API Keys** e **Integrations → Data API**, copie a **Project URL**, a chave pública **anon** (ou **publishable**) e a chave secreta **service_role/secret**.
6. Em **Authentication → URL Configuration**, use:
   - **Site URL:** `https://frivplus.vercel.app`
   - **Redirect URLs:** `https://frivplus.vercel.app/auth/callback**` e `http://localhost:3000/auth/callback**` para testes locais.

Substitua os exemplos pelos domínios reais do projeto. Cadastros podem exigir confirmação por e-mail, de acordo com as opções de **Authentication** do Supabase.

### Login com Google (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/), configure a tela de consentimento OAuth e crie uma credencial **OAuth client ID → Web application**.
2. No Supabase, abra **Authentication → Providers → Google**, habilite o provedor e copie o **Callback URL** indicado nessa tela.
3. Cole esse endereço no Google Cloud, em **Authorized redirect URIs**. Ele normalmente tem o formato `https://<project-ref>.supabase.co/auth/v1/callback`; use o valor exato mostrado pelo Supabase.
4. Copie o Google **Client ID** e **Client Secret** para os campos correspondentes do provedor Google no Supabase e salve.
5. Confirme que a URL `https://frivplus.vercel.app/auth/callback**` está na lista **Redirect URLs** do Supabase. O login Google inicia em `/login` e retorna para o perfil ou para o destino solicitado.

Para permitir que a conta Google administre o site, o e-mail dessa conta deve ser o mesmo definido em `MAINTENANCE_ADMIN_EMAIL`.

## 2. Configure as variáveis na Vercel

No projeto da Vercel, abra **Settings → Environment Variables** e adicione:

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anon/publishable do Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL base do site, sem caminho; por exemplo `https://SEU-PROJETO.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta service_role/secret do Supabase |
| `MAINTENANCE_ADMIN_EMAIL` | E-mail exato usado para entrar como administrador |

Marque **Production** e, se necessário, **Preview** e **Development** para cada variável. `NEXT_PUBLIC_SITE_URL` deve corresponder ao ambiente para que links de confirmação sejam enviados ao domínio correto.

> **Segurança:** `SUPABASE_SERVICE_ROLE_KEY` ignora as políticas de acesso do banco. Cadastre-a apenas como variável de ambiente da Vercel, nunca com prefixo `NEXT_PUBLIC_`, no código, ou em arquivos enviados ao Git. Não compartilhe essa chave.

## 3. Publique e confirme a configuração

1. Salve as variáveis e faça um novo deploy na Vercel (ou use **Redeploy** no último deployment).
2. Abra `https://SEU-DOMINIO/login`, entre com a conta que usa o e-mail configurado em `MAINTENANCE_ADMIN_EMAIL` e confirme o cadastro pelo e-mail, se solicitado.
3. Na página inicial, o administrador verá **Desligar aviso de manutenção** ou **Ligar aviso de manutenção**. O controle fica disponível tanto no cartaz quanto no cabeçalho, dependendo do estado atual.
4. Teste o botão e atualize a página: o estado continua salvo no Supabase, inclusive após um novo deploy.
5. Abra `/admin` para ver o painel com o estado do aviso e atalhos administrativos.

Usuários com outros e-mails não veem o controle e não podem alterar a configuração. A variável só identifica o administrador; ela não cria uma conta automaticamente. Crie e confirme essa conta pelo fluxo normal de cadastro.

Com o aviso ligado, visitantes ainda podem clicar em **Continuar mesmo assim** para abrir o catálogo. Isso não altera o estado global do aviso.

## Perfis e e-mails

A migration de perfis cria automaticamente um perfil privado para cada nova conta e preenche perfis de contas que já existiam. Cada pessoa pode alterar apenas o próprio nome de exibição, nome de usuário (único, sem diferenciar maiúsculas de minúsculas) e biografia. A API e as políticas RLS do Supabase restringem a leitura e edição ao dono da conta.

O e-mail e o estado de confirmação são lidos diretamente da conta autenticada do Supabase Auth; não são copiados para uma tabela pública de perfis. Assim, o e-mail usado para entrar e o e-mail confirmado são a fonte autoritativa para a conta e para a autorização do responsável pela manutenção.

Avatares ficam em um bucket público, com uploads limitados a PNG/JPG/WebP de até 3 MB e restritos ao próprio usuário.

## Salvamentos de progresso

`lib/game-progress.ts` fornece uma base local: dados serializados de até 100 KiB vão para localStorage; dados maiores usam IndexedDB. A integração de cada jogo deve carregar seu estado com `loadGameProgress` e chamar `schedule` do `createGameProgressAutoSave` quando o progresso mudar. Esses salvamentos ficam no navegador atual e não sincronizam entre dispositivos. O módulo não consegue salvar automaticamente jogos externos/embutidos sem que o próprio jogo seja integrado.

## Teste local

Copie `.env.example` para `.env.local`, preencha os mesmos valores do Supabase, use `NEXT_PUBLIC_SITE_URL=http://localhost:3000` e inicie com `npm run dev`. Execute as três migrations no Supabase antes de testar. Sem configuração do Supabase, o cartaz permanece ligado e o controle não pode salvar alterações.
