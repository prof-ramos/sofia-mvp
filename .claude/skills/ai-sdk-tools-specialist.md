# Skill: AI SDK Tools Specialist

Guia para criar e orquestrar ferramentas usando Vercel AI SDK v5 no projeto Sofia.

## Quando usar
- Adicionar/editar tools no endpoint de chat (`app/(preview)/api/chat/route.ts`).
- Criar novas tools para rotas ou ações server-side com validação.
- Ajustar streaming e orquestração (`stepCountIs`, ordens de chamada, etc.).

## Padrões do projeto
- Helpers usados: `streamText`, `tool`, `generateObject`, `convertToModelMessages`, `stepCountIs`.
- Validação: Zod em `inputSchema`.
- Execução: funções async server-side; podem chamar Drizzle, Supabase, embeddings.
- Resposta: `result.toUIMessageStreamResponse()` (UI-friendly) ou `toAIStreamResponse()` em outras rotas.

## Playbook para criar uma tool
1) **Definir propósito**: descrever claramente o que a tool faz.
2) **Modelar input** com `z.object` e descrições úteis.
3) **Implementar execute**: lógica pura server-side; tratar erros e retornar dados estruturados.
4) **Conectar ao fluxo**: adicionar em `tools: { ... }` do `streamText`.
 5) **Controlar orquestração**: se precisar limitar passos, usar `stopWhen: stepCountIs(n)`, onde "n" é o número máximo de invocações de tool que o orchestrator permitirá em uma execução (ex.: stepCountIs(3) limita a 3 chamadas de tools; a contagem começa em 1).
6) **Testar**: rodar `pnpm dev` e simular prompts para acionar a tool.

## Snippet: tool de CRUD
```ts
import { tool } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";

export const addResource = tool({
  description: "Adiciona um recurso ao knowledge base",
  inputSchema: z.object({
    content: z.string().min(1),
  }),
  execute: async ({ content }) => {
    const [record] = await db
      .insert(resources)
      .values({ id: nanoid(), content })
      .returning();
    return record;
  },
});
```

## Snippet: tool com generateObject
```ts
import { generateObject, tool } from "ai";
import { z } from "zod";

export const understandQuery = tool({
  description: "Entende a intenção do usuário e sugere perguntas semelhantes",
  inputSchema: z.object({ query: z.string().describe("pergunta do usuário") }),
  execute: async ({ query }) => {
    const { object } = await generateObject({
      model: "openai/gpt-4o",
      system: "Você gera 3 perguntas similares e concisas",
      schema: z.object({ questions: z.array(z.string()).max(3) }),
      prompt: `Query: ${query}`,
    });
    return object.questions;
  },
});
```

## Integração no endpoint
```ts
const result = streamText({
  model: "openai/gpt-4o",
  messages: convertToModelMessages(messages),
  system: "Use tools sempre que precisar de dados.",
  tools: { addResource, understandQuery },
  stopWhen: stepCountIs(5), // limita o número máximo de chamadas de tools a 5 para evitar loops infinitos e custo excessivo
});

return result.toUIMessageStreamResponse();
```

## Boas práticas
- Mensagens do system prompt devem instruir o modelo a usar as tools (como no arquivo atual).
- `inputSchema` com descrições claras melhora a chamada automática.
- Limitar tokens de saída (`maxOutputTokens`) quando necessário.
- Tratar erros no `execute` e retornar mensagens úteis.
- Evitar side effects pesados; se inevitável, usar idempotência (ex.: checar duplicatas).
- Integrações de tools em produção devem emitir logs estruturados e métricas (erros, metadados de request/response, durações), integrar com o stack de observabilidade da equipe (trace IDs/contexts) e logar em níveis apropriados evitando dados sensíveis; correlacionar logs com retries/idempotência e retornar informações de erro mínimas para o usuário.

## Checklist
- [ ] Tool declarada com `tool({ description, inputSchema, execute })`.
- [ ] `execute` assíncrono e seguro (try/catch se necessário).
- [ ] Inputs validados por Zod antes de uso.
- [ ] `tools` adicionadas ao objeto `streamText`.
- [ ] Orquestração configurada (`stopWhen`, ordem esperada de tools).
