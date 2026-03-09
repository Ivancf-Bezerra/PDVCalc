# Doces - Precificação e PDV | Regras, Utilização e Desenvolvimento

Este documento descreve as regras do projeto, como utilizar a aplicação e como desenvolver a partir do estado atual.

---

## 1. Visão geral do projeto

Aplicação Angular (SPA) com dois ambientes:

| Ambiente | Rota | Descrição |
|----------|------|-----------|
| **Precificação** | `/precificacao` | Calculadora de precificação: receitas, custos fixos, taxas, markup (modelo Sebrae), relatórios e banco de ingredientes/embalagens. |
| **PDV** | `/pdv` | Relatório diário de vendas: registro de vendas do dia, totais e persistência local. |

- **Front-end apenas:** não há backend; os dados são salvos no `localStorage` do navegador.
- **Stack:** Angular 21, Tailwind CSS v4, Preline UI, Lucide (ícones), Vitest (testes).

---

## 2. Estrutura do projeto

```
src/
├── index.html
├── main.ts
├── styles.css              # Tailwind + Preline (entrypoint principal)
├── styles.scss             # Estilos legados (Precificação; migração gradual)
├── global.d.ts             # Tipos globais (ex.: Window.HSStaticMethods)
└── app/
    ├── app.ts              # Shell: header, navegação, tema, router-outlet
    ├── app.html
    ├── app.config.ts       # provideRouter, Lucide icons
    ├── app.routes.ts       # Rotas lazy (precificacao, pdv)
    ├── app.spec.ts
    ├── core/
    │   ├── pricing-state.service.ts   # Estado da calculadora de precificação
    │   ├── pdv-state.service.ts       # Estado do PDV (vendas do dia, histórico)
    │   ├── pdv-cart.service.ts         # Carrinho e fluxo da tela principal do PDV
    │   └── items-catalog.service.ts    # Catálogo de itens (BD ITEMS, categorias, preços)
    └── features/
        ├── precificacao/
        │   ├── precificacao.component.ts
        │   ├── precificacao.component.html
        │   └── precificacao.component.scss
        └── pdv/
            ├── pdv.component.ts
            ├── pdv.component.html
            └── pdv.component.scss
```

- **Shell (App):** apenas layout global, navegação entre ambientes, seletor de tema e `<router-outlet>`.
- **Features:** cada ambiente é um componente standalone carregado sob demanda (lazy).
- **Core:** serviços de estado reativo (signals) com persistência em `localStorage`.

---

## 3. Regras e convenções

### 3.1 Estilo e UI

- **Novos componentes e telas:** usar **Tailwind CSS** e **Preline UI** (classes utilitárias e componentes Preline quando existirem).
- **Precificação:** ainda utiliza classes e variáveis de `styles.scss` (tema light/dark/neutral, cards, tabelas). Novas alterações nessa feature devem, quando possível, migrar para Tailwind/Preline.
- **Shell e PDV:** já em Tailwind/Preline; manter padrão (ex.: `rounded-lg`, `border`, `dark:`).
- **Ícones:** usar **lucide-angular** (já configurado em `app.config.ts`). Registrar novos ícones no `LucideAngularModule.pick({ ... })` quando necessário.
- **Temas:** o shell aplica `data-theme="light"|"dark"|"neutral"` em `<html>`. Preferência é salva em `localStorage` (chave `pricing-theme`).

### 3.2 Código

- **Angular:** componentes **standalone**; injeção de dependências com `inject()`.
- **Estado:** serviços com **signals** e **computed**; atualizações imutáveis e persistência após cada mudança relevante.
- **Rotas:** lazy loading para as features (`loadComponent`); rota vazia e `**` redirecionam para `precificacao`.
- **Idioma:** comentários e mensagens de UI em **português** (pt-BR).
- **Formatação:** Prettier configurado; manter consistência (aspas, ponto e vírgula, etc.).

### 3.3 Preline UI

- Componentes interativos (dropdown, tabs, etc.) são inicializados pelo script Preline (`node_modules/preline/dist/index.js`).
- Após navegação (rotas lazy), o shell chama `window.HSStaticMethods?.autoInit()` para re-inicializar componentes na nova view.
- Usar classes Preline quando aplicável: `hs-dropdown`, `hs-dropdown-toggle`, `hs-dropdown-menu`, etc., conforme a [documentação Preline](https://preline.co/docs).

### 3.4 Persistência

- **Precificação:** chave `pricingApp.v1` no `localStorage` (estado completo da calculadora).
- **PDV:** chave `pricingApp.pdv.v1` (lista de vendas); `pricingApp.pdv.favorites.v1` (favoritos); `pricingApp.pdv.lastOrder.v1` (último pedido para reabrir).
- **Catálogo (BD ITEMS):** chave `pricingApp.itemsCatalog.v1` (itens com preço, categoria, código de barras).
- Não expor dados sensíveis; uso local apenas.

---

## 4. Utilização da aplicação

### 4.1 Como rodar

```bash
npm install
npm start
```

Acesse `http://localhost:4200/`. A rota inicial é `/precificacao`.

### 4.2 Precificação

1. **Receitas:** cadastre receitas (nome, rendimento, tempo, categoria). Adicione ingredientes e embalagens (preço, quantidade total e usada). Use o "Banco de dados" para ingredientes/embalagens predefinidos.
2. **Custos fixos:** informe meta de horas/mês, dias úteis, valor/hora da mão de obra e a lista de custos fixos (aluguel, luz, etc.).
3. **Taxas:** cadastre taxas percentuais (cartão, iFood, imposto) e custos fixos por unidade (etiqueta, saco).
4. **Precificação:** escolha "por margem desejada" ou "por preço de mercado". O sistema calcula o preço sugerido e o markup (modelo Sebrae).
5. **Relatórios:** visão consolidada e detalhe da receita selecionada.
6. **Ações:** "Carregar exemplo" (dados de demonstração), "Zerar dados", "Imprimir ficha técnica" (da receita selecionada).

### 4.3 PDV (Ponto de venda e relatórios)

1. **Tela principal (PDV):** produtos por categoria, busca, código de barras (Enter), favoritos e mais vendidos. Clique nos produtos para adicionar ao pedido; ajuste quantidades e observações. Use "Finalizar venda" para escolher forma de pagamento (dinheiro, cartão, Pix etc.); em dinheiro, informe o valor recebido para ver o troco. Botões: cancelar pedido, limpar carrinho, reabrir último pedido, imprimir comanda.
2. **Abas:** "Relatório de vendas do dia", "Relatório mensal" e "BD ITEMS" (catálogo de itens da precificação, com preço manual opcional).
3. **BD ITEMS:** itens vêm da calculadora de precificação; ative "Valor manual" para definir preço de venda. Categoria e código de barras (para o PDV) podem ser configurados quando suportado na tela.
4. "Limpar dia" (no relatório) remove apenas as vendas de hoje; "Limpar tudo" remove todo o histórico salvo.

---

## 5. Desenvolvimento

### 5.1 Ambiente

- **Node/npm:** usar a versão compatível com Angular 21 (ex.: Node 18+).
- **IDE:** o projeto usa TypeScript strict e Angular strict; o editor deve reconhecer `src/global.d.ts` e os paths do projeto.

### 5.2 Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Servidor de desenvolvimento (`ng serve`). |
| `npm run build` | Build de produção (`dist/`). |
| `npm run watch` | Build em modo watch (development). |
| `npm test` | Testes unitários (Vitest). |
| `npx ng generate component <nome>` | Gerar novo componente (prefixo `app`). |

### 5.3 Adicionar uma nova feature (rota)

1. Criar o componente em `src/app/features/<nome>/` (standalone).
2. Em `app.routes.ts`, adicionar uma rota com `loadComponent: () => import('...').then(m => m.NomeComponent)`.
3. No shell (`app.html`), adicionar um link com `routerLink="/<path>"` e `routerLinkActive` para destaque.
4. Se a nova tela usar componentes Preline (dropdown, tabs, etc.), o `autoInit()` já é chamado após `NavigationEnd`; não é necessário alterar o shell para isso.

### 5.4 Adicionar novo estado global

1. Criar um serviço em `src/app/core/` com `@Injectable({ providedIn: 'root' })`.
2. Usar `signal()` e `computed()` para estado reativo.
3. Persistir em `localStorage` em um método chamado após atualizações (ex.: `persist()`), com chave única (ex.: `pricingApp.<contexto>.v1`).

### 5.5 Estilização (Tailwind / Preline)

- **Globais:** editar `src/styles.css` (Tailwind, Preline, `@plugin`, `@layer`). Não remover `@import "tailwindcss"` nem o `@source` do Preline.
- **Componente:** usar `class="..."` no template com utilitários Tailwind ou classes Preline. Para estilos específicos do componente, usar o `styleUrl` (ex.: `component.scss`) com o mínimo necessário; preferir utilitários no template.
- **Tema escuro:** usar prefixo `dark:` nas classes Tailwind quando quiser suporte a tema escuro (o shell já aplica `data-theme` no `<html>`).

### 5.6 Testes

- Testes em `*.spec.ts` (ex.: `app.spec.ts`).
- O shell usa `Router`; nos testes do `App` é necessário `provideRouter(routes)` (ou equivalente) para o `router-outlet` e os links funcionarem.
- Executar: `npm test`.

### 5.7 Build e deploy

- **Produção:** `npm run build`. Saída em `dist/doces-precificacao-angular/` (ou conforme `angular.json`).
- O build inclui os scripts do Preline (`angular.json` → `scripts`). Não remover `node_modules/preline/dist/index.js` da lista de scripts se usar componentes Preline.
- Há aviso de budget (tamanho do bundle); pode ser ajustado em `angular.json` em `budgets` se necessário.

---

## 6. Referências rápidas

- [Angular](https://angular.dev)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Preline UI](https://preline.co/docs)
- [Lucide Icons](https://lucide.dev)

---

*Última atualização: conforme estado do repositório após implementação do plano Preline, Tailwind e dois ambientes (Precificação + PDV).*
