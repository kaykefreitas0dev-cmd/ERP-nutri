# @repo/ui — Design tokens & components

Centro único de **decisões visuais** do NutriCore. Cores, fontes, espaçamentos,
sombras e bordas vivem aqui. Mudar valores aqui afeta **todos os apps** após
rebuild.

## Quando usar este pacote

| Cenário                             | Onde alterar                                        |
| ----------------------------------- | --------------------------------------------------- |
| Trocar cor primária (teal → blue)   | `src/tokens.ts` + `src/theme.css`                   |
| Trocar fonte (Geist → Inter)        | `src/tokens.ts` + `src/theme.css` + layouts         |
| Adicionar nova cor semântica        | `src/tokens.ts` + `src/theme.css` + `@theme inline` |
| Suportar dark mode                  | Adicionar `[data-theme="dark"]` em `theme.css`      |
| Criar componente compartilhado novo | `src/<componente>.tsx` + export no `package.json`   |

## Como apps consomem

Cada app importa `theme.css` no `globals.css`:

```css
/* apps/{web,patient,admin}/src/app/globals.css */
@import "tailwindcss";
@import "@repo/ui/theme.css";
```

Isso registra as cores como classes Tailwind utility:

```tsx
// ❌ Antes (hardcoded — quebra ao trocar tema)
<button className="bg-teal-700 text-white hover:bg-teal-800">
  Salvar
</button>

// ✅ Depois (semântico — segue o tema)
<button className="bg-brand-primary text-text-inverse hover:bg-brand-primary-hover">
  Salvar
</button>
```

## Tokens disponíveis

### Cores (`bg-*`, `text-*`, `border-*`)

- `brand-primary` / `-hover` / `-light` / `-dark`
- `brand-secondary` / `-hover` (admin escuro)
- `brand-accent` (destaques)
- `status-success` / `-bg` (ações OK, badges verdes)
- `status-danger` / `-bg` (delete, erro)
- `status-warning` / `-bg` (atenção, archive)
- `status-info` / `-bg`
- `surface-page` (fundo geral)
- `surface-card` (cards/modais)
- `surface-card-hover`
- `surface-border` / `-strong`
- `text-primary` / `-secondary` / `-muted` / `-inverse`

### Fontes

- `font-sans` (Geist por default)
- `font-mono` (Geist Mono)

### Radius/Shadow

Usar Tailwind defaults (`rounded-lg`, `shadow-sm`) — já consistente.

## Acesso programático

Em casos especiais (gerar PDF, SVG inline, charts), use os tokens em TS:

```ts
import { tokens } from "@repo/ui/tokens";

// em React/Tailwind, prefira classes utility acima.
// em PDF/Canvas, use tokens.brand.primary diretamente.
const pdfHeader = { fill: tokens.brand.primary };
```

## Adicionando dark mode (futuro)

Bastará editar `theme.css`:

```css
[data-theme="dark"] {
  --color-surface-page: #0f172a;
  --color-surface-card: #1e293b;
  --color-text-primary: #f1f5f9;
  /* ... overrides ... */
}
```

E setar `<html data-theme="dark">` no `layout.tsx`. Zero mudança em
componentes.

## Migração de hardcoded → tokens

Sweep recomendado quando atacar polimento visual:

```bash
# Buscar uso de cores hardcoded a serem migradas
rg "bg-teal-700|text-teal-700|bg-slate-900" apps/

# Buscar fontes
rg "font-family|Geist" apps/
```

Substituir 1 a 1 com classes semânticas (`bg-brand-primary` etc).

## Componentes shared

Stubs do Turborepo template — não usar ainda. Refazer com tokens quando
atacar polimento de UI (planejado pós-MVP).
