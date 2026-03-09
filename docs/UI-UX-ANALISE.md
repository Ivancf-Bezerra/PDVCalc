# Análise e correções UI/UX – Precificação Doces

Documento de referência para alinhar a interface às boas práticas de UI/UX e acessibilidade.  
**Design system:** Soft Doceria clássica (light/dark, fontes sem serifa).

---

## 1. Acessibilidade (WCAG 2.1)

### 1.1 Foco visível
- **Recomendação:** Todo elemento interativo deve ter indicador de foco visível ao navegação por teclado.
- **Aplicado:**
  - `.btn:focus-visible` e `.tab-btn:focus-visible` → `box-shadow: var(--hy-glow-primary)`.
  - `.btn-danger` / `.btn-outline-danger:focus-visible` → `var(--hy-glow-danger)`.
  - `.help-icon:focus-visible` → glow primário.
  - `tr.recipe-row:focus-visible` → outline 2px na cor primária (linha clicável).
  - Inputs, select e textarea já tinham foco com borda e glow.
- **Evitar:** `outline: none` sem alternativa (o reset global usa `outline: none`; o foco é restaurado apenas em `:focus-visible`).

### 1.2 Área de toque (touch targets)
- **Recomendação:** Mínimo ~44×44 px para elementos clicáveis (WCAG 2.5.5).
- **Aplicado:**
  - `.help-icon`: `min-width: 32px; min-height: 32px` (ícone 18×18, área de toque maior).
  - `.btn-icon`: 32×32 px (abaixo do ideal; aceitável em contexto desktop).
- **Sugestão futura:** Em layout mobile, considerar botões/ícones ≥ 44 px onde possível.

### 1.3 Contraste
- **Texto corpo** `#4a304f` em `#fffafc` (light) e **títulos** `#2b102f`: contraste adequado.
- **Tema dark:** `#e0d4de` e `#f0e6ef` sobre `#1a1520` / `#251f2e`: verificar com ferramenta de contraste se necessário.

---

## 2. Consistência visual

### 2.1 Tokens de espaçamento
- Uso de `--hy-space-xs` a `--hy-space-xl` em novos componentes.
- **Aplicado:** `.explain-box` com `padding` e `margin-top` usando `var(--hy-space-sm)`.

### 2.2 Border radius
- **Token:** `--hy-radius: 0.25rem`.
- **Aplicado:**
  - Inputs, select, textarea: `border-radius: var(--hy-radius)` (substituído `0.2rem` fixo).
  - Botões e `.from-bank-select`: `var(--hy-radius)`.
  - `.help-icon`: `border-radius: var(--hy-radius)`.

### 2.3 Hierarquia tipográfica
- Títulos: `--hy-text-title`, peso 700/800.
- Corpo: `--hy-text-body`, ~0.8125rem.
- Section titles: 0.7rem, uppercase, letter-spacing.
- Mantido consistente no design system atual.

---

## 3. Componentes e padrões

### 3.1 Cards
- `box-sizing: border-box`, `min-height: 0` para comportamento correto em flex/grid.
- Aside: `.aside-card` e `.aside-block` com `flex-shrink: 0` para não comprimir no scroll.

### 3.2 Tabelas
- Scroll apenas no corpo (`.table-scroll-body`); cabeçalho fixo.
- `overscroll-behavior: contain` para não propagar scroll à página.

### 3.3 Sidebar
- Altura `calc(100vh - var(--hy-header-height))`, `position: sticky`, alinhada ao container.

---

## 4. O que não foi alterado (por ausência de doc específico)

- Cores da paleta (Soft Doceria já definida).
- Tamanhos de fonte base.
- Larguras do grid (1fr 280px, 1320px container).
- Ordem de elementos no layout (page header, main, aside).

---

## 5. Próximos passos sugeridos

1. **Documento de design system** formal (cores, tipografia, espaçamentos, componentes) em `docs/` ou em ferramenta de design.
2. **Testes de contraste** com ferramenta (e.g. Contrast Checker) nos temas light e dark.
3. **Teste de navegação por teclado** (Tab, Enter, setas) em todas as telas.
4. **Mobile:** revisar touch targets e hierarquia em breakpoint ≤ 992px.

---

*Última atualização: análise e correções aplicadas com base em boas práticas UI/UX e WCAG 2.1, na ausência de documento de especificação próprio do projeto.*
