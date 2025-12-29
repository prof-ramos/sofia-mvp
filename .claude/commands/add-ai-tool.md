# Add AI Tool Command

Adiciona um novo AI tool ao chat endpoint usando Vercel AI SDK v5 pattern.

## Usage

AI Tools permitem que o modelo execute ações específicas durante a conversa. Este command adiciona tools ao endpoint `/app/(preview)/api/chat/route.ts` seguindo os padrões do projeto.

## Steps

### 1. Abrir chat route
**Path**: `app/(preview)/api/chat/route.ts`

### 2. Adicionar tool ao objeto `tools`
Localizar `tools: { ... }` dentro de `streamText()` e adicionar novo tool.

### 3. Definir inputSchema com Zod
- Especificar todos os parâmetros necessários
- Adicionar `.describe()` para cada campo (ajuda o modelo)
- Usar tipos apropriados (string, number, array, object, enum)

### 4. Implementar execute function
- Async function com parâmetros tipados
- Chamar Server Actions ou funções auxiliares
- Processar e retornar dados estruturados

### 5. Adicionar imports necessários
- Server Actions de `lib/actions/*`
- Funções auxiliares de `lib/*`
- Tipos de `lib/db/schema/*`

## Template Base

```typescript
import { tool } from "ai";
import { z } from "zod";

toolName: tool({
  description: `Detailed description of what this tool does.

    Usage guidelines:
    - When to use this tool
    - What it returns
    - Any important constraints

    Example: Use this tool when the user asks about [specific topic].`,

  inputSchema: z.object({
    param1: z.string().describe("Clear description of param1"),
    param2: z.number().describe("Clear description of param2"),
    param3: z.array(z.string()).describe("Array of items for param3"),
  }),

  execute: async ({ param1, param2, param3 }) => {
    // 1. Process inputs
    // 2. Call Server Actions or helper functions
    // 3. Return structured data

    const results = await someFunction(param1, param2);

    return {
      success: true,
      data: results,
      message: "Operation completed successfully",
    };
  },
}),
```

## Example: Search Tool

```typescript
import { generateEmbedding, findRelevantContent } from "@/lib/ai/embedding";

searchKnowledgeBase: tool({
  description: `Search the knowledge base for relevant information.

    Use this tool when:
    - User asks questions about stored information
    - User wants to retrieve specific documents
    - User needs context from previous conversations

    Returns up to 5 most relevant documents with similarity scores.`,

  inputSchema: z.object({
    query: z.string().describe("The search query or question from the user"),
    maxResults: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of results (1-10)"),
  }),

  execute: async ({ query, maxResults }) => {
    try {
      const results = await findRelevantContent(query);
      const topResults = results.slice(0, maxResults);

      if (topResults.length === 0) {
        return {
          success: false,
          message: "No relevant information found.",
          suggestion: "Try rephrasing your question.",
        };
      }

      return {
        success: true,
        results: topResults.map((r) => ({
          content: r.content,
          similarity: r.similarity,
        })),
        count: topResults.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
}),
```

## Example: Create Resource Tool

```typescript
import { createResource } from "@/lib/actions/resources";

addResource: tool({
  description: `Add new information to the knowledge base.

    Use this tool when:
    - User shares personal information to remember
    - User provides facts or data to store
    - User wants to add context for future conversations

    The information will be embedded and made searchable.`,

  inputSchema: z.object({
    content: z
      .string()
      .describe("The information or content to store in the knowledge base"),
    category: z
      .enum(["personal", "work", "reference", "other"])
      .optional()
      .describe("Category to organize the information"),
  }),

  execute: async ({ content, category }) => {
    try {
      const result = await createResource({ content });

      // Espera structured response { success: boolean, error?: string, message?: string }
      const parsedResult = typeof result === 'string'
        ? { success: result.includes("successfully"), message: result }
        : result;

      if (parsedResult.success) {
        return {
          success: true,
          message: parsedResult.message || "Information added to knowledge base.",
        };
      } else {
        return {
          success: false,
          error: parsedResult.error || parsedResult.message || "Failed to add information.",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Failed to add information.",
      };
    }
  },
}),
```

## Example: Query Understanding Tool

```typescript
import { generateObject } from "ai";

understandQuery: tool({
  description: `Analyze and expand user queries for better retrieval.

    Use this tool BEFORE searching when:
    - Query is ambiguous or vague
    - Multiple search strategies could work
    - Need to generate related questions

    Returns expanded queries and intent analysis.`,

  inputSchema: z.object({
    query: z.string().describe("The user's original query to analyze"),
  }),

  execute: async ({ query }) => {
    try {
      const { object } = await generateObject({
        model: "openai/gpt-4o",
        schema: z.object({
          originalQuery: z.string(),
          expandedQueries: z.array(z.string()).max(5),
          intent: z.enum([
            "search",
            "create",
            "update",
            "delete",
            "clarify",
          ]),
          confidence: z.number().min(0).max(1),
        }),
        prompt: `Analyze this query and generate variations: "${query}"`,
      });

      return {
        success: true,
        analysis: object,
      };
    } catch (error) {
      console.error("[understandQuery] Error:", error);
      return {
        success: false,
        error: "Failed to analyze query.",
      };
    }
  },
}),
```

## Advanced Patterns

### Multi-step Tool (Orchestration)

```typescript
planAndExecute: tool({
  description: `Plan multi-step operations and coordinate tool calls.`,

  inputSchema: z.object({
    goal: z.string().describe("The user's high-level goal"),
  }),

  execute: async ({ goal }) => {
    // 1. Analyze goal
    const plan = await analyzeGoal(goal);

    // 2. Return guidance for next tools to call
    return {
      success: true,
      plan: plan.steps,
      suggestedTools: plan.toolsToUse,
      message: "Plan created. Executing steps...",
    };
  },
}),
```

### Conditional Tool

```typescript
smartSearch: tool({
  description: `Intelligently search using best strategy.`,

  inputSchema: z.object({
    query: z.string(),
    searchType: z.enum(["semantic", "keyword", "hybrid"]).optional(),
  }),

  execute: async ({ query, searchType = "semantic" }) => {
    if (searchType === "semantic") {
      return await vectorSearch(query);
    } else if (searchType === "keyword") {
      return await keywordSearch(query);
    } else {
      // Hybrid: combine both
      const [vectorResults, keywordResults] = await Promise.all([
        vectorSearch(query),
        keywordSearch(query),
      ]);

      return mergeResults(vectorResults, keywordResults);
    }
  },
}),
```

## Integration with System Prompt

Após adicionar tool, atualizar `system` prompt para incluir quando usar:

```typescript
const result = streamText({
  model: "openai/gpt-4o",
  messages: convertToModelMessages(messages),
  system: `You are a helpful assistant.

    Available tools:
    - searchKnowledgeBase: Use when user asks questions
    - addResource: Use when user shares information to remember
    - understandQuery: Use BEFORE searching for ambiguous queries

    Important:
    - ALWAYS call searchKnowledgeBase before answering questions
    - Call addResource when user explicitly shares personal info
    - Be transparent about tool usage`,
  tools: {
    // tools aqui
  },
});
```

## Monitoring Tool Calls

### Server-side logging

```typescript
const result = streamText({
  // ...
  onToolCall: ({ toolName, args, result }) => {
    console.log(`Tool called: ${toolName}`, {
      args,
      result,
      timestamp: new Date().toISOString(),
    });
  },
});
```

### Client-side monitoring

```typescript
// Em page.tsx
const { messages } = useChat({
  onToolCall({ toolCall }) {
    console.log("Tool call:", toolCall);
    // Pode adicionar analytics aqui
  },
});
```

## Notes

- **Descriptions**: Claras e detalhadas ajudam o modelo a escolher o tool certo
- **Input Schema**: Sempre usar `.describe()` para cada parâmetro
- **Return Values**: Estruturados (objects) são melhores que strings
- **Error Handling**: Sempre try-catch e retornar { success: false, error }
- **Performance**: Tools assíncronos podem ser paralelizados pelo modelo

## Related Commands

- `/add-server-action` - Criar actions que o tool vai chamar
- `/add-schema` - Criar schemas para armazenar dados do tool
