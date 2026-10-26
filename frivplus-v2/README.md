# FrivPlus V2

Nova versão do FrivPlus, criada separadamente do site atual para não sobrescrever arquivos existentes.

## Stack
- Next.js (App Router) + TypeScript
- Vercel para hospedagem
- Supabase Auth, Postgres e Storage
- GitHub para versionamento

## Começar localmente
1. Instale Node.js LTS.
2. Entre na pasta `frivplus-v2`.
3. Execute `npm install`.
4. Copie `.env.example` para `.env.local` e preencha as credenciais do projeto Supabase.
5. Execute `npm run dev`.

## Configuração do Supabase
1. Crie um projeto Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Crie os buckets de Storage descritos abaixo.
4. Configure as variáveis de ambiente no Vercel.

Variáveis necessárias:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Nunca coloque a chave `service_role` no navegador, no GitHub ou em variáveis `NEXT_PUBLIC_*`.

## Armazenamento de jogos
O catálogo aceita jogos hospedados no Storage e jogos incorporados por URL externa. Use apenas jogos que você tenha autorização para hospedar ou incorporar. Nem todo jogo permite iframe e alguns exigem integração própria.

Para arquivos grandes, avalie limites de tamanho, banda e custo antes de usar o Supabase Storage como distribuição principal.

## Saves
A tabela `game_saves` guarda saves enviados manualmente e dados de progresso estruturados para jogos que tenham integração compatível. O site não consegue salvar automaticamente o progresso de qualquer jogo arbitrário: cada jogo precisa expor uma API, eventos ou formato de save compatível.

## Administração segura
- Novas contas começam como usuários comuns.
- O papel de administrador deve ser concedido manualmente por um operador confiável no SQL Editor.
- As políticas RLS impedem que um usuário altere o próprio papel ou leia saves de outras pessoas.
- Ações que exijam segredo de servidor devem ser implementadas em Route Handlers seguros; não exponha service role no cliente.

## Estado atual
Este é o scaffold inicial: página inicial, tela de login e esquema SQL base. Ainda é necessário configurar o projeto Supabase, testar políticas e implementar telas completas de administração, upload e sincronização específica dos jogos antes de produção.
