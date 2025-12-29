# Repository Guidelines

## Estrutura do projeto e módulos
- Repositório único (sem pnpm workspaces/pnpm-workspace.yaml).
- Aplicação Next.js 15 (React 19) em `app/(preview)` com `layout.tsx`, `page.tsx` e estilos em `globals.css`; assets estáticos em `public/` e `app/favicon.ico`.
- Componentes reutilizáveis em `components/` (`project-overview.tsx`, `icons.tsx`, `ui/` para primitives de formulário).
- Lógica de domínio em `lib/`: `ai/` (embedding), `actions/` (ações/server), `db/` (schema, migrações e bootstrap), `env.mjs` (validação de variáveis) e utilitários como `cn` em `utils.ts`.
- Configurações de build e tooling na raiz (`next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `drizzle.config.ts`).

## Comandos de desenvolvimento, build e banco
- Instalação: `pnpm install` (prefira PNPM — há `pnpm-lock.yaml`).
- Dev server: `pnpm dev` (localhost:3000).
- Build: `pnpm build` (roda `tsx lib/db/migrate.ts` antes do `next build`; requer `.env` e banco acessível).
- Produção local: `pnpm start` após build.
- Qualidade: `pnpm lint` (ESLint com `next/core-web-vitals`).
- Banco: `pnpm db:generate` (gera migrações a partir do schema), `pnpm db:migrate` (aplica migrações), `pnpm db:studio` (UI para inspecionar), `pnpm db:drop`/`db:pull`/`db:push`/`db:check` conforme necessidade.
- Banco — cuidado: `pnpm db:drop` é destrutivo (reset total; use apenas com backup ou em reset local/CI). `pnpm db:pull` é não destrutivo (sincroniza schema de um Postgres remoto para o schema local). Exemplos: `pnpm db:drop && pnpm db:migrate` para reset local; `pnpm db:pull --config drizzle.config.ts` para alinhar schema de staging.

## Estilo de código e convenções
- TypeScript estrito; use o alias `@/` para imports relativos à raiz.
- Indentação de 2 espaços e componentes React em PascalCase; hooks/composables em camelCase.
- Prefira componentes server-side quando possível; marque interativos com `"use client"`.
- Estilização com Tailwind; combine classes com `cn`/`clsx` e evite CSS global além de `globals.css`. Imports de CSS (globais ou módulos) apenas em nível de página/layout top-level (`app/layout.tsx`/`page.tsx`), nunca dentro de componentes/hooks.
- Rodar `pnpm lint` antes de abrir PR para garantir conformidade com o padrão Next.js.

## Testes
- Ainda não há suíte de testes configurada. Recomenda-se: Vitest para unidade/integrado (`*.test.ts(x)` próximos ao código ou em `__tests__/` com script `pnpm test`/`pnpm test:watch`) e Playwright para E2E (`pnpm test:e2e`). Antes de releases, cubra no mínimo rotas críticas e fluxos de chat/RAG (smoke + fluxos principais) e monitore cobertura dos casos-chave.

## Commits e pull requests
- Histórico atual é inicial; adote mensagens no imperativo curto, idealmente seguindo Conventional Commits (`feat:`, `fix:`, `chore:` etc.).
- Antes de abrir PR: descreva objetivo e escopo, liste comandos executados (ex.: `pnpm lint`, migrações), anexe screenshots/recordings para mudanças visuais e vincule issues se existirem.
- Inclua notas sobre mudanças em esquema (arquivos em `lib/db/migrations`) e passos de migração de dados quando aplicável. Migrações devem ser testadas localmente ou em staging antes do PR (rodar `pnpm db:migrate`, validar schema/dados e prever rollback/restauração); registre no checklist do PR que as migrações foram verificadas.

## Segurança e configuração
- Configure `.env` a partir de `.env.example`; nunca versione segredos. Variáveis obrigatórias: `DATABASE_URL` (Postgres) e `AI_GATEWAY_API_KEY` (Vercel AI Gateway).
- Migrações usam as credenciais do `.env`; confirme o banco antes de rodar `pnpm build` para evitar falhas.
- Revise dependências sensíveis (AI, banco) antes de deploy e limite logs contendo dados de usuário/tool calls.
