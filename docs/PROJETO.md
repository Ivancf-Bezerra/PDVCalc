# Doces — PDV e Precificação

Documentação completa do funcionamento do projeto.

---

## Visão Geral

Aplicação Angular para **precificação de produtos artesanais** e **ponto de venda (PDV)**, voltada para uma cafeteria/doceria em academia de CrossFit. Toda a persistência é feita em `localStorage` (sem backend).

**Stack:** Angular 21.2 · TypeScript 5.9 · SCSS · Tailwind CSS 4.2 · Preline UI · Lucide Angular (ícones) · Vitest

---

## Estrutura de Pastas

```
src/
├── main.ts                            # Bootstrap
├── styles.css                         # Tailwind + Preline
├── styles.scss                        # Design system custom (~2500 linhas)
├── app/
│   ├── app.ts / app.html              # Shell (header, sidebar, router-outlet, footer)
│   ├── app.config.ts                  # Providers, ícones Lucide
│   ├── app.routes.ts                  # Rotas
│   ├── core/                          # Serviços de estado
│   │   ├── pricing-state.service.ts   # Estado de precificação
│   │   ├── items-catalog.service.ts   # Catálogo de produtos para PDV
│   │   ├── pdv-state.service.ts       # Histórico de vendas
│   │   ├── pdv-cart.service.ts        # Carrinho ativo do PDV
│   │   ├── sidebar-submenu.service.ts # Controle de submenus da sidebar
│   │   └── header-actions.service.ts  # Bridge header ↔ precificação
│   └── features/
│       ├── pdv/                       # Componente PDV
│       └── precificacao/              # Componente Calculadora
```

---

## Rotas

| Path | Componente | Descrição |
|------|-----------|-----------|
| `/pdv` | `PdvComponent` | Ponto de venda |
| `/precificacao` | `PrecificacaoComponent` | Calculadora de precificação |
| `/` | redirect → `/pdv` | Rota padrão |
| `**` | redirect → `/pdv` | Fallback |

Ambos os componentes usam **lazy loading** (`loadComponent`).

---

## Shell da Aplicação (`App`)

### Layout

- **Header** sticky com logo "Doces", botão "Usuário" e dropdown "Funções"
- **Sidebar** fixa (260px) com navegação hierárquica e sub-itens sincronizados com abas internas
- **Conteúdo** principal via `<router-outlet>`
- **Footer** fixo com texto "Doces — PDV e Precificação. Dados salvos localmente."

### Sistema de Temas

4 temas disponíveis, persistidos em `localStorage` (chave `pricing-theme`):

| Tema | Atributo `data-theme` | Cor primária |
|------|----------------------|-------------|
| Rosa claro | `light` | `#c75a7a` |
| Rosa escuro | `dark` | `#e06888` |
| Verde claro | `green-light` | `#2d8a5c` |
| Verde escuro | `green-dark` | `#3cbc78` |

Selecionados via dropdown "Funções" no header.

### Dropdown "Funções"

- Seletor de tema (4 opções com ícone e preview)
- Ações da precificação (visíveis apenas na rota `/precificacao`):
  - Carregar dados de exemplo
  - Imprimir ficha técnica
- Botão de logout (placeholder)

---

## Módulo PDV

### Abas Internas

| Aba | ID | Função |
|-----|-----|--------|
| PDV | `tab-pdv` | Tela de venda (catálogo + carrinho) |
| Relatório do dia | `tab-daily` | Vendas do dia com total |
| Relatório mensal | `tab-monthly` | Vendas agrupadas por mês |
| BD ITEMS | `tab-bd-items` | Gerenciamento do catálogo de produtos |

### Tela de Venda (tab-pdv)

#### Barra Superior (Top Bar)

- Nome do operador
- Data e hora atuais (atualizadas a cada segundo)
- Link para a calculadora de precificação

#### Busca

- **Campo de busca textual** — filtra produtos por nome com highlight nos resultados
- **Campo de código de barras** — busca produto pelo barcode e abre modal de adição diretamente

#### Carrossel de Categorias

9 categorias com cards quadrados (5.5rem × 5.5rem), ícone colorido (32px) e nome:

| ID | Label | Ícone |
|----|-------|-------|
| `cafes` | Cafés | coffee |
| `bebidas-geladas` | Bebidas geladas | cup-soda |
| `doces` | Doces | cake |
| `salgados` | Salgados | sandwich |
| `shakes` | Shakes & Suplementos | dumbbell |
| `acai` | Açaí & Bowls | citrus |
| `fit` | Snacks Fit | zap |
| `combos` | Combos | package |
| `outros` | Outros | grid-3x3 |

- Navegação por setas laterais circulares
- **Comportamento cíclico** — ao chegar no último, a seta avança para o primeiro (e vice-versa)
- Scroll horizontal sem barra de rolagem visível

#### Seção de Produtos

- Envelopada num card (`.pdv-product-section`) com header exibindo nome da categoria e contagem
- **Grid responsivo** — `repeat(auto-fill, minmax(130px, 1fr))`
- **Cards de produto** com altura fixa (8rem):
  - Tag da categoria (subtexto discreto)
  - Nome do produto (fonte 0.875rem, bold, linha única com ellipsis)
  - Divisor horizontal
  - Preço (fonte 1rem, extra-bold, cor de sucesso)
- Hover sutil: borda primária + sombra

#### Modal de Adição de Quantidade

- Título: nome do produto
- Preço exibido
- **Stepper de quantidade** com botões − e + laterais ao input
- Campo de observação opcional
- Botões "Cancelar" e "+ Adicionar"
- Toast de feedback visual após adição ("Item adicionado ao pedido")

#### Painel de Pedido (Coluna Direita)

- **Título** "Pedido" com ícone clipboard-list
- **Header** com input de nome do cliente e número do pedido (`#N`)
- **Lista de itens** com:
  - Descrição: nome × quantidade × preço unitário = subtotal
  - Observação (se houver)
  - Botão de remover (ícone lixeira)
  - Estado vazio: "Nenhum item selecionado"
- **Resumo**:
  - Subtotal
  - Botão de desconto (abre modal)
  - **Total** em destaque
- **Ações**:
  - "Finalizar venda" (abre modal de pagamento)
  - "Limpar pedido"

#### Modal de Desconto

- Dois campos: valor absoluto (R$) e percentual (%)
- Tipo selecionável: "Valor fixo" ou "Percentual"
- Calcula e aplica o desconto no total

#### Modal de Pagamento

- Seletor de forma de pagamento: Dinheiro, Débito, Crédito, PIX, Outros
- Campo "Valor recebido" (visível apenas para Dinheiro)
- Cálculo automático do troco
- Mensagem de erro se valor insuficiente
- Ao confirmar: registra vendas, limpa carrinho, exibe modal de impressão

#### Modal de Impressão

- Pergunta "Deseja imprimir o cupom?"
- Renderiza cupom fiscal simplificado via `window.print()`

### Relatório do Dia (tab-daily)

- Tabela com vendas do dia: descrição, quantidade, preço unitário, total, hora
- Total geral do dia
- Botão para limpar vendas do dia

### Relatório Mensal (tab-monthly)

- Vendas agrupadas por mês (ano-mês)
- Expansível por mês com detalhes
- Ordenação do mais recente para o mais antigo

### BD ITEMS (tab-bd-items)

- Gerenciamento do catálogo de produtos
- CRUD: adicionar, editar preço manual, remover
- Preço pode ser o sugerido pela calculadora ou manual
- Paginação nas tabelas

---

## Módulo Precificação (Calculadora)

### Abas Internas

| Aba | ID | Função |
|-----|-----|--------|
| Receitas | `tab-recipes` | CRUD de receitas e ingredientes |
| Custos fixos | `tab-fixed` | Custos operacionais mensais |
| Taxas | `tab-fees` | Taxas percentuais e custos variáveis |
| Precificação | `tab-pricing` | Cálculo de preço final |
| Relatórios | `tab-reports` | Dashboard com métricas |
| Banco de dados | `tab-database` | Ingredientes/embalagens predefinidos |

### Receitas (tab-recipes)

- Seletor de receita com modal de busca
- Dados da receita: nome, rendimento, unidade (fatia/unidade), tempo de preparo, categoria, notas
- Tabela de ingredientes/embalagens com CRUD inline
- Cada item: nome, preço pago, quantidade total, quantidade usada, tipo
- Cálculo automático do custo de cada item: `(precoPago / qtdTotal) × qtdUsada`
- Botão "Adicionar do banco" para importar de ingredientes predefinidos

### Custos Fixos (tab-fixed)

- Horas mensais trabalhadas e dias úteis
- Valor da hora de mão de obra
- Itens de custo fixo mensal (aluguel, luz, internet, etc.) com CRUD
- Cálculo: custo fixo por hora e por unidade de cada receita

### Taxas (tab-fees)

- **Taxas percentuais**: cartão de crédito, delivery, impostos — CRUD
- **Custos variáveis fixos por unidade**: etiqueta, saco, embalagem — CRUD

### Precificação (tab-pricing)

Dois modos de cálculo:

| Modo | Descrição |
|------|-----------|
| **Por margem** | Define a margem desejada → calcula o preço sugerido: `preço = custoUnitário / (1 - taxas% - margem%)` |
| **Por mercado** | Informa o preço de mercado → calcula a margem real obtida |

### Painel Lateral (Aside)

Visível em todas as abas da precificação:

- **Decomposição do custo unitário**:
  - CMV (custo de matéria-prima)
  - Embalagem
  - Mão de obra
  - Custo fixo rateado
  - Custos variáveis por unidade
- **Resultado final**:
  - Custo unitário total
  - Preço sugerido
  - Markup
  - Lucro líquido por unidade
  - Margem real

### Relatórios (tab-reports)

- Dashboard com grid de cards de métricas
- Visão consolidada de custos e margens

### Banco de Dados (tab-database)

- CRUD de ingredientes globais (nome, preço, quantidade)
- CRUD de embalagens globais
- Usados como atalho ao adicionar itens nas receitas

### Sincronização PDV ↔ Precificação

Ao salvar dados de uma receita, o método `saveRecipeData()` sincroniza automaticamente com o catálogo do PDV via `ItemsCatalogService.syncFromRecipe()`, atualizando CMV, taxas e preço sugerido.

### Impressão de Ficha Técnica

- Renderização dinâmica de HTML com layout A4
- Estilos `@media print` dedicados
- Inclui todos os dados da receita, custos e precificação

---

## Serviços de Estado

### Persistência em localStorage

| Chave | Serviço | Conteúdo |
|-------|---------|----------|
| `pricingApp.v1` | `PricingStateService` | Receitas, custos, taxas, precificação, banco de dados |
| `pricingApp.itemsCatalog.v1` | `ItemsCatalogService` | Catálogo de produtos para venda |
| `pricingApp.pdv.v1` | `PdvStateService` | Histórico de vendas realizadas |
| `pricingApp.pdv.favorites.v1` | `PdvCartService` | IDs dos produtos favoritos |
| `pricingApp.pdv.lastOrder.v1` | `PdvCartService` | Último pedido (para reabrir) |
| `pricing-theme` | `App` | Tema ativo |

### PricingStateService

Serviço central da precificação. Gerencia receitas, custos fixos, taxas e configuração de preço com reatividade via Angular Signals.

**Principais computed signals:**
- `recipes`, `categories`, `selectedRecipe`, `fixed`, `fees`, `pricing`, `database`

**Principais métodos de cálculo:**
- `itemCost(item)` → custo real de um ingrediente
- `calcRecipeTotals(recipe)` → CMV, embalagem e mão de obra por unidade
- `fixedMonthlyTotal()` → soma dos custos fixos
- `fixedPerHour()` → custo fixo por hora trabalhada
- `feesPctTotal()` → soma das taxas percentuais
- `computeUnitCost()` → custo unitário total decomposto
- `getPricingResult()` → preço sugerido, margem, markup e lucro

### ItemsCatalogService

Catálogo de produtos. Define as 9 categorias fixas (`PDV_CATEGORIES`).

**Principais métodos:**
- `effectivePrice(item)` → preço efetivo (manual ou sugerido)
- `getByCategory(id)` → filtra por categoria
- `searchByName(query)` → busca textual
- `findByBarcode(code)` → busca por código de barras
- `syncFromRecipe(data)` → sincroniza com a calculadora

### PdvStateService

Histórico de vendas.

**Principais computed signals:**
- `todaySales`, `dailyTotal`, `dailyCount`, `monthlySales`

**Principais métodos:**
- `addSale(...)` / `addSales([...])` → registra vendas
- `clearToday()` / `clearAll()` → limpa histórico

### PdvCartService

Carrinho ativo. Depende de `PdvStateService` e `ItemsCatalogService`.

**Principais computed signals:**
- `lines`, `subtotal`, `total`, `orderDiscount`, `nextOrderNumber`

**Principais métodos:**
- `addItem(product, qty, note)` → adiciona (incrementa se já existe)
- `updateQty(lineId, delta)` → altera quantidade
- `finishOrder(paymentMethod, amountReceived?)` → finaliza pedido e registra vendas
- `reopenLastOrder()` → reabre último pedido salvo
- `toggleFavorite(productId)` → marca/desmarca favorito
- `getMostSoldToday(limit)` → IDs dos mais vendidos do dia

---

## Modelos de Dados

### Precificação

```typescript
interface Recipe {
  id: string; name: string;
  yieldUnits: number; yieldLabel: 'unidade' | 'fatia';
  minutes: number; notes: string;
  items: RecipeItem[]; categoryId?: string;
}

interface RecipeItem {
  id: string; name: string;
  pricePaid: number; qtdTotal: number; qtdUsed: number;
  type: 'ingrediente' | 'embalagem';
}

interface FixedCostItem { id: string; name: string; value: number; }
interface FeePctItem { id: string; name: string; pct: number; }
interface VarFixedItem { id: string; name: string; value: number; }
interface DatabaseItem { id: string; name: string; pricePaid: number; qtdTotal: number; }
```

### Catálogo e PDV

```typescript
interface CatalogItem {
  id: string; name: string; recipeId: string;
  cmv: number; feesPct: number; suggestedPrice: number;
  useManualPrice: boolean; manualPrice: number;
  categoryId?: string; barcode?: string;
}

interface SaleItem {
  id: string; description: string;
  quantity: number; unitPrice: number; total: number;
  createdAt: string; // ISO
  productId?: string; itemNote?: string;
}

interface CartLineItem {
  id: string; productId: string; name: string;
  quantity: number; unitPrice: number; subtotal: number;
  note?: string;
}

type PaymentMethod = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'outros';
```

---

## Design System (CSS)

### Variáveis CSS (prefixo `--hy-`)

| Grupo | Exemplos |
|-------|----------|
| Cores | `--hy-primary`, `--hy-success`, `--hy-danger`, `--hy-warning`, `--hy-info` |
| Backgrounds | `--hy-bg-body`, `--hy-bg-card` |
| Texto | `--hy-text-body`, `--hy-text-title`, `--hy-text-muted` |
| Bordas | `--hy-border`, `--hy-radius`, `--hy-radius-lg`, `--hy-radius-xl` |
| Sombras | `--hy-shadow-card`, `--hy-shadow-sm`, `--hy-glow-primary` |
| Espaçamento | `--space-1` (4px) a `--space-16` (64px) — escala de 4px |
| Layout | `--hy-app-header-height: 3.25rem`, `--hy-app-sidebar-width: 260px` |

### Fonte

`'Nunito', -apple-system, BlinkMacSystemFont, sans-serif`

### Breakpoints Responsivos

| Largura | Ajuste |
|---------|--------|
| ≤ 1300px | Sidebar empilhada |
| ≤ 1100px | Grid PDV: coluna do pedido reduzida (300px) |
| ≤ 860px | PDV em coluna única |
| ≤ 768px | Painel de precificação empilhado |
| ≤ 480px | Modais full-width, grid de produtos compactado |

---

## Como Executar

```bash
npm install
ng serve
```

Acesse `http://localhost:4200`. Os dados são salvos automaticamente no `localStorage` do navegador.
