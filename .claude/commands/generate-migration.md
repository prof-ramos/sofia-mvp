# Generate Migration Command

Este é um guia prático para desenvolvedores sobre como gerar e aplicar migrações DrizzleORM com Supabase/PostgreSQL.

Gera e aplica migrações do DrizzleORM com Supabase/PostgreSQL, alinhado ao schema em `lib/db/schema/*`.

## Quando usar
- Após alterar/ criar schemas em `lib/db/schema`.
- Para sincronizar o schema local com o banco configurado no `.env`.

## Pré-requisitos
- `.env` com `DATABASE_URL` configurado (Supabase ou local).
- `drizzle.config.ts` válido (já presente no projeto).
- Schema atualizado em arquivos TypeScript (sem erros de tipo).

## Passos

### 1) Verificar alterações de schema
- Atualizar/ criar tabelas em `lib/db/schema/*.ts`.
- Manter padrões: `nanoid` para IDs, timestamps, validação com `drizzle-zod` quando aplicável.
- Rodar `pnpm lint` opcionalmente para garantir tipos.

### 2) Gerar migração
```
pnpm db:generate
```
- Output em `lib/db/migrations/<timestamp>_<name>/migration.sql`.
- Revisar o SQL gerado (indexes, constraints, vector indexes se houver).

### 3) Aplicar migração no banco alvo
```
pnpm db:migrate
```
- Usa o `DATABASE_URL` atual. Confirme se é local ou Supabase antes de rodar.
- Conferir logs: deve indicar sucesso e versão aplicada.

### 4) Inspecionar estado do banco (opcional)
- `pnpm db:studio` para abrir Drizzle Studio.
- Ou usar Supabase UI para confirmar novas tabelas/colunas.

### 5) Rollback/ajustes
- Se a migração estiver errada:
  - Corrigir o schema.
  - Gerar nova migração corrigindo (ou editar a SQL manualmente se ainda não aplicada).
  - Evitar `pnpm db:drop` em banco compartilhado; use apenas em ambiente local/dev.
- Em caso de falha na migração: verifique logs da migração e do banco, confirme o SQL aplicado em `lib/db/migrations` e no banco alvo, realize rollback manual via SQL se necessário ou gere uma migração corretiva.

## Checklist
- [ ] `DATABASE_URL` correto para o ambiente alvo.
- [ ] Migração revisada manualmente antes de aplicar.
- [ ] Vetores usam `vector` + índice HNSW quando necessário.
- [ ] Campos obrigatórios têm defaults ou são manejados na aplicação.
- [ ] Após `db:migrate`, as consultas/drizzle types foram validadas (opcional `pnpm lint`).

## Snippet útil: índice HNSW para embeddings
Use em schemas que adicionarem coluna vector:
Este snippet requer a extensão pgvector habilitada no Supabase/Postgres (ou instalada localmente); certifique-se de criar a extensão (`CREATE EXTENSION IF NOT EXISTS pgvector`) ou documente essa dependência nas instruções de migração.
```sql
CREATE INDEX IF NOT EXISTS "embeddings_hnsw_idx"
ON "embeddings"
USING hnsw (embedding vector_cosine_ops);
```
Inclua no arquivo `migration.sql` quando o generative não criar automaticamente.
