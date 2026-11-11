# Configuração do FrivPlus na Vercel

Este guia configura o login e o controle do aviso de manutenção. O e-mail definido em `MAINTENANCE_ADMIN_EMAIL` é o único autorizado a ligar ou desligar o aviso.

## 1. Configure o Supabase

1. Crie ou selecione um projeto em [supabase.com](https://supabase.com/).
2. Em **Authentication → Providers**, habilite o provedor **Email**.
3. Crie uma conta no FrivPlus usando o e-mail que será o administrador e confirme o endereço, caso a confirmação esteja habilitada.
4. Abra **SQL Editor**, crie uma consulta e execute [`supabase/migrations/20261110000000_site_maintenance.sql`](./supabase/migrations/20261110000000_site_maintenance.sql) e [`supabase/migrations/20261111010000_user_profiles.sql`](./supabase/migrations/20261111010000_user_profiles.sql). A primeira cria o aviso de manutenção, inicialmente ligado; a segunda cria perfis privados para as contas.
5. Em **Project Settings → API**, copie a **Project URL**, a chave pública **anon** (ou **publishable**, se disponível) e a chave secreta **service_role/secret**.
6. Em **Authentication → URL Configuration**, defina a URL principal do site e adicione à lista de redirecionamentos:
   - `http://localhost:3000/auth/callback`
   - `https://SEU-PROJETO.vercel.app/auth/callback`
   - `https://SEU-DOMINIO-PROPRIO/auth/callback`, se usar domínio próprio.

Substitua os exemplos pelos domínios reais do projeto. Cadastros podem exigir confirmação por e-mail, de acordo com as opções de **Authentication** do Supabase.

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

Usuários com outros e-mails não veem o controle e não podem alterar a configuração. A variável só identifica o administrador; ela não cria uma conta automaticamente. Crie e confirme essa conta pelo fluxo normal de cadastro.

## Perfis e e-mails

A migration de perfis cria automaticamente um perfil privado para cada nova conta e preenche perfis de contas que já existiam. Cada pessoa pode alterar apenas o próprio nome de exibição, nome de usuário (único, sem diferenciar maiúsculas de minúsculas) e biografia. A API e as políticas RLS do Supabase restringem a leitura e edição ao dono da conta.

O e-mail e o estado de confirmação são lidos diretamente da conta autenticada do Supabase Auth; não são copiados para uma tabela pública de perfis. Assim, o e-mail usado para entrar e o e-mail confirmado são a fonte autoritativa para a conta e para a autorização do responsável pela manutenção.

## Teste local

Copie `.env.example` para `.env.local`, preencha os mesmos valores do Supabase, use `NEXT_PUBLIC_SITE_URL=http://localhost:3000` e inicie com `npm run dev`. Execute as duas migrations no Supabase antes de testar. Sem configuração do Supabase, o cartaz permanece ligado e o controle não pode salvar alterações.
