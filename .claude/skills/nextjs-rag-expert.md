# Skill: Next.js RAG Expert

Guia para implementar e evoluir o sistema RAG do projeto Sofia (Next.js 15 + React 19 + App Router) com Vercel AI SDK v5.

## Quando usar
- Criar/ajustar endpoints RAG em `app/(preview)/api/chat/route.ts` ou novas rotas.
- Ajustar fluxo de streaming, ferramentas ou system prompt.
- Melhorar UX em componentes server/client relacionados ao chat.

## Pilares do projeto
- **App Router / RSC**: preferir server components; client components com `"use client"` somente quando necessário.
- **AI SDK v5**: `streamText` com `tools`, `messages`, `toAIStreamResponse`.
- **DB**: Supabase Postgres + DrizzleORM + pgvector.
- **UI**: Tailwind + shadcn/ui (aliases `@/components` e `@/lib/utils`).

## Playbook
1) **Entender a entrada**: `messages` e ferramentas no endpoint de chat. Validar shape antes de usar.
2) **RAG retrieval**:
   - Usar `lib/ai/embedding.ts` e schemas em `lib/db/schema/embeddings.ts`/`resources.ts`.
   - Consultar via Drizzle com filtros por similaridade; considere limiar de score.
3) **Construir o prompt**:
    - System prompt curto e factual; incluir instruções de idioma pt-BR.
    - Incluir contexto concatenando `title + content` truncados por tokens: use helper `lib/ai/utils.ts: truncateByTokens(text, maxTokens)` para truncar, com limites concretos (ex.: título 30 tokens, conteúdo 512 tokens).
4) **Executar streaming**:
   - `const result = await streamText({ model, messages, tools, ... })`.
   - Retornar `createStreamResponse(result.toAIStreamResponse())` (ou `result.toAIStreamResponse()` direto).
5) **Ferramentas**:
   - Definir `inputSchema` com Zod.
   - Implementar lógica server-side (consultas, writes, chamadas externas permitidas).
6) **Erro/observabilidade**:
   - Logar com prefixo `[chat]` ou da rota.
   - Responder 400 para erros de validação e 500 para falhas internas.

## Snippet base de rota RAG
```ts
import { createStreamResponse, streamText } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { embeddings } from "@/lib/db/schema/embeddings";

export const maxDuration = 30;

const tools = {
  retrieve: {
    description: "Busca contexto relevante usando similaridade vetorial",
    inputSchema: z.object({ query: z.string().min(1) }),
    execute: async ({ query }) => {
      // Gerar embedding da query
      const { generateEmbedding } = await import("@/lib/ai/embedding");
      const queryEmbedding = await generateEmbedding(query);

      // Consultar embeddings via Drizzle + pgvector com limiar de similaridade
      const results = await db
        .select()
        .from(embeddings)
        .orderBy(sql`${embeddings.embedding} <=> ${queryEmbedding}`)
        .limit(5);

      // Filtrar resultados com distância aceitável (cosine distance < 0.3 ≈ sim > 0.7)
      const relevant = results.filter((r) => r.distance < 0.3);

      // Construir contexto concatenando title + content
      const context = relevant.map((r) => `${r.title || ''}\n${r.content}`).join('\n\n');

      return { context, query };
    },
  },
};

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: "gpt-4o-mini",
    messages,
    tools,
    maxOutputTokens: 1024,
  });

  return createStreamResponse(result.toAIStreamResponse());
}
```

## Checklist
- [ ] Rota em `app/(preview)/api/.../route.ts` com handlers nomeados.
- [ ] `maxDuration` definido para streaming.
- [ ] Ferramentas com `inputSchema` Zod e funções async sem dependências client.
- [ ] Sem imports de CSS, hooks React (useState, useEffect, etc.) ou componentes client em handlers do servidor; evitar 'use client' em rotas de API.
- [ ] Respostas usando `toAIStreamResponse` ou `NextResponse.json` quando apropriado.
- [ ] Contexto RAG truncado para evitar over-token.
