# Sofia MVP - Next.js 15 RAG System

Sistema de Retrieval Augmented Generation (RAG) construído com Next.js 15, Vercel AI SDK v5 e Supabase PostgreSQL com vetorização.

## Stack Tecnológica

### Core
- **Next.js**: 15.5.7 (App Router, React Server Components)
- **React**: 19.0.0 (Client + Server Components)
- **TypeScript**: 5.7.2 (strict mode)
- **Package Manager**: pnpm

### Database & ORM
- **Database**: PostgreSQL (Supabase)
- **ORM**: DrizzleORM 0.38.1
- **Validation**: Zod 4.1.12 + drizzle-zod 0.6.0
- **Migrations**: drizzle-kit 0.30.0
- **Vector Extension**: pgvector (HNSW indexing)

### AI & RAG
- **AI SDK**: Vercel AI SDK 5.0.70 + @ai-sdk/react 2.0.76
- **Chat Model**: OpenAI GPT-4o
- **Embedding Model**: OpenAI text-embedding-ada-002 (1536 dimensions)
- **Features**: Streaming, Tools, Vector Search, RAG

### UI & Styling
- **Component Library**: shadcn/ui (default style, neutral theme)
- **Styling**: Tailwind CSS 3.4.16 + tailwindcss-animate
- **Animations**: Framer Motion 11.14.1
- **Markdown**: streamdown 1.6.7
- **Icons**: lucide-react 0.468.0
- **Font**: Geist 1.3.1

### Environment & Utilities
- **Env Validation**: @t3-oss/env-nextjs 0.11.1
- **ID Generation**: nanoid 5.0.9 (customizado)
- **Notifications**: sonner 1.7.1
- **Class Utilities**: clsx 2.1.1 + tailwind-merge 2.5.5
- **CVA**: class-variance-authority 0.7.1

---

## Arquitetura do Projeto

### Estrutura de Diretórios

```
/
├── app/
│   └── (preview)/              # Route group
│       ├── api/
│       │   └── chat/
│       │       └── route.ts    # AI chat endpoint (POST)
│       ├── page.tsx            # Chat UI (Client Component)
│       ├── layout.tsx          # Root layout
│       └── globals.css         # Global styles + CSS variables
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── label.tsx
│   ├── icons.tsx               # Icon components
│   └── project-overview.tsx    # Project info component
├── lib/
│   ├── ai/
│   │   └── embedding.ts        # Embedding generation + RAG search
│   ├── db/
│   │   ├── schema/
│   │   │   ├── resources.ts    # Resource schema + validation
│   │   │   └── embeddings.ts   # Embeddings schema + HNSW index
│   │   ├── migrations/         # SQL migrations (auto-generated)
│   │   ├── index.ts            # Database client
│   │   └── migrate.ts          # Migration runner
│   ├── actions/
│   │   └── resources.ts        # Server Actions
│   ├── env.mjs                 # Environment validation
│   └── utils.ts                # Utilities (cn, nanoid)
├── drizzle.config.ts           # Drizzle configuration
├── components.json             # shadcn/ui configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies
```

---

## Padrões de Código

### 1. Database Schema Pattern (DrizzleORM + Zod)

**Localização**: `lib/db/schema/*.ts`

**Pattern:**
```typescript
import { pgTable, varchar, text, timestamp, vector, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "@/lib/utils";

// Schema definition
export const myTable = pgTable("my_table", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),

  content: text("content").notNull(),

  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Zod validation schema
export const insertMyTableSchema = createSelectSchema(myTable)
  .extend({})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Type export
export type NewMyTableParams = z.infer<typeof insertMyTableSchema>;
```

**Regras:**
- IDs: `varchar(191)` com `nanoid()` default
- Timestamps: `created_at` e `updated_at` com `sql now()`
- Validation: `createSelectSchema` + `.omit()` para campos auto-generated
- Type export: `z.infer` para type-safety

**Vector Schema Pattern:**
```typescript
import { vector, index } from "drizzle-orm/pg-core";

export const embeddings = pgTable(
  "embeddings",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    content: text("content").notNull(),
  },
  (table) => ({
    embeddingIndex: index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);
```

### 2. Server Actions Pattern

**Localização**: `lib/actions/*.ts`

**Pattern:**
```typescript
"use server";

import { myTable, insertMyTableSchema, type NewMyTableParams } from "@/lib/db/schema/myTable";
import { db } from "@/lib/db";

export const myAction = async (input: NewMyTableParams) => {
  try {
    // 1. Validate input
    const validatedData = insertMyTableSchema.parse(input);

    // 2. Database operation
    const [result] = await db
      .insert(myTable)
      .values(validatedData)
      .returning();

    // 3. Return success message
    return "Operation successful.";
  } catch (error) {
    // 4. Error handling
    return error instanceof Error && error.message.length > 0
      ? error.message
      : "Error, please try again.";
  }
};
```

**Regras:**
- Sempre usar `"use server"` directive
- Validar input com Zod schema
- Usar try-catch para error handling
- Retornar mensagens user-friendly
- Usar `.returning()` para obter dados inseridos

### 3. API Route Pattern (Vercel AI SDK)

**Localização**: `app/(preview)/api/*/route.ts`

**Pattern:**
```typescript
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: "openai/gpt-4o",
    messages: convertToModelMessages(messages),
    system: `Your system prompt here...`,
    tools: {
      myTool: tool({
        description: "Tool description",
        inputSchema: z.object({
          param: z.string().describe("Parameter description"),
        }),
        execute: async ({ param }) => {
          // Tool logic here
          return result;
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

**Regras:**
- Export `maxDuration` para long-running requests
- Usar `convertToModelMessages` para converter UIMessage
- Tools com `inputSchema` (Zod) + `execute` function
- Retornar `result.toUIMessageStreamResponse()`
- System prompt detalhado para guiar comportamento

### 4. AI Tools Pattern

**Pattern:**
```typescript
tools: {
  toolName: tool({
    description: `Detailed description of what this tool does.
      Include usage guidelines and when to use it.`,
    inputSchema: z.object({
      param1: z.string().describe("parameter description"),
      param2: z.array(z.string()).describe("array parameter"),
    }),
    execute: async ({ param1, param2 }) => {
      // 1. Process inputs
      // 2. Call external functions/APIs
      // 3. Return structured data
      return results;
    },
  }),
}
```

**Tipos de Tools Existentes:**
- `addResource`: Adicionar conhecimento ao RAG
- `getInformation`: Buscar informação por similarity search
- `understandQuery`: Gerar queries similares com `generateObject`

### 5. Embedding & RAG Pattern

**Localização**: `lib/ai/embedding.ts`

**Pattern:**
```typescript
import { embed, embedMany } from "ai";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";

const embeddingModel = "openai/text-embedding-ada-002";

// Chunking strategy
const generateChunks = (input: string): string[] => {
  return input.trim().split(".").filter((i) => i !== "");
};

// Batch embedding
export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

// Single embedding
export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\n", " ");
  const { embedding } = await embed({ model: embeddingModel, value: input });
  return embedding;
};

// Similarity search
export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;

  const results = await db
    .select({ name: embeddings.content, similarity })
    .from(embeddings)
    .where(gt(similarity, 0.3))  // Threshold
    .orderBy((t) => desc(t.similarity))
    .limit(4);

  return results;
};
```

**Regras:**
- Chunking: por sentença (split em ".")
- Similarity: cosine distance (1 - cosineDistance)
- Threshold: 0.3 (ajustável)
- Limit: 4 resultados mais relevantes
- Normalização: substituir `\n` por espaço

### 6. Client Component Pattern (shadcn/ui + AI SDK)

**Localização**: `app/(preview)/page.tsx`, `components/*.tsx`

**Pattern:**
```typescript
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function MyComponent() {
  const { messages, status, sendMessage } = useChat({
    onToolCall({ toolCall }) {
      console.log("Tool call:", toolCall);
    },
    onError: (error) => {
      // Error handling
    },
  });

  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() !== "") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <div className={cn("flex flex-col", "custom-class")}>
      {/* Component JSX */}
    </div>
  );
}
```

**Regras:**
- `"use client"` directive obrigatória
- `useChat` hook para AI interactions
- Sempre validar input antes de enviar
- Usar `cn()` para class merging
- shadcn/ui components com `@/components/ui/*`

### 7. Utilities Pattern

**Localização**: `lib/utils.ts`

**Pattern:**
```typescript
import { customAlphabet } from "nanoid";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Class name utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ID generation (lowercase + numbers only)
export const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");
```

**Regras:**
- `cn()`: Combinar classes Tailwind com merging automático
- `nanoid`: IDs customizados (lowercase + numbers)

---

## Environment Variables

**Arquivo**: `.env.local`

**Variáveis Obrigatórias:**
```bash
DATABASE_URL=postgres://user:password@host:port/dbname
AI_GATEWAY_API_KEY=sk-***
```

**Validação**: `lib/env.mjs` usando @t3-oss/env-nextjs

**Pattern:**
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    AI_GATEWAY_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  },
});
```

---

## Database Migrations

**Workflow:**
```bash
# 1. Modificar schemas em lib/db/schema/*.ts
# 2. Gerar migration
pnpm db:generate

# 3. Review migration em lib/db/migrations/
# 4. Aplicar migration
pnpm db:migrate

# 5. (Opcional) Push direto para dev
pnpm db:push

# 6. (Opcional) Abrir Drizzle Studio
pnpm db:studio
```

**Migration Runner**: `lib/db/migrate.ts`
- Executado automaticamente no build (`pnpm build`)
- Usa `drizzle-orm/postgres-js/migrator`
- Migrations folder: `lib/db/migrations`

---

## shadcn/ui Patterns

**Configuração**: `components.json`
- **Style**: default
- **Base Color**: neutral
- **RSC**: true (React Server Components)
- **Aliases**: `@/components`, `@/lib/utils`

**Adicionar Componentes:**
```bash
npx shadcn@latest add [component-name]
```

**Import Pattern:**
```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

**Customização:**
- CSS Variables em `app/globals.css`
- Tailwind config em `tailwind.config.ts`
- Tema neutral com dark mode support

---

## TypeScript Configuration

**Mode**: Strict
**Path Aliases**: `@/*` → `./*`
**Target**: esnext
**Module**: esnext
**JSX**: preserve (Next.js handles compilation)

**Regras:**
- Sempre usar type annotations
- Preferir `type` over `interface` para consistency
- Usar `z.infer<>` para derivar types de Zod schemas
- Export types junto com implementation

---

## Conventions de Nomenclatura

### Arquivos
- **Components**: `PascalCase.tsx` (e.g., `ProjectOverview.tsx`)
- **Utilities**: `kebab-case.ts` (e.g., `embedding.ts`)
- **Schemas**: `kebab-case.ts` (e.g., `resources.ts`)
- **Actions**: `kebab-case.ts` (e.g., `resources.ts`)
- **Routes**: `route.ts` (Next.js convention)

### Código
- **Components**: `PascalCase` (e.g., `MyComponent`)
- **Functions**: `camelCase` (e.g., `generateEmbedding`)
- **Types**: `PascalCase` (e.g., `NewResourceParams`)
- **Constants**: `camelCase` (e.g., `embeddingModel`)
- **Database Tables**: `snake_case` (e.g., `created_at`)

---

## Performance & Optimization

### RAG System
- **Chunking**: Por sentença (customizável)
- **Similarity Threshold**: 0.3 (balanceamento precision/recall)
- **Result Limit**: 4 chunks mais relevantes
- **Index Type**: HNSW (fast approximate search)
- **Vector Dimensions**: 1536 (OpenAI ada-002)

### Next.js
- **Server Components**: Default (melhor performance)
- **Client Components**: Apenas quando necessário (interatividade)
- **Streaming**: Habilitado para AI responses
- **Route Groups**: `(preview)` para organização sem afetar URLs

### Database
- **Connection Pooling**: postgres.js client
- **Migrations**: Automáticas no build
- **Indexes**: HNSW para vector search

---

## Debugging & Development

### Logs
- Tool calls: console.log no `onToolCall` callback
- Errors: toast notifications (sonner)
- Network: Vercel AI SDK stream events

### Studio
```bash
pnpm db:studio  # Drizzle Studio em http://localhost:4983
```

### Dev Server
```bash
pnpm dev  # http://localhost:3000
```

---

## Referencias Importantes

### Vercel AI SDK v5 Docs
- https://sdk.vercel.ai/docs
- Tools: https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
- Streaming: https://sdk.vercel.ai/docs/ai-sdk-core/streaming
- Embeddings: https://sdk.vercel.ai/docs/ai-sdk-core/embeddings

### Drizzle ORM
- https://orm.drizzle.team/docs/overview
- PostgreSQL: https://orm.drizzle.team/docs/get-started-postgresql

### shadcn/ui
- https://ui.shadcn.com/
- Components: https://ui.shadcn.com/docs/components

### Supabase
- Vectors: https://supabase.com/docs/guides/ai/vector-columns
- pgvector: https://github.com/pgvector/pgvector
