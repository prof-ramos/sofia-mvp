# Add shadcn/ui Component Command

Adiciona um novo componente shadcn/ui ao projeto seguindo o setup de `components.json` (style "new-york", baseColor "zinc", aliases `@/components` e `@/lib/utils`).

## Usage
- Para componentes existentes no catálogo shadcn/ui.
- Para variantes customizadas (ex.: Button com ícone), use o template e ajuste as classes tailwind.
- Sempre gerar os arquivos dentro de `components/` e `components/ui/`.

## Pré-requisitos
- Tailwind já configurado em `globals.css` e `postcss.config.mjs`.
- shadcn CLI usa `components.json` na raiz (já presente).
- Garantir que `pnpm` é o package manager.

## Passos

### 1) Instalar/atualizar a CLI (se necessário)
```
pnpm dlx shadcn-ui@latest init
```
- Mantém as opções padrão do `components.json` atual.

### 2) Adicionar componente
```
pnpm dlx shadcn-ui@latest add <componente>
```
Exemplos:
- `pnpm dlx shadcn-ui@latest add button`
- `pnpm dlx shadcn-ui@latest add input label textarea`

### 3) Confirmar paths e aliases
- Arquivos gerados devem ficar em `components/ui/`.
- Imports devem usar `@/components/ui/...` e utilidades `@/lib/utils`.
- Se a CLI gerar caminho diferente, mover para `components/ui/` e ajustar imports.

### 4) Garantir compatibilidade com Next.js 15 + RSC
- Componentes client precisam de `"use client"` na primeira linha.
- Evitar imports CSS fora de `app/(preview)/layout.tsx`.
- Prefira props tipadas com TypeScript (React 19) e `VariantProps` do `class-variance-authority` quando aplicável.

### 5) Variantes e temas
- Seguir estilo "new-york" e baseColor "zinc" para consistência.
- Para temas escuros, reutilizar tokens existentes (sem criar novos CSS globais).

### 6) Testar visualmente
- Rodar `pnpm dev` e validar em `http://localhost:3000/` (página preview do chat) ou na rota específica onde o componente será usado (ex.: `/chat/preview`).
- Conferir estados hover/focus/disabled e acessibilidade (aria-label quando aplicável).

## Template de componente customizado
Use para componentes simples não cobertos pelo catálogo (manter tailwind e cva quando houver variantes):
```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CustomProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted";
}

const CustomBlock = React.forwardRef<HTMLDivElement, CustomProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClass =
      variant === "muted"
        ? "bg-zinc-100 text-zinc-700"
        : "bg-white text-zinc-900 shadow-sm";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-zinc-200 px-4 py-3 transition-colors",
          variantClass,
          className
        )}
        {...props}
      />
    );
  }
);
CustomBlock.displayName = "CustomBlock";

export { CustomBlock };
```

## Checklist de conformidade
- [ ] Usa `"use client"` quando interativo.
- [ ] Imports com aliases `@/components` e `@/lib/utils`.
- [ ] Sem CSS global novo; apenas classes Tailwind.
- [ ] Variantes documentadas no componente.
- [ ] Tipos explicitamente definidos (React 19 + TS strict).
