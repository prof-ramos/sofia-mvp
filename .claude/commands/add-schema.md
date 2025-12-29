# Add Database Schema Command

Cria um novo schema DrizzleORM + Zod validation para o banco de dados Supabase PostgreSQL.

## Usage

Este command cria schemas seguindo os padrões do projeto:
- IDs com nanoid() customizado
- Timestamps automáticos (created_at, updated_at)
- Validação Zod integrada
- Suporte opcional para vector embeddings

## Steps

### 1. Criar arquivo de schema
**Localização**: `lib/db/schema/[tableName].ts`

### 2. Incluir campos padrão
Todos os schemas incluem:
- `id`: varchar(191) com nanoid() default
- `createdAt`: timestamp com sql now()
- `updatedAt`: timestamp com sql now()

### 3. Adicionar campos customizados
Tipos suportados:
- `text`: Texto ilimitado
- `varchar`: Texto com limite (especificar length)
- `integer`: Números inteiros
- `boolean`: True/false
- `timestamp`: Data e hora
- `jsonb`: Dados JSON
- `vector`: Embeddings vetoriais (se hasVector=true)

### 4. Adicionar vector field (opcional)
Se o schema precisar de embeddings:
- Campo `embedding`: vector({ dimensions: 1536 })
- Index HNSW: `vector_cosine_ops` para busca rápida

### 5. Criar Zod validation schema
- Usar `createSelectSchema` do drizzle-zod
- `.omit()` campos auto-generated (id, timestamps)
- `.extend()` para validações customizadas

### 6. Export types
- `NewTableParams`: z.infer do insert schema
- `TableRow`: z.infer do select schema (opcional)

### 7. Gerar e aplicar migration
```bash
pnpm db:generate  # Gera SQL migration
# Review: lib/db/migrations/[timestamp]_[name].sql
pnpm db:migrate   # Aplica migration
```

## Template Base

```typescript
import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "@/lib/utils";

export const tableName = pgTable("table_name", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),

  // Campos customizados aqui
  name: text("name").notNull(),
  description: text("description"),

  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

export const insertTableNameSchema = createSelectSchema(tableName)
  .extend({
    // Validações customizadas
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type NewTableNameParams = z.infer<typeof insertTableNameSchema>;
```

## Template com Vectors

```typescript
import { pgTable, varchar, text, timestamp, vector, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "@/lib/utils";

export const documents = pgTable(
  "documents",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    embeddingIndex: index("documentsEmbeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);

export const insertDocumentsSchema = createSelectSchema(documents)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type NewDocumentsParams = z.infer<typeof insertDocumentsSchema>;
```

## Example Usage

### Schema simples (produtos)
```typescript
// lib/db/schema/products.ts
export const products = pgTable("products", {
  id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
```

### Schema com relacionamento
```typescript
// lib/db/schema/reviews.ts
export const reviews = pgTable("reviews", {
  id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
  productId: varchar("product_id", { length: 191 })
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
```

## Notes

- **SEMPRE** revisar migration gerada antes de aplicar
- Para relacionamentos, usar `.references()` com onDelete/onUpdate
- Vector embeddings exigem extensão pgvector no Supabase
- Considerar adicionar índices para queries frequentes
- Para updates, usar `updateTableNameSchema = insertTableNameSchema.partial()`

## Related Commands

- `/add-server-action` - Criar CRUD actions para este schema
- `/generate-migration` - Workflow completo de migrations
- `/add-ai-tool` - Criar AI tool que usa este schema (se for RAG)
