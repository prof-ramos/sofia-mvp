# Brand Kit — ASOF

Diretrizes para identidade visual e experiência do site da Associação Nacional dos Oficiais de Chancelaria (ASOF).

## Identidade e propósito
- Tom: institucional, elegante, com foco em credibilidade e clareza.
- Bordas: `rounded-sm` consistente em cards, botões, badges e inputs.
- Textura: grades e overlays sutis para profundidade sem ruído.

## Paleta de cores
- Primária: `#040920` (principal) / `#0D2A4A` (escura) para fundos sólidos, header e CTAs principais.
- Acento: `#82b4d6` (principal) / `#a0c8e4` (clara) para destaques, CTAs secundários e hovers.
- Neutro: `#e7edf4` para fundos suaves e ícones de suporte; texto e bordas com `text-slate-*` e `border-slate-*`.
- Seleção: fundo `accent` com texto `primary`. Gradientes de CTA: `from-primary-dark to-accent`.
- Hero overlay: `bg-primary/70` + `bg-gradient-to-t from-primary/90 via-transparent`.

## Tipografia
- Fontes (Next Font): títulos com `Playfair Display` (`--font-playfair`, 400/600/700, normal/itálico); corpo com `Inter` (`--font-inter`, 300/400/500/600).
- Uso: títulos/destaques `font-serif`; corpo/navegação/botões `font-sans`; navegação e selos em uppercase com `tracking-[0.2em]` ou `tracking-widest`.
- Escala (Tailwind extend): `xs 12/1.2`, `sm 14/1.4`, `base 16/1.5`, `lg 18/1.5`, `xl 20/1.6`, `2xl 24/1.6`, `3xl 30/1.5`, `4xl 36/1.4`, `5xl 48/1.3`, `6xl 60/1.2`, `7xl 72/1.1`. Comprimento de linha ideal: `max-w-prose` (~65ch).

## Layout, grid e espaçamento
- Grid: 4 colunas mobile, 8 tablet, 12 desktop; gutter 16px; margem 24px.
- Espaçamento 8pt: `4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 72, 80, 96`; seções padrão `py-24`.
- Container: `container mx-auto px-6`; heros centralizados com `max-w-2xl/3xl`. Gaps de listas: 16–24px (`gap-8`).
- Z-index: base 0, dropdown 10, sticky 20, header 50, overlay 90, modal 100.

## Componentes
- Header fixo: topo `bg-primary/80` com texto claro; scrolled `bg-white/95` com `shadow-sm`; navegação uppercase; dropdowns com `border` leve e `shadow-lg`.
- Botões (variantes): `primary` (bg primary, texto branco), `outline` (borda primary), `highlight` (bg accent), `ghost` (bg branco/borda slate). Tamanhos: alturas 48/50/52px, paddings `px-8/10/12`; uppercase, `tracking-wide`, hover scale 1.05 e tap 0.95 (respeita `prefers-reduced-motion`).
- Badges: uppercase `text-sm`, `font-bold`, `rounded-sm`; padrão `bg-white/90 text-primary`, acento `bg-accent text-primary`.
- Cards: base `bg-white p-6 shadow-sm` → hover `shadow-md`. IconCard com borda superior `accent` no hover e disco `bg-neutral → bg-accent`; NewsCard com imagem `aspect-[4/3]`, `rounded-sm`, `grayscale-[0.2]`, zoom no hover, título serif.
- Seções: Hero fullscreen com overlays, badge translúcida, títulos serif itálicos em acento e botões duplos; About 50/50 com imagem grayscale hover color; Pillars em fundo `neutral` com `border-y` suave e grid 3 colunas desktop; CTA com gradiente primário→acento e grid decorativo em SVG; Footer em `primary` com divisórias `primary-dark` e ícones circulares.

## Motion e interações
- Variáveis globais (easings e durações) em `app/globals.css`; Framer Motion centralizado (`lib/motion-config.ts` / `lib/motion-variants.ts`): easing `[0.22, 1, 0.36, 1]`, tempos 150–1200ms.
- Variantes: `fadeIn*`, `scaleIn`, `staggerContainer`, `hoverLift/Scale/Glow`, `hero*`, `iconFloat`, `pulseSubtle`. Scroll reveal: `viewport amount 0.2, once true`.
- `prefers-reduced-motion`: desativar tilts/escala/anim. pesadas.

## Acessibilidade
- Contraste alvo WCAG 2.1: textos normais ≥4.5:1, grandes ≥3:1.
- Tamanhos de toque: botões ≥48px; espaçamento entre botões 16–24px.
- Foco: `focus:ring-2 focus:ring-primary focus:ring-offset-2` em botões; inputs com `focus:ring-accent`.

## Formulários e campos
- Inputs newsletter: `bg-primary-dark`, texto branco, `px-4 py-2`, `rounded-l-sm`, placeholder `neutral/50`; botão acoplado `bg-accent text-primary` com hover `accent/90`.
- Labels ocultos via `sr-only` quando necessário.

## Ícones e imagens
- Ícones `lucide-react` (24–32px em cards). Imagens com `next/image`, foco institucional/Itamaraty; overlays de cor para contraste; `grayscale` 20–30% para coerência.
- CTA decorada com padrões de grade (stroke branco opaco).

## Texto e capitalização
- Navegação/badges/datas em uppercase com tracking amplo; títulos serif `leading-tight`; corpo `font-light/regular` com `leading-relaxed`.

## Divisórias, bordas e sombras
- Bordas discretas `border-slate-200/300`; sombras `shadow-sm` padrão, `shadow-md/lg` em hover ou overlays/dropdowns.

## Social e e-mail
- Tom: institucional, claro, direto; voz ativa. Títulos `Playfair`, corpo/botões `Inter`.
- Fundos: `#040920` ou `#e7edf4`; gradiente `from-primary-dark to-accent` permitido; fotos com overlay `primary/70–80`.
- Logos: fundo `primary` (logo branco) ou fundo claro (logo primary); cantos `rounded-sm`.
- Dimensões: Instagram 1080x1080/1350, Stories 1080x1920; X 1600x900 (header 1500x500, área segura 1120x360); LinkedIn 1200x1200 (capas 1128x191/1584x396); e-mail 600–640px de largura (exportar 2x quando possível).
- Tipos em arte: corpo ≥32px mobile, títulos ≥44px; contraste AA; uppercase apenas em selos/datas; tracking aberto em selos/CTA.
- CTAs: verbos no infinitivo (“Acesse”, “Leia”, “Inscreva-se”); botões `primary` ou `accent` com texto branco/primary, altura ~50px, `rounded-sm`, hover mais escuro ou `accent`.
- Acessibilidade: alt text/legendas, contraste ≥4.5:1, respeitar áreas seguras de corte/previews.
- Hashtags: 2–5 relevantes; assinatura curta “ASOF — Oficiais de Chancelaria”.
