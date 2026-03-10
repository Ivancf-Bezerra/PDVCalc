## Plano de Refatoração de Arquitetura e Qualidade

Este documento descreve um **plano completo de refatoração** para o projeto `doces-precificacao-angular`, com foco em:

- **Arquitetura de componentes** (quebra de telas gigantes em subcomponentes).
- **Reutilização de paginação**.
- **Testes unitários em serviços de domínio**.
- **Configuração de ESLint e qualidade de código**.
- **Isolamento da lógica de impressão/relatórios**.
- **Uso consistente de lazy loading nas rotas**.

Ele complementa os documentos existentes em `docs/`, especialmente `DESENVOLVIMENTO.md`.

---

## 1. Visão geral do estado atual

- **Projeto**: Angular 21, standalone, `bootstrapApplication`, SPA.
- **Domínio**:
  - **Precificação**: receitas, custos fixos/variáveis, taxas, markup, preço sugerido, banco de ingredientes/embalagens.
  - **PDV**: vendas diárias/mensais/anuais, formas de pagamento, cancelamento/refund, favoritos, itens customizados.
- **Arquitetura atual**:
  - `app/`:
    - `app.ts`, `app.html`, `app.config.ts`, `app.routes.ts`.
  - `app/core/`:
    - Serviços de domínio e infraestrutura: `AuthService`, `PricingStateService`, `PdvStateService`, `PdvCartService`, `ItemsCatalogService`, `StorageService`, etc.
  - `app/features/`:
    - `login/`, `pdv/`, `precificacao/`, cada um com um **componente standalone principal**.
- **UI/stack**:
  - Tailwind 4 + SCSS, Preline, `lucide-angular`, `ng2-charts` + `chart.js`, `jspdf`.
- **Pontos fortes**:
  - Domínio bem modelado.
  - Boa separação de lógica de negócio em serviços de `core`.
  - Experiência de uso rica (PDV completo, precificação avançada, documentação em `docs/`).
- **Pontos frágeis principais**:
  - `PdvComponent` e `PrecificacaoComponent` são **componentes gigantes**.
  - **Duplicação de lógica de paginação**.
  - **Poucos testes** (apenas `app.spec.ts`).
  - **Sem ESLint** (apenas Prettier).
  - **Lógica de impressão/relatórios acoplada ao componente**.
  - **Lazy loading** pode ser melhor explorado/explicitado.

---

## 2. Objetivos da refatoração

- **2.1 Manutenibilidade**
  - Reduzir o tamanho e complexidade dos componentes principais.
  - Deixar responsabilidades mais claras e localizadas.

- **2.2 Reutilização**
  - Centralizar lógica de paginação e padrões repetidos.
  - Reaproveitar padrões de UI (cards, tabelas, modais, relatórios).

- **2.3 Confiabilidade**
  - Adicionar testes unitários cobrindo a lógica crítica de domínio.
  - Aumentar confiança ao evoluir o produto.

- **2.4 Qualidade de código**
  - Estabelecer regras de lint e métricas básicas de complexidade.

- **2.5 Performance e UX**
  - Consolidar o uso de **lazy loading** para carregar features pesadas sob demanda.
  - Manter experiência fluida mesmo em dispositivos mais simples.

---

## 3. Quebra de `PdvComponent` em subcomponentes

### 3.1 Situação atual

- `PdvComponent` concentra:
  - Layout completo da tela de PDV.
  - Lógica de carrinho (integração com `PdvCartService`).
  - Interação com `ItemsCatalogService` e `PdvStateService`.
  - Controle de abas (PDV, vendas do dia, relatórios, BD ITEMS).
  - Gráficos diários/mensais/anuais com `ng2-charts` + `chart.js`.
  - Geração de PDFs / impressão de relatórios.
  - Lógica de paginação de listas.

### 3.2 Objetivo da divisão

- Ter componentes **focados em uma responsabilidade**, por exemplo:
  - Um componente apenas para o **carrinho**.
  - Um componente apenas para a **grade de produtos**.
  - Componentes separados para cada tipo de **relatório**.
  - Componentes menores para **modais** de confirmação/pagamento.

### 3.3 Proposta de novos subcomponentes

Organizar sob `src/app/features/pdv/` (nomes sugeridos; podem ser ajustados):

- **`pdv-shell`**
  - Responsabilidade: layout de alto nível da feature PDV (tabs, estrutura da página).
  - Usa os subcomponentes abaixo.
  - Mantém a integração com os serviços de domínio (`PdvCartService`, `PdvStateService`, `ItemsCatalogService`).

- **`pdv-products-grid`**
  - Responsabilidade: exibir lista/grade de produtos, agrupados por categoria, busca e atalho de código de barras.
  - Input: lista de itens do catálogo, categoria ativa, termo de busca.
  - Output: eventos como “adicionar item ao carrinho”.

- **`pdv-cart-panel`**
  - Responsabilidade: exibir e manipular o carrinho atual (itens, quantidades, remoção, observações, desconto).
  - Input: estado de carrinho (via `signal`/`input`).
  - Output: eventos como “alterar quantidade”, “limpar carrinho”, “abrir modal de pagamento”.

- **`pdv-payment-dialog`**
  - Responsabilidade: fluxo de pagamento e finalização de pedido.
  - Props:
    - Valor total, desconto aplicado, formas de pagamento disponíveis.
  - Eventos:
    - `confirmPayment` (forma de pagamento + valores + observações).
    - `cancelPayment`.
  - Internamente delega para `PdvCartService.finishOrder`.

- **`pdv-daily-report`**
  - Responsabilidade: relatório de **vendas diárias**.
  - Inputs:
    - Lista de vendas do dia.
    - Agregações por forma de pagamento / hora.
  - Eventos:
    - “imprimir relatório diário”.
    - “limpar vendas do dia”.

- **`pdv-monthly-report`**
  - Responsabilidade: relatório de **vendas mensais**.
  - Inputs:
    - Dados mensais agregados (já calculados pelo serviço).
  - Exibe gráficos com `ng2-charts`.
  - Evento: “imprimir relatório mensal”.

- **`pdv-yearly-report`**
  - Responsabilidade: visão **anual** por mês/forma de pagamento.
  - Input: agregações anuais (`getYearlyPaymentsByMethod` etc.).

- **`pdv-items-database`**
  - Responsabilidade: gerenciar **BD ITEMS** (catálogo de itens da precificação para PDV).
  - Lida com:
    - Preço sugerido vs preço manual.
    - Categoria de PDV e código de barras.

### 3.4 Passos de implementação (sugeridos)

1. **Criar `PdvShell`**:
   - Extrair do `PdvComponent` apenas o layout principal, mantendo tudo funcionando.
   - Mapear quais partes do template vão para quais subcomponentes.
2. **Extrair `PdvProductsGrid` e `PdvCartPanel`**:
   - Começar pela tela principal (fluxo de venda), que é o coração do PDV.
   - Passar dados via `@Input()` e ações via `@Output()`.
3. **Extrair diálogos (`PdvPaymentDialog` e modais de confirmação)**.
4. **Extrair relatórios (`PdvDailyReport`, `PdvMonthlyReport`, `PdvYearlyReport`)**.
5. **Extrair `PdvItemsDatabase`** para isolar a lógica de BD ITEMS.
6. Ao final, `PdvComponent` (ou `PdvShell`) deve ficar pequeno, atuando apenas como **orquestrador**.

---

## 4. Quebra de `PrecificacaoComponent` em subcomponentes

### 4.1 Situação atual

- `PrecificacaoComponent` concentra:
  - Abas: Receitas, Custos fixos, Taxas, Precificação, Relatórios, Banco de dados.
  - CRUD completo de receitas e itens.
  - Cadastro de custos fixos, taxas e variáveis fixas.
  - Cálculo de preço sugerido, margens, custos por unidade.
  - Geração e impressão de ficha técnica.
  - Lógica de paginação para múltiplas tabelas.

### 4.2 Objetivo da divisão

- Deixar cada aba ou grupo de função em um componente dedicado:
  - Facilita testes.
  - Facilita leitura e manutenção.
  - Permite evolução isolada (por exemplo, só melhorar a aba de relatórios).

### 4.3 Proposta de novos subcomponentes

Organizar sob `src/app/features/precificacao/`:

- **`pricing-shell`**
  - Responsabilidade: layout principal, controle de abas e comunicação com `HeaderActionsService` / `SidebarSubmenuService`.
  - Orquestra os subcomponentes das abas.

- **`pricing-recipes-tab`**
  - Responsabilidade: CRUD de receitas e itens de receita.
  - Interage com `PricingStateService` para:
    - Criar/editar/excluir receitas.
    - Adicionar/remover ingredientes, embalagens.
    - Selecionar receita ativa.

- **`pricing-costs-tab`**
  - Responsabilidade: **custos fixos** e **taxas/itens variáveis fixos**.
  - Divide ou não em dois subcomponentes menores conforme necessidade:
    - `pricing-fixed-costs-section`.
    - `pricing-fees-section`.

- **`pricing-pricing-tab`**
  - Responsabilidade: exibir o **resumo de precificação** da receita ativa:
    - CMV, custos de mão de obra, custos fixos/variáveis por unidade.
    - Margens, markup e preço sugerido.
  - Pode também permitir a escolha entre “por margem” ou “por preço de mercado”.

- **`pricing-reports-tab`**
  - Responsabilidade: visão consolidada e relatórios internos da precificação.

- **`pricing-database-tab`**
  - Responsabilidade: gerenciamento do **banco de ingredientes/embalagens**.
  - Atualiza `PricingStateService` para refletir novos itens de banco.

- **`pricing-ficha-tecnica-dialog`** (opcional, mas recomendado)
  - Responsabilidade: exibir/gerar a ficha técnica de uma receita (pré-visualização antes da impressão).
  - Usa serviço de relatório/impressão (ver seção 7).

### 4.4 Passos de implementação (sugeridos)

1. **Criar `PricingShell`** com a estrutura de abas, reaproveitando o HTML atual.
2. **Extrair a aba de Receitas (`PricingRecipesTab`)**:
   - Migrar a parte do template referente a listagens/edição de receitas.
   - Manter as chamadas a `PricingStateService`.
3. **Extrair a aba de Custos (`PricingCostsTab`)**.
4. **Extrair aba de Precificação (`PricingPricingTab`)**.
5. **Extrair abas de Relatórios e Banco de dados (`PricingReportsTab`, `PricingDatabaseTab`)**.
6. **Extrair componente para Ficha Técnica**, se a lógica de visualização for significativa.

---

## 5. Extração da paginação para algo reutilizável

### 5.1 Situação atual

- `PdvComponent` e `PrecificacaoComponent` replicam lógica de paginação:
  - Variáveis como `tablePage`, `tablePageSize`, `pageSizeOptions`.
  - Funções `paginate`, `paginationInfo` etc.
  - Essa lógica aparece em múltiplas tabelas/listas.

### 5.2 Objetivo

- Ter um **padrão único de paginação**, fácil de reutilizar e evoluir.
- Reduzir duplicação de código.

### 5.3 Opção A — Helper/factory de paginação

- Criar uma função utilitária (por exemplo, em `src/app/core/pagination.ts` ou `shared/pagination/`):

  - API sugerida:
    - `createPaginator<T>(itemsSignal: Signal<T[]>, defaultPageSize: number)`
      - Retorna:
        - `page`: signal número da página.
        - `pageSize`: signal do tamanho da página.
        - `pageItems`: `computed` com os itens da página atual.
        - `pageInfo`: `computed` com informações (`{ from, to, total, page, totalPages }`).
        - Métodos: `nextPage()`, `prevPage()`, `goToPage(n)`, `setPageSize(size)`.

- Vantagens:
  - Lógica concentrada em um único arquivo.
  - Fácil de testar (teste puro de paginação).
  - Pode ser utilizada tanto no PDV quanto na precificação.

### 5.4 Opção B — Componente `PaginatorComponent`

- Criar um componente standalone `PaginatorComponent`:
  - Inputs:
    - `page`, `pageSize`, `totalItems`, `pageSizeOptions`.
  - Outputs:
    - Eventos `pageChange`, `pageSizeChange`.
  - A tabela/lista continua sendo responsabilidade do componente pai, mas a **UI de paginação** fica centralizada.

### 5.5 Passos de implementação

1. Escolher **ao menos uma das abordagens** (idealmente combinar A + B: lógica em helper + UI em componente).
2. Refatorar primeiro uma tabela (por exemplo, lista de receitas) para usar o novo paginator.
3. Migrar as outras tabelas gradualmente (vendas diárias, BD ITEMS, etc.).

---

## 6. Testes unitários para serviços de domínio

### 6.1 Serviços prioritários

1. **`PricingStateService`**
   - Fórmulas de precificação:
     - Cálculo de CMV (custo de mercadoria vendida).
     - Cálculo de custo por unidade.
     - Margens, markup, preço sugerido.
   - Impacto direto na confiabilidade do preço de venda.

2. **`PdvStateService`**
   - Agregações de vendas:
     - Vendas diárias (`todaySales`, `todayOrders`).
     - Vendas mensais (`monthlySales`, pagamentos por dia/método).
     - Vendas anuais (`getYearlyPaymentsByMethod`).
   - Regras de cancelamento/refund e limpeza de dia/tudo.

3. **`PdvCartService`**
   - Fluxo de `finishOrder`:
     - Geração correta de vendas (totais, desconto, pagamento, troco).
     - Limpeza/reset de carrinho após finalização.
     - Itens customizados e favoritos.

4. **`ItemsCatalogService`**
   - Sincronização com receitas (`syncFromRecipe`).
   - Cálculo de preços sugeridos a partir de resultados de precificação.
   - Busca por itens e categorias.

### 6.2 Estratégia de testes

- Usar o runner de testes já configurado (`npm test`) com Vitest / Angular.
- Criar arquivos `*.spec.ts` ao lado dos serviços:
  - `pricing-state.service.spec.ts`
  - `pdv-state.service.spec.ts`
  - `pdv-cart.service.spec.ts`
  - `items-catalog.service.spec.ts`

- Focar em testes **puros**, com o mínimo de mocks:
  - `StorageService` pode ser mockado em memória (objeto simples substituindo `localStorage`).
  - Não testar detalhes de framework Angular, apenas regras do domínio.

### 6.3 Exemplos de cenários de teste

- `PricingStateService`:
  - Dada uma receita simples (1 ingrediente + 1 embalagem), com custo fixo X e taxa Y, o preço sugerido deve ser Z.
  - Alteração de retorno (rendimento) deve impactar custo por unidade.

- `PdvStateService`:
  - Registro de vendas em diferentes dias e horários deve aparecer nos agregados corretos.
  - Cancelar venda deve removê-la/ajustá-la dos totals.

- `PdvCartService`:
  - Finalizar pedido em dinheiro com valor pago > total deve gerar troco correto.
  - Aplicar desconto percentual e em valor fixo deve resultar no total adequado.

- `ItemsCatalogService`:
  - Sincronização de uma receita com determinado resultado de precificação deve gerar item de catálogo alinhado com o preço sugerido.

---

## 7. ESLint e configuração de qualidade

### 7.1 Objetivo

- Adicionar verificação automática de:
  - Erros comuns de código.
  - Padrões de importação.
  - Complexidade de funções/arquivos.
  - Boas práticas Angular/TypeScript.

### 7.2 Itens de configuração recomendados

- Adicionar ESLint com preset Angular/TypeScript moderno:
  - Regras básicas:
    - Sem variáveis não usadas.
    - Preferência por `const`.
    - Proibir `any` implícito.
    - Limites de tamanho (por exemplo, alertar para arquivos > 500 linhas).
  - Regras Angular:
    - Componentes standalone, `OnPush` quando aplicável.
    - Boas práticas de assinatura de inputs/outputs.

- Integrar com scripts npm:
  - `lint`: roda ESLint em `src/`.
  - Opcional: `lint:fix`.

### 7.3 Benefícios esperados

- Detectar problemas de código **antes** de rodar a aplicação.
- Incentivar a manter componentes menores após a refatoração.
- Garantir consistência de estilo juntamente com Prettier.

---

## 8. Isolamento da lógica de impressão e relatórios

### 8.1 Situação atual

- `PdvComponent` e `PrecificacaoComponent`:
  - Montam HTML manualmente com `innerHTML` e `window.print`.
  - Constroem strings longas para PDF (`jsPDF`) dentro do próprio componente.

### 8.2 Objetivos

- Separar **construção de conteúdo** (HTML/texto) da **orquestração de UI**.
- Facilitar testes de geração de relatórios.
- Permitir reutilização em diferentes telas (por exemplo, relatórios de PDV e ficha técnica de precificação).

### 8.3 Proposta de serviços utilitários

- **`ReportBuilderService`** (ou helpers puros em `core/reports`):
  - Funções puras:
    - `buildDailySalesReportHtml(dailyData): string`
    - `buildMonthlySalesReportHtml(monthlyData): string`
    - `buildFichaTecnicaHtml(recipe, pricingResult): string`
  - Não acessa DOM nem `window`, apenas monta strings.

- **`PrintService`**
  - Responsável por interagir com:
    - `window.print`
    - `window.open` para nova aba de impressão.
    - Integração com `jsPDF`:
      - `printHtml(html: string, options?)`
      - `generatePdf(htmlOrData, options?): void`

### 8.4 Passos de implementação

1. Extrair a lógica de **montagem de HTML** da ficha técnica para uma função pura (no novo serviço/arquivo de utilitários).
2. Adaptar o componente de precificação para chamar apenas:
   - `const html = reportBuilder.buildFichaTecnicaHtml(recipe, result);`
   - `printService.printHtml(html);`
3. Repetir o processo para relatórios de PDV:
   - Relatório diário.
   - Relatório mensal.
4. Opcionalmente, escrever testes unitários para as funções de `ReportBuilder` (garante que o conteúdo chave está presente).

---

## 9. Lazy loading de rotas

### 9.1 Situação desejada

- **Login, PDV e Precificação** carregados sob demanda (lazy), usando componentes standalone.
- Rotas principais em `app.routes.ts` utilizando `loadComponent`.

### 9.2 Exemplo de configuração (conceitual)

```ts
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'pdv',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pdv/pdv.component').then(m => m.PdvComponent),
  },
  {
    path: 'precificacao',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/precificacao/precificacao.component').then(
        m => m.PrecificacaoComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'pdv' },
  { path: '**', redirectTo: 'pdv' },
];
```

- **Guards** permanecem aplicados normalmente (`authGuard`, `loginGuard`).
- Serviços `providedIn: 'root'` continuam sendo singletons.

### 9.3 Evolução futura: subrotas por domínio

- Se no futuro for necessário dividir mais:
  - `pdv` pode ter subrotas (`/pdv/caixa`, `/pdv/relatorios`, `/pdv/bd-items`).
  - `precificacao` pode ter subrotas (`/precificacao/receitas`, `/precificacao/custos`, etc.).
- Essas subrotas podem ser agrupadas em arquivos de rotas próprios:
  - `features/pdv/pdv.routes.ts`
  - `features/precificacao/precificacao.routes.ts`
  - E carregadas com `loadChildren`.

---

## 10. Roadmap sugerido (fases)

### Fase 1 – Infra de qualidade

- Adicionar ESLint e scripts `lint` / `lint:fix`.
- Configurar regras básicas de qualidade e complexidade.

### Fase 2 – Testes em serviços de domínio

- Escrever testes para:
  - `PricingStateService`
  - `PdvStateService`
  - `PdvCartService`
  - `ItemsCatalogService`
- Garantir que regras principais de negócio estejam cobertas.

### Fase 3 – Refatoração do PDV

- Criar `PdvShell` e extrair:
  - `PdvProductsGrid`
  - `PdvCartPanel`
  - `PdvPaymentDialog`
  - `PdvDailyReport`, `PdvMonthlyReport`, `PdvYearlyReport`
  - `PdvItemsDatabase`
- Introduzir componente/helper de paginação e migrar tabelas do PDV.

### Fase 4 – Refatoração da Precificação

- Criar `PricingShell` e extrair abas:
  - `PricingRecipesTab`
  - `PricingCostsTab`
  - `PricingPricingTab`
  - `PricingReportsTab`
  - `PricingDatabaseTab`
- Introduzir uso do paginator reutilizável nas tabelas de precificação.

### Fase 5 – Impressão e relatórios

- Criar `ReportBuilderService` (ou helpers) e `PrintService`.
- Migrar lógica de ficha técnica e relatórios de PDV para usar esses serviços.
- (Opcional) Adicionar testes para geração de conteúdo de relatório.

### Fase 6 – Ajustes finos e monitoramento

- Revisar métricas de bundle (tamanho das rotas lazy).
- Ajustar regras de lint se necessário.
- Avaliar se novos subdomínios/rotas precisam de sua própria estrutura (ex.: relatórios avançados).

---

## 11. Resultado esperado

Ao final da refatoração, espera-se que:

- Os componentes de tela (`PdvComponent`, `PrecificacaoComponent`) estejam **menores e focados**, atuando como orquestradores.
- A lógica de negócio permaneça centralizada em serviços de `core`, com **testes unitários cobrindo casos críticos**.
- A paginação seja **reutilizável** e simples de aplicar em novas listas.
- A lógica de impressão/relatórios possa ser evoluída e testada de forma independente da UI.
- O projeto use **lazy loading** de forma consistente, com boa experiência de uso em produção.
