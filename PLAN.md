# Plano de Implementação - MVP Sofia

## Visão Geral

Plano para expandir o RAG Chatbot existente (Next.js 15 + TypeScript + Vercel AI SDK) com novos recursos:
- Chat conversacional com histórico persistente
- Upload e processamento de documentos (PDF, DOCX, TXT, MD)
- Integrações externas (APIs configuráveis)
- Sistema extensível de Tools (MCP - Model Context Protocol)

---

## Arquitetura Atual

**Stack Tecnológica:**
- Framework: Next.js 15.5.7 (App Router) + React 19 + TypeScript
- AI: Vercel AI SDK v5 (streamText, useChat) + OpenAI GPT-4o
- Embeddings: text-embedding-ada-002 (1536 dims)
- Database: PostgreSQL + pgvector + Drizzle ORM
- UI: Tailwind CSS + Shadcn UI + Framer Motion
- Package Manager: pnpm

**Estrutura de Banco de Dados Existente:**
```sql
-- Tabela: resources
- id (varchar 191, PK)
- content (text)
- created_at, updated_at (timestamp)

-- Tabela: embeddings
- id (varchar 191, PK)
- resource_id (FK → resources.id)
- content (text - chunk)
- embedding (vector 1536)
-- Index: HNSW para busca por similaridade coseno
```

**Arquivos Críticos Atuais:**
- `app/(preview)/api/chat/route.ts` - API de chat com 3 tools inline
- `app/(preview)/page.tsx` - UI do chat (useChat hook)
- `lib/ai/embedding.ts` - Geração de embeddings e busca semântica
- `lib/db/schema/resources.ts` - Schema de recursos
- `lib/actions/resources.ts` - Server action createResource

---

## Fase 1: Autenticação e Histórico de Conversas (Prioridade ALTA)

### 1.1 Setup Supabase Auth

**Objetivo:** Implementar autenticação segura com Supabase (OAuth + JWT)

**Novos Arquivos:**
```
lib/
  supabase/
    server.ts          # Cliente Supabase server-side (cookies)
    client.ts          # Cliente Supabase client-side
    middleware.ts      # Auth middleware para rotas protegidas

middleware.ts          # Next.js middleware (root)

app/
  (auth)/
    login/
      page.tsx         # Página de login (OAuth Google/GitHub)
    callback/
      route.ts         # OAuth callback handler
```

**Modificações:**
- `lib/env.mjs` - Adicionar variáveis:
  ```typescript
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
  ```

**Dependências:**
```json
{
  "@supabase/ssr": "^0.5.2",
  "@supabase/supabase-js": "^2.47.10"
}
```

**Migration: 0001_add_auth.sql**
```sql
-- Adicionar user_id às tabelas existentes
ALTER TABLE resources ADD COLUMN user_id uuid REFERENCES auth.users(id);
ALTER TABLE embeddings ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Indexes para performance
CREATE INDEX idx_resources_user_id ON resources(user_id);
CREATE INDEX idx_embeddings_user_id ON embeddings(user_id);

-- Row Level Security (RLS)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resources"
  ON resources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resources"
  ON resources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own embeddings"
  ON embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings"
  ON embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Implementação:**
1. Configurar Supabase client com cookies para SSR
2. Criar middleware para proteger rotas `/api/chat`
3. Implementar OAuth flow (Google + GitHub)
4. Atualizar server actions para incluir user_id

---

### 1.2 Histórico de Conversas Persistente

**Objetivo:** Salvar e recuperar conversas do usuário

**Migration: 0002_add_conversations.sql**
```sql
-- Tabela de conversas
CREATE TABLE conversations (
  id varchar(191) PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title varchar(255),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE messages (
  id varchar(191) PRIMARY KEY,
  conversation_id varchar(191) REFERENCES conversations(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL, -- 'user' | 'assistant' | 'system'
  content text NOT NULL,
  tool_calls jsonb,           -- Armazena tool calls
  tool_results jsonb,         -- Armazena tool results
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages of own conversations"
  ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  ));
```

**Novos Arquivos:**
```
lib/
  db/
    schema/
      conversations.ts   # Schema de conversas
      messages.ts        # Schema de mensagens
  actions/
    conversations.ts     # CRUD de conversas (create, list, delete)
    messages.ts          # Salvar/buscar mensagens

components/
  chat/
    conversation-list.tsx    # Sidebar com lista de conversas
    conversation-item.tsx    # Item da lista
    message-bubble.tsx       # Componente de mensagem individual
```

**Modificações:**
- `app/(preview)/api/chat/route.ts`:
  ```typescript
  export async function POST(req: Request) {
    const { messages, conversationId } = await req.json();
    const user = await getUser(); // Supabase auth

    // Criar ou buscar conversa
    let conversation = conversationId
      ? await getConversation(conversationId)
      : await createConversation(user.id);

    // Salvar mensagem do usuário
    await saveMessage({
      conversationId: conversation.id,
      role: 'user',
      content: messages[messages.length - 1].content
    });

    const result = streamText({
      // ... configuração existente
      onFinish: async (completion) => {
        // Salvar resposta do assistente
        await saveMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: completion.text,
          toolCalls: completion.toolCalls,
          toolResults: completion.toolResults
        });
      }
    });

    return result.toUIMessageStreamResponse();
  }
  ```

- `app/(preview)/page.tsx`:
  - Adicionar sidebar com `<ConversationList />`
  - Permitir seleção de conversa
  - Carregar mensagens ao selecionar conversa
  - Auto-geração de título da conversa (primeira mensagem)

**UI/UX:**
- Layout: Sidebar esquerda (250px) + Chat principal
- Botão "Nova Conversa" no topo da sidebar
- Lista de conversas ordenada por `updated_at DESC`
- Indicador de conversa ativa
- Botão de deletar conversa (com confirmação)

---

## Fase 2: Upload e Processamento de Documentos (Prioridade ALTA)

### 2.1 Upload de Arquivos

**Objetivo:** Permitir upload de PDF, DOCX, TXT, MD

**Dependências:**
```json
{
  "uploadthing": "^7.4.2",
  "@uploadthing/react": "^7.4.2",
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.8.0",
  "langchain": "^0.3.11",
  "@langchain/textsplitters": "^0.1.0"
}
```

**Novos Arquivos:**
```
app/
  api/
    uploadthing/
      core.ts            # Configuração UploadThing
      route.ts           # API route UploadThing

lib/
  uploadthing.ts         # Cliente UploadThing
  ai/
    document-processor.ts  # Parser e chunking de documentos
    parsers/
      pdf.ts             # Parser PDF (pdf-parse)
      docx.ts            # Parser DOCX (mammoth)
      text.ts            # Parser TXT/MD

components/
  documents/
    upload-button.tsx    # Botão de upload
    document-list.tsx    # Lista de documentos
    document-item.tsx    # Card de documento
    processing-status.tsx # Status do processamento
```

**Migration: 0003_add_documents.sql**
```sql
-- Tabela de documentos
CREATE TABLE documents (
  id varchar(191) PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  filename varchar(255) NOT NULL,
  file_type varchar(50) NOT NULL,   -- 'pdf', 'docx', 'txt', 'md'
  file_size integer NOT NULL,       -- bytes
  file_url text NOT NULL,           -- URL do UploadThing
  status varchar(20) DEFAULT 'processing', -- 'processing' | 'completed' | 'failed'
  error_message text,
  metadata jsonb,                   -- páginas, autor, etc
  created_at timestamp DEFAULT now()
);

-- Relacionar resources com documentos
ALTER TABLE resources ADD COLUMN document_id varchar(191) REFERENCES documents(id);
ALTER TABLE resources ADD COLUMN metadata jsonb; -- página, índice do chunk, etc

-- Indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_resources_document_id ON resources(document_id);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents"
  ON documents FOR ALL
  USING (auth.uid() = user_id);
```

**Configuração UploadThing:**
```typescript
// app/api/uploadthing/core.ts
import { createUploadthing } from "uploadthing/next";
import { getUser } from "@/lib/supabase/server";

const f = createUploadthing();

export const ourFileRouter = {
  documentUploader: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 5 },
    text: { maxFileSize: "16MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      const user = await getUser();
      if (!user) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Disparar processamento assíncrono
      await processDocument({
        userId: metadata.userId,
        fileUrl: file.url,
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
    }),
};
```

---

### 2.2 Processamento de Documentos

**Objetivo:** Extrair texto, criar chunks e gerar embeddings

**Implementação: lib/ai/document-processor.ts**
```typescript
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Chunking inteligente
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ".", "!", "?", ";", ",", " ", ""],
});

export async function processDocument(params: {
  userId: string;
  fileUrl: string;
  filename: string;
  fileType: string;
  fileSize: number;
}) {
  try {
    // 1. Criar registro de documento
    const doc = await createDocument({
      ...params,
      status: 'processing'
    });

    // 2. Download do arquivo
    const fileBuffer = await fetch(params.fileUrl).then(r => r.arrayBuffer());

    // 3. Parse baseado no tipo
    let text: string;
    let metadata: any = {};

    switch (params.fileType) {
      case 'application/pdf':
        const pdfData = await pdfParse(Buffer.from(fileBuffer));
        text = pdfData.text;
        metadata = { pages: pdfData.numpages };
        break;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
        text = docxResult.value;
        break;

      case 'text/plain':
      case 'text/markdown':
        text = new TextDecoder().decode(fileBuffer);
        break;

      default:
        throw new Error(`Unsupported file type: ${params.fileType}`);
    }

    // 4. Chunking
    const chunks = await textSplitter.splitText(text);

    // 5. Criar resources e embeddings para cada chunk
    for (let i = 0; i < chunks.length; i++) {
      const resource = await createResource({
        userId: params.userId,
        content: chunks[i],
        documentId: doc.id,
        metadata: {
          chunkIndex: i,
          totalChunks: chunks.length,
          ...metadata
        }
      });
    }

    // 6. Atualizar status do documento
    await updateDocument(doc.id, {
      status: 'completed',
      metadata
    });

  } catch (error) {
    await updateDocument(doc.id, {
      status: 'failed',
      errorMessage: error.message
    });
    throw error;
  }
}
```

**Estratégia de Processamento:**
- **Síncrono (<2MB):** Processar na request do upload
- **Assíncrono (>2MB):** Usar Vercel Serverless Functions com timeout estendido
- **Muito grande (>10MB):** Considerar queue (Vercel KV + cron) ou processamento em chunks

**UI de Upload:**
- Drag & drop zone
- Preview de arquivos antes do upload
- Barra de progresso
- Status de processamento em tempo real (polling ou WebSockets)
- Lista de documentos processados com busca/filtro

---

## Fase 3: Sistema de Tools Extensível (Prioridade MÉDIA)

### 3.1 Tool Registry (MCP Pattern)

**Objetivo:** Permitir registro dinâmico de tools ao invés de inline

**Novos Arquivos:**
```
lib/
  ai/
    tools/
      registry.ts        # Registro central de tools
      types.ts           # TypeScript interfaces para tools
      base-tool.ts       # Classe base para tools

      # Tools existentes refatorados
      understand-query.ts
      get-information.ts
      add-resource.ts

      # Novos tools
      web-search.ts      # Busca na web (Brave/Serper API)
      calculator.ts      # Cálculos matemáticos
      code-executor.ts   # Executar código Python/JS
      weather.ts         # Clima atual (OpenWeather API)
```

**Implementação: registry.ts**
```typescript
import { z } from "zod";
import { tool } from "ai";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  execute: (input: any, context: ToolContext) => Promise<any>;
  permissions?: string[]; // ex: ['admin', 'premium']
}

export interface ToolContext {
  userId: string;
  conversationId: string;
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(toolDef: ToolDefinition) {
    this.tools.set(toolDef.name, toolDef);
  }

  getAll() {
    return Array.from(this.tools.values());
  }

  // Converte para formato Vercel AI SDK
  toVercelTools(context: ToolContext) {
    const vercelTools: Record<string, any> = {};

    for (const [name, def] of this.tools) {
      vercelTools[name] = tool({
        description: def.description,
        inputSchema: def.inputSchema,
        execute: (input) => def.execute(input, context),
      });
    }

    return vercelTools;
  }
}

export const toolRegistry = new ToolRegistry();
```

**Registro de Tools:**
```typescript
// lib/ai/tools/understand-query.ts
import { toolRegistry } from "./registry";
import { z } from "zod";

toolRegistry.register({
  name: "understandQuery",
  description: "Understand the user's query. Use this tool on every prompt.",
  inputSchema: z.object({
    query: z.string(),
    toolsToCallInOrder: z.array(z.string()),
  }),
  execute: async ({ query }) => {
    // Lógica existente de generateObject
    // ...
  }
});
```

**Modificação: app/(preview)/api/chat/route.ts**
```typescript
import { toolRegistry } from "@/lib/ai/tools/registry";

export async function POST(req: Request) {
  const user = await getUser();
  const { messages, conversationId } = await req.json();

  const result = streamText({
    model: "openai/gpt-4o",
    messages: convertToModelMessages(messages),
    system: `...`,
    tools: toolRegistry.toVercelTools({
      userId: user.id,
      conversationId
    }),
  });

  return result.toUIMessageStreamResponse();
}
```

**Benefits:**
- Fácil adicionar novos tools sem modificar route
- Permite desabilitar tools por usuário (permissões)
- Facilita testes unitários de tools
- Suporta hot-reload de tools em desenvolvimento

---

### 3.2 Novos Tools Úteis

**Web Search Tool (Brave API):**
```typescript
// lib/ai/tools/web-search.ts
toolRegistry.register({
  name: "webSearch",
  description: "Search the web for current information",
  inputSchema: z.object({
    query: z.string(),
    numResults: z.number().default(5),
  }),
  execute: async ({ query, numResults }) => {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`,
      {
        headers: {
          'X-Subscription-Token': process.env.BRAVE_API_KEY!
        }
      }
    );
    const data = await response.json();
    return data.web.results.map(r => ({
      title: r.title,
      url: r.url,
      description: r.description
    }));
  }
});
```

**Calculator Tool:**
```typescript
toolRegistry.register({
  name: "calculator",
  description: "Perform mathematical calculations",
  inputSchema: z.object({
    expression: z.string(),
  }),
  execute: async ({ expression }) => {
    // Usar mathjs ou eval seguro
    const math = await import('mathjs');
    return math.evaluate(expression);
  }
});
```

**UI para Gerenciar Tools:**
- Admin panel para habilitar/desabilitar tools
- Configurar API keys por tool
- Logs de uso de tools (rate limiting)

---

## Fase 4: Integrações Externas (Prioridade BAIXA)

### 4.1 Sistema de Integrações Configuráveis

**Objetivo:** Conectar com APIs externas de forma genérica

**Migration: 0004_add_integrations.sql**
```sql
CREATE TABLE integrations (
  id varchar(191) PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name varchar(100) NOT NULL,       -- 'openweather', 'slack', etc
  type varchar(50) NOT NULL,        -- 'api', 'webhook', 'oauth'
  config jsonb NOT NULL,            -- API keys, endpoints, etc
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_integrations_user_id ON integrations(user_id);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own integrations"
  ON integrations FOR ALL
  USING (auth.uid() = user_id);
```

**Novos Arquivos:**
```
lib/
  integrations/
    client.ts          # Cliente genérico de API
    registry.ts        # Registro de integrações disponíveis
    types.ts           # Interfaces TypeScript

    providers/
      openweather.ts   # Cliente OpenWeather
      slack.ts         # Cliente Slack
      notion.ts        # Cliente Notion

components/
  integrations/
    integration-list.tsx
    integration-form.tsx
    integration-test.tsx
```

**Exemplo de Uso:**
```typescript
// lib/integrations/client.ts
export class IntegrationClient {
  async call(integrationId: string, method: string, params: any) {
    const integration = await getIntegration(integrationId);
    const provider = getProvider(integration.name);
    return provider.execute(method, params, integration.config);
  }
}

// Usar em um tool
toolRegistry.register({
  name: "getWeather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ location }, context) => {
    const integration = await findIntegration({
      userId: context.userId,
      name: 'openweather'
    });

    return integrationClient.call(integration.id, 'getCurrentWeather', { location });
  }
});
```

---

### 4.2 Webhooks

**Objetivo:** Permitir que eventos do sistema disparem webhooks

**Migration: 0005_add_webhooks.sql**
```sql
CREATE TABLE webhooks (
  id varchar(191) PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL,        -- ['message.created', 'document.processed']
  secret varchar(255),           -- Para validar payloads
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE webhook_logs (
  id varchar(191) PRIMARY KEY,
  webhook_id varchar(191) REFERENCES webhooks(id),
  event_type varchar(100),
  payload jsonb,
  response_status integer,
  error_message text,
  created_at timestamp DEFAULT now()
);
```

**Implementação:**
```typescript
// lib/webhooks/trigger.ts
export async function triggerWebhooks(event: {
  type: string;
  userId: string;
  data: any;
}) {
  const webhooks = await getActiveWebhooks({
    userId: event.userId,
    eventType: event.type
  });

  await Promise.all(webhooks.map(async (webhook) => {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signPayload(event.data, webhook.secret)
        },
        body: JSON.stringify(event.data)
      });

      await logWebhook({
        webhookId: webhook.id,
        eventType: event.type,
        payload: event.data,
        responseStatus: response.status
      });
    } catch (error) {
      await logWebhook({
        webhookId: webhook.id,
        eventType: event.type,
        payload: event.data,
        errorMessage: error.message
      });
    }
  }));
}
```

**Eventos Disponíveis:**
- `message.created` - Nova mensagem na conversa
- `document.uploaded` - Documento uploadado
- `document.processed` - Processamento de documento concluído
- `conversation.created` - Nova conversa criada
- `tool.executed` - Tool executado

---

## Segurança e Performance

### Segurança

**Validação de Inputs:**
- Todos os inputs validados com Zod
- Sanitização de conteúdo de documentos
- Rate limiting em endpoints críticos (`@upstash/ratelimit`)

**Proteção de Dados:**
- RLS (Row Level Security) em todas as tabelas
- Criptografia de API keys no banco (`pg_crypto`)
- Tokens JWT com expiração curta (1h) + refresh tokens

**Upload Security:**
- Validação de MIME types no servidor
- Scan de malware com ClamAV (opcional)
- Limite de tamanho por usuário (quota)

**API Keys:**
- Armazenar em variáveis de ambiente
- Nunca expor no client-side
- Rotação periódica

### Performance

**Caching:**
- Cache de embeddings (evitar recálculo)
- Redis/Vercel KV para session data
- ISR para páginas estáticas

**Database Optimization:**
- Indexes em colunas de filtro frequente
- Particionamento de `embeddings` por `user_id` (se muitos usuários)
- Connection pooling com PgBouncer

**Embedding Optimization:**
- Batch processing de embeddings (até 100 chunks por vez)
- Deduplicação de chunks idênticos
- Lazy loading de documentos antigos

**Query Optimization:**
```typescript
// Otimizar findRelevantContent para filtrar por user
export const findRelevantContent = async (userQuery: string, userId: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;

  const similarGuides = await db
    .select({ name: embeddings.content, similarity })
    .from(embeddings)
    .where(and(
      eq(embeddings.userId, userId),  // Filtrar por usuário ANTES da similaridade
      gt(similarity, 0.3)
    ))
    .orderBy((t) => desc(t.similarity))
    .limit(4);

  return similarGuides;
};
```

---

## Ordem de Implementação Recomendada

### Sprint 1 (Semana 1) - Fundação
1. **Setup Supabase Auth**
   - Configurar cliente Supabase
   - Implementar middleware
   - Criar páginas de login/callback
   - Adicionar RLS policies

2. **Histórico de Conversas**
   - Migrations de conversations + messages
   - Server actions CRUD
   - Modificar API route para salvar mensagens
   - UI: Sidebar com lista de conversas

**Entregável:** Usuários podem fazer login e suas conversas são salvas

---

### Sprint 2 (Semana 2) - Upload de Documentos
3. **Setup UploadThing**
   - Configurar UploadThing
   - Criar API route
   - UI de upload com drag & drop

4. **Document Processing**
   - Implementar parsers (PDF, DOCX, TXT, MD)
   - Integrar LangChain text splitter
   - Processamento assíncrono
   - UI de status de processamento

**Entregável:** Usuários podem fazer upload de documentos e eles são processados em embeddings

---

### Sprint 3 (Semana 3) - Sistema de Tools
5. **Tool Registry**
   - Criar registry abstrato
   - Refatorar tools existentes
   - Testes unitários de tools

6. **Novos Tools**
   - Web Search (Brave API)
   - Calculator
   - Weather (opcional)

**Entregável:** Sistema extensível de tools funcionando + 2-3 novos tools úteis

---

### Sprint 4 (Semana 4) - Integrações
7. **Sistema de Integrações**
   - Cliente genérico de API
   - UI para adicionar integrações
   - Providers: OpenWeather, Slack

8. **Webhooks**
   - Sistema de webhooks
   - Logs de execução
   - UI de gerenciamento

**Entregável:** Sistema de integrações configuráveis + webhooks funcionais

---

## Variáveis de Ambiente Necessárias

```env
# Existing
DATABASE_URL=postgres://...
AI_GATEWAY_API_KEY=sk_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# UploadThing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=xxx

# APIs Externas (opcional)
BRAVE_API_KEY=BSA...
OPENWEATHER_API_KEY=xxx
```

---

## Setup do Vercel (CONCLUÍDO ✅)

**Status:** Projeto configurado e linkado ao Vercel

**Informações:**
- **CLI:** Vercel CLI v49.1.2 instalado
- **Usuário:** gabrielgfcramos
- **Projeto:** gabriel-ramos-projects-c715690c/sofia-mvp
- **Plano:** Hobby
- **Arquivos Criados:**
  - `.vercel/` - Configuração do projeto
  - `.env.local` - Variáveis de desenvolvimento baixadas

**Variáveis Configuradas no Vercel:**
- ✅ `OPENAI_API_KEY` - Disponível em Production, Preview, Development

**Comandos Úteis:**
```bash
# Adicionar nova variável de ambiente
vercel env add VARIABLE_NAME

# Remover variável de ambiente
vercel env rm VARIABLE_NAME

# Baixar variáveis atualizadas
vercel env pull

# Deploy para production
vercel --prod

# Deploy para preview
vercel
```

**Próximos Passos de Configuração:**
Após configurar Supabase e UploadThing, adicionar as variáveis ao Vercel:
```bash
# Fase 1 - Supabase
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Fase 2 - UploadThing
vercel env add UPLOADTHING_SECRET
vercel env add UPLOADTHING_APP_ID

# Fase 3/4 - APIs (opcional)
vercel env add BRAVE_API_KEY
vercel env add OPENWEATHER_API_KEY
```

---

## Arquivos Críticos para Modificação

### Modificar:
1. `/Users/gabrielramos/sofia-mvp/app/(preview)/api/chat/route.ts`
   - Adicionar auth check
   - Integrar tool registry
   - Salvar mensagens no banco

2. `/Users/gabrielramos/sofia-mvp/lib/ai/embedding.ts`
   - Adicionar filtro por `userId`
   - Suporte a metadata de documentos

3. `/Users/gabrielramos/sofia-mvp/lib/db/schema/resources.ts`
   - Adicionar `userId`, `documentId`, `metadata`

4. `/Users/gabrielramos/sofia-mvp/app/(preview)/page.tsx`
   - Adicionar sidebar de conversas
   - Gerenciar estado de conversa ativa
   - UI de upload de documentos

5. `/Users/gabrielramos/sofia-mvp/lib/env.mjs`
   - Adicionar novas variáveis de ambiente

6. `/Users/gabrielramos/sofia-mvp/lib/actions/resources.ts`
   - Incluir `userId` em createResource
   - Validar permissões

### Criar:
- `/lib/supabase/` (server.ts, client.ts, middleware.ts)
- `/lib/db/schema/` (conversations.ts, messages.ts, documents.ts, integrations.ts)
- `/lib/ai/tools/` (registry.ts, base-tool.ts, + tools individuais)
- `/lib/ai/document-processor.ts`
- `/components/chat/` (conversation-list, message-bubble)
- `/components/documents/` (upload-button, document-list)
- `/app/(auth)/` (login, callback)
- `/app/api/uploadthing/` (core.ts, route.ts)

---

## Dependências Adicionais

```bash
pnpm add @supabase/ssr@^0.5.2 @supabase/supabase-js@^2.47.10
pnpm add uploadthing@^7.4.2 @uploadthing/react@^7.4.2
pnpm add pdf-parse@^1.1.1 mammoth@^1.8.0
pnpm add langchain@^0.3.11 @langchain/textsplitters@^0.1.0
pnpm add mathjs@^14.0.1
pnpm add @upstash/ratelimit@^2.0.4 @upstash/redis@^1.34.3
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Timeout no processamento de documentos grandes | Alta | Alto | Usar Vercel Functions com timeout 60s + queue para >10MB |
| Custos elevados de embeddings | Média | Médio | Cache + limite 100MB/user/mês + deduplicação |
| Complexidade de RLS | Média | Alto | Service role key fallback + testes automatizados |
| Performance de busca vetorial com muitos usuários | Baixa | Alto | Particionamento + HNSW index + filtro precoce por userId |
| Segurança de uploads (malware) | Baixa | Crítico | Validação MIME + ClamAV scan + UploadThing's built-in scanning |

---

## Métricas de Sucesso

**Funcionalidade:**
- ✅ Usuários podem fazer login/signup
- ✅ Conversas são salvas e recuperadas
- ✅ Documentos são processados em <30s (para <5MB)
- ✅ Busca semântica retorna resultados relevantes (similarity >0.3)
- ✅ Tools executam sem erros

**Performance:**
- Tempo de resposta do chat: <3s para primeira resposta
- Upload + processamento: <30s para PDFs de até 5MB
- Busca vetorial: <500ms para queries

**Segurança:**
- Zero vazamentos de dados entre usuários (validar com testes)
- Todas as API keys armazenadas seguramente
- Rate limiting ativo (100 req/min por usuário)

---

## Próximos Passos Após MVP

**Melhorias Futuras:**
- Suporte a imagens (OCR com Tesseract)
- Conversas compartilháveis (public links)
- Exportação de conversas (PDF, MD)
- Análise de sentimento
- Suporte multilíngue
- Mobile app (React Native)
- Voice input/output
- Collaborative chat (múltiplos usuários)
- Plugin marketplace (tools de terceiros)

**Infraestrutura:**
- Monitoramento com Sentry
- Analytics com PostHog
- Logging estruturado com Winston
- Testes E2E com Playwright
- CI/CD com GitHub Actions
- Preview deployments para PRs

---

## Conclusão

Este plano fornece uma roadmap completa para transformar o MVP Sofia de um RAG chatbot simples em uma plataforma robusta de assistente pessoal com:
- Autenticação segura
- Persistência de conversas
- Processamento inteligente de documentos
- Sistema extensível de ferramentas
- Integrações configuráveis

A implementação seguirá padrões já estabelecidos no projeto (Drizzle ORM, Vercel AI SDK, Shadcn UI) garantindo consistência e manutenibilidade.

**Estimativa Total:** 4 sprints (4 semanas) para MVP completo funcional.
