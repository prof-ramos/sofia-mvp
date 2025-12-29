# Create API Route Command

Cria uma nova rota API no App Router (`app/(preview)/api/.../route.ts`) alinhada com Next.js 15, React Server Components e Vercel AI SDK quando necessário.

## Uso recomendado
- Endpoints REST padrão (GET/POST/PUT/DELETE) com `NextResponse`.
- Endpoints de streaming/AI usando `streamText` + `createStreamResponse`.
- Endpoints que reutilizam validação Zod para segurança de tipos.

## Pré-requisitos
- TypeScript strict habilitado.
- Alias `@/` configurado (tsconfig).
- Zod disponível (já usado em `lib/env.mjs`).
- Para AI: Vercel AI SDK v5 instalado.

## Passos

### 1) Escolher a rota e criar o arquivo
Local padrão: `app/(preview)/api/<nome>/route.ts`
- Manter os handlers `export async function GET/POST/PUT/DELETE`.
- Para streaming, definir `export const maxDuration = 30;` se necessário.

### 2) Template para POST com validação Zod
```ts
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

type Body = z.infer<typeof bodySchema>;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    // TODO: lógica principal aqui
    return NextResponse.json({ ok: true, data: body });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", issues: err.flatten() },
        { status: 400 }
      );
    }

    console.error("[api/<nome>]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### 3) Template para GET simples
```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
```

### 4) Template para endpoint de streaming com AI SDK
```ts
import { createStreamResponse, streamText } from "ai";
import { z } from "zod";
import { kv } from "@vercel/kv"; // exemplo opcional

export const maxDuration = 30; // aumenta limite para streaming

const bodySchema = z.object({
  prompt: z.string().min(1),
});

type Body = z.infer<typeof bodySchema>;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    const result = await streamText({
      model: "gpt-4o-mini", // alinhar com modelos configurados no projeto
      prompt: body.prompt,
    });

    return result.toAIStreamResponse();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "Invalid body", issues: err.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("[api/<nome>/stream]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```
- Use `createStreamResponse(result.toAIStreamResponse())` se precisar adicionar headers customizados (padrão recomendado para passar headers; `result.toAIStreamResponse()` para passthrough simples).
- Mantenha o handler leve (sem hooks React, apenas código server-side).

### 5) Integração com Drizzle/Supabase (opcional)
- Importar `db` e schemas de `lib/db/schema/*`.
- Usar `eq`, `and`, `sql` do Drizzle para queries.
- Envolver em try/catch e retornar erros 400/500 apropriados.

### 6) Checklist
- [ ] Arquivo em `app/(preview)/api/<nome>/route.ts`.
- [ ] Handlers exportados (`GET/POST/...`) sem default export.
- [ ] Body validado com Zod antes de usar.
- [ ] Respostas com `NextResponse.json` ou streaming via `toAIStreamResponse`.
- [ ] Logs de erro com contexto (`[api/<nome>]`).
- [ ] `maxDuration` definido se streaming ou chamadas longas.
- [ ] Sem imports de CSS ou componentes client.

## Exemplos de código prontos

### POST com inserção em tabela via Drizzle
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";
import { nanoid } from "nanoid";

const bodySchema = z.object({
  title: z.string().min(3),
  content: z.string().min(1),
});

type Body = z.infer<typeof bodySchema>;

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());

    const [record] = await db
      .insert(resources)
      .values({ id: nanoid(), title: body.title, content: body.content })
      .returning();

    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("[api/resources]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### POST de streaming AI (RAG)
```ts
import { createStreamResponse, streamText } from "ai";
import { z } from "zod";
import { embedMany } from "@/lib/ai/embedding"; // exemplo de uso interno

export const maxDuration = 30;

const bodySchema = z.object({ query: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());

    const result = await streamText({
      model: "gpt-4o-mini", // alinhar com config
      system: "Você é um assistente RAG.",
      prompt: body.query,
      experimental_providerMetadata: true,
      maxOutputTokens: 1024,
    });

    return createStreamResponse(result.toAIStreamResponse());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "Invalid body", issues: err.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("[api/rag]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```
