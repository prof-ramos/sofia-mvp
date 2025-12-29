# Add Server Action Command

Cria uma Server Action com validação Zod e error handling seguindo os padrões do projeto.

## Usage

Server Actions são funções server-side que podem ser chamadas diretamente de componentes client. Este command cria actions type-safe com validação automática.

## Steps

### 1. Determinar localização
**Path**: `lib/actions/[schemaName].ts`
- Se arquivo existe: adicionar nova action
- Se não existe: criar arquivo novo com "use server" directive

### 2. Imports necessários
```typescript
"use server";

import { tableName, insertTableNameSchema, type NewTableNameParams } from "@/lib/db/schema/tableName";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
```

### 3. Tipos de operações

**CREATE**: Inserir novo registro
**UPDATE**: Atualizar registro existente
**DELETE**: Remover registro
**QUERY**: Buscar registros (read-only)

### 4. Implementar validação
- Usar Zod schema para validar input
- Try-catch para error handling
- Retornar mensagens user-friendly

### 5. Database operations
- `.insert().values().returning()` para CREATE
- `.update().set().where().returning()` para UPDATE
- `.delete().where().returning()` para DELETE
- `.select().from().where()` para QUERY

## Template CREATE

```typescript
"use server";

import {
  tableName,
  insertTableNameSchema,
  type NewTableNameParams,
} from "@/lib/db/schema/tableName";
import { db } from "@/lib/db";
import { ZodError } from "zod";

export const createTableName = async (input: NewTableNameParams) => {
  try {
    const validatedData = insertTableNameSchema.parse(input);

    const [result] = await db
      .insert(tableName)
      .values(validatedData)
      .returning();

    return "Created successfully.";
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((i) => i.message).join("; ");
    }
    return error instanceof Error && error.message.length > 0
      ? error.message
      : "Error creating. Please try again.";
  }
};
```

## Template UPDATE

```typescript
import { eq } from "drizzle-orm";

export const updateTableName = async (
  id: string,
  input: Partial<NewTableNameParams>
) => {
  try {
    const [result] = await db
      .update(tableName)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tableName.id, id))
      .returning();

    if (!result) {
      return "Record not found.";
    }

    return "Updated successfully.";
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : "Error updating. Please try again.";
  }
};
```

## Template DELETE

```typescript
import { eq } from "drizzle-orm";

export const deleteTableName = async (id: string) => {
  try {
    const [result] = await db
      .delete(tableName)
      .where(eq(tableName.id, id))
      .returning();

    if (!result) {
      return "Record not found.";
    }

    return "Deleted successfully.";
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : "Error deleting. Please try again.";
  }
};
```

## Template QUERY

```typescript
import { eq, and, or, gt, like } from "drizzle-orm";

export const getTableNameById = async (id: string) => {
  try {
    const result = await db
      .select()
      .from(tableName)
      .where(eq(tableName.id, id));

    return result;
  } catch (error) {
    throw new Error("Error fetching record.");
  }
};

export const getTableNameByFilters = async (filters: {
  name?: string;
  createdAfter?: Date;
}) => {
  try {
    const conditions = [];

    if (filters.name) {
      conditions.push(like(tableName.name, `%${filters.name}%`));
    }

    if (filters.createdAfter) {
      conditions.push(gt(tableName.createdAt, filters.createdAfter));
    }

    const results = await db
      .select()
      .from(tableName)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return results;
  } catch (error) {
    throw new Error("Error fetching records.");
  }
};
```

**Nota**: Padrão consistente de erro: queries e mutations devem lançar objetos Error para serem tratados com try/catch pelos chamadores.

## Example Usage

### Arquivo completo com CRUD

```typescript
"use server";

import {
  products,
  insertProductsSchema,
  type NewProductsParams,
} from "@/lib/db/schema/products";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

// CREATE
export const createProduct = async (input: NewProductsParams) => {
  try {
    const validatedData = insertProductsSchema.parse(input);

    const [result] = await db
      .insert(products)
      .values(validatedData)
      .returning();

    return { success: true, message: "Product created successfully." };
  } catch (error) {
    return { success: false, message: error instanceof Error && error.message.length > 0
      ? error.message
      : "Error creating product." };
  }
};

// UPDATE
export const updateProduct = async (
  id: string,
  input: Partial<NewProductsParams>
) => {
  try {
    const [result] = await db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (!result) {
      return { success: false, message: "Product not found." };
    }

    return { success: true, message: "Product updated successfully." };
  } catch (error) {
    return { success: false, message: error instanceof Error && error.message.length > 0
      ? error.message
      : "Error updating product." };
  }
};

// DELETE
export const deleteProduct = async (id: string) => {
  try {
    const [result] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!result) {
      return { success: false, message: "Product not found." };
    }

    return { success: true, message: "Product deleted successfully." };
  } catch (error) {
    return { success: false, message: error instanceof Error && error.message.length > 0
      ? error.message
      : "Error deleting product." };
  }
};

// QUERY
export const getProductById = async (id: string) => {
  try {
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    return result;
  } catch (error) {
    throw new Error("Error fetching product.");
  }
};
```

### Usando em componentes

```typescript
"use client";

import { createProduct } from "@/lib/actions/products";
import { toast } from "sonner";

export default function ProductForm() {
  const handleSubmit = async (formData: FormData) => {
    const result = await createProduct({
      name: formData.get("name") as string,
      price: parseInt(formData.get("price") as string),
      description: formData.get("description") as string,
    });

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <form action={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

## Advanced Patterns

### Transaction (múltiplas operações)

```typescript
export const createProductWithReview = async (
  productData: NewProductsParams,
  reviewData: NewReviewsParams
) => {
  try {
    await db.transaction(async (tx) => {
      try {
        const [product] = await tx
          .insert(products)
          .values(productData)
          .returning();

        await tx
          .insert(reviews)
          .values({ ...reviewData, productId: product.id });
      } catch (error) {
        throw error; // rethrow para que a transaction seja revertida
      }
    });

    return "Product and review created successfully.";
  } catch (error) {
    return "Error creating product and review.";
  }
};
```

Nota: Use `.transaction()` para garantir atomicidade; prefira transactions quando há múltiplas operações dependentes que devem ser todas bem-sucedidas ou nenhuma.

### Batch operations

```typescript
export const createMultipleProducts = async (
  inputs: NewProductsParams[]
) => {
  try {
    // Validar todos os inputs antes de inserir (fail fast)
    const validatedData = inputs.map((input) =>
      insertProductsSchema.parse(input)
    );

    await db.insert(products).values(validatedData);

    return `Created ${inputs.length} products successfully.`;
  } catch (error) {
    return "Error creating products: " + (error instanceof Error ? error.message : "Unknown error");
  }
};
```

Nota: Valide todo o array de input com Zod antes de chamar db.insert() para falhar rapidamente em caso de erro e reportar erros de validação de forma clara.

## Notes

- **SEMPRE** usar `"use server"` directive no topo do arquivo
- Validar input com Zod antes de DB operations
- Usar `.returning()` para obter dados inseridos/atualizados
- Retornar strings (não throw errors) para melhor UX
- Para Next.js: considerar `revalidatePath()` após mutations

## Related Commands

- `/add-schema` - Criar schema que esta action vai usar
- `/add-ai-tool` - Integrar action com AI tools
