# Skill: Drizzle + Supabase Expert

Guia para modelar e consultar o banco Supabase/Postgres usando DrizzleORM e pgvector no projeto Sofia.

## Quando usar
- Criar/alterar schemas em `lib/db/schema/*`.
- Escrever queries/Server Actions envolvendo o banco.
- Gerar migrações e revisar SQL.

## Padrões do projeto
- IDs: `varchar(191)` com `nanoid()` default.
- Timestamps: `createdAt` e `updatedAt` com `sql` now().
- Validação: `drizzle-zod` para schemas de leitura/entrada.
- Vetores: coluna `vector({ dimensions: 1536 })` com índice HNSW.
- Aliases: imports via `@/lib/db` e `@/lib/db/schema/<tabela>`.

## Playbook de schema
1) Criar arquivo em `lib/db/schema/<nome>.ts`.
2) Definir tabela com `pgTable` e campos padrão (`id`, `createdAt`, `updatedAt`).
3) Adicionar colunas de domínio com tipos estritos (varchar com length, boolean, integer etc.).
4) Se usar vetor, criar índice HNSW manualmente na migração quando necessário.
5) Exportar selects/input schemas via `createSelectSchema`/`createInsertSchema`.

## Playbook de queries
- Usar helpers do Drizzle: `eq`, `and`, `or`, `sql`, `desc`, `asc`.
- Para paginação: `limit` + `offset` ou `cursor` baseado em id/createdAt.
- Para writes: `db.insert(...).values(...).returning()` para obter registro.
- Transactions: `await db.transaction(async (tx) => { ... })` para operações atômicas.
- Evitar N+1: combine selects com joins ou múltiplas queries com IN.

## Migrações
- Gerar: `pnpm db:generate` após alterar schemas.
- Revisar SQL em `lib/db/migrations/*/migration.sql`.
- Aplicar: `pnpm db:migrate` (confirme `DATABASE_URL`).
- Não usar `pnpm db:drop` em ambientes compartilhados.

## Snippet: tabela com vetor
```ts
import { pgTable, varchar, timestamp, vector, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export const embeddings = pgTable(
  "embeddings",
  {
    id: varchar("id", { length: 191 }).primaryKey().notNull().$defaultFn(nanoid),
    content: varchar("content", { length: 2048 }).notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("embeddings_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))]
);
```

## Snippet: consulta com filtro e ordenação
```ts
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";

export async function listResources({ q, limit = 20 }) {
  return db
    .select()
    .from(resources)
    .where(q ? ilike(resources.title, `%${q}%`) : undefined)
    .orderBy(desc(resources.createdAt))
    .limit(limit);
}
```

## Checklist
- [ ] Tabelas usam `nanoid` + timestamps.
- [ ] Comprimentos definidos para `varchar` (evitar defaults ilimitados sem necessidade).
- [ ] Validação Zod exportada quando usada em actions/routes.
- [ ] Índices adicionados para colunas filtradas/ordenadas.
- [ ] Vetores têm índice HNSW quando usados em busca.
- [ ] Migração revisada antes de aplicar em Supabase.
