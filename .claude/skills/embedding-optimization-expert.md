# Skill: Embedding Optimization Expert

Guia para otimizar ingestão, chunking e busca vetorial (pgvector) no projeto Sofia.

## Quando usar
- Criar/ajustar pipelines de embedding em `lib/ai/embedding.ts` ou novas actions.
- Tunar chunking, thresholds e indexes para melhorar relevância.
- Investigar qualidade de resultados RAG.

## Padrões do projeto
- Vetores 1536 dims (compatível com modelos OpenAI `text-embedding-3-*`).
- Armazenamento em `lib/db/schema/embeddings.ts` e `resources.ts`.
- Busca via Drizzle + pgvector (HNSW `vector_cosine_ops`).

## Playbook de ingestão
1) **Preprocessar texto**: remover espaços extras, normalizar quebras de linha.
2) **Chunking**:
   - Tamanho alvo ~300-500 tokens (aprox. 750-1200 chars) por chunk.
   - Overlap pequeno (5-10%) para manter contexto.
3) **Gerar embeddings**:
   - Usar `embedMany` para batch eficiente.
   - Tratar erros com retries exponenciais leves.
4) **Persistir**:
   - Salvar chunks com referência ao resource e metadados (ex.: título, ordem).
   - Garantir índice HNSW no campo vector.

## Playbook de busca
1) **Embeddings da query**: gerar com mesmo modelo usado na ingestão.
2) **Consulta vetorial**: ordenar por similaridade (cosine) e aplicar limite (ex.: top 5-10).
3) **Threshold**: filtrar resultados abaixo de um score mínimo (ex.: > 0.7 cosine sim, ajustar conforme dados reais).
4) **Deduplicar**: remover duplicatas por resource/slug.
5) **Truncar contexto**: limitar número de chunks concatenados para evitar estouro de tokens.

## Snippet: chunking simples
```ts
// Recomendação: ~300-500 tokens ≈ 750-1200 chars; o padrão 900 está dentro desse range
function chunkText(text: string, size = 900, overlap = 100) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size);
    chunks.push(chunk.trim());
    i += size - overlap;
  }
  return chunks.filter(Boolean);
}
```

## Snippet: inserção em lote
```ts
import { embedMany } from "@/lib/ai/embedding";
import { db } from "@/lib/db";
import { embeddings } from "@/lib/db/schema/embeddings";
import { nanoid } from "nanoid";

export async function ingest({
  resourceId,
  text,
  title,
  order,
  sourceUrl,
}: {
  resourceId: string;
  text: string;
  title?: string;
  order?: number;
  sourceUrl?: string;
}) {
  const chunks = chunkText(text);

  // Retry loop com exponential backoff
  const maxAttempts = 3;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const vectors = await embedMany(chunks);

      await db.insert(embeddings).values(
        chunks.map((content, idx) => ({
          id: nanoid(),
          resourceId,
          content,
          embedding: vectors[idx],
          title: title || null,
          order: order !== undefined ? order + idx : null,
          sourceUrl: sourceUrl || null,
        }))
      );

      return { success: true, chunksInserted: chunks.length };
    } catch (error) {
      console.error(`[ingest] Tentativa ${attempt}/${maxAttempts} falhou:`, error);

      if (attempt === maxAttempts) {
        throw new Error(`Falha ao inserir embeddings após ${maxAttempts} tentativas`);
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

## Diagnóstico de qualidade
- **Baixa relevância**: aumentar tamanho do chunk ou ajustar threshold de similaridade.
- **Respostas vagas**: aumentar topK e concatenar mais contexto (limitar tokens totais).
- **Duplicidade**: deduplicar por resource/slug antes de retornar.
- **Lentidão**: verificar índice HNSW e uso de `limit`/`select` mínimo.

## Checklist
- [ ] Mesma versão/modelo de embedding para ingestão e busca.
- [ ] Chunking consistente (tamanho + overlap) documentado.
- [ ] Índice HNSW aplicado ao campo vector.
- [ ] Threshold configurável e testado com dados reais (ex.: threshold > 0.7 para dados textuais genéricos; validar e ajustar usando métricas como F1 em conjunto de validação).
- [ ] Contexto truncado para caber no budget de tokens da resposta.
