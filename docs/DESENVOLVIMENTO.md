# Doces - Precificação e PDV | Regras, Utilização e Desenvolvimento

Este documento descreve as regras do projeto, como utilizar a aplicação e como desenvolver a partir do estado atual.

---

## 1. Visão geral do projeto

Aplicação Angular (SPA) com **login multi-usuário** e dois ambientes principais:

| Rota | Descrição |
|------|-----------|
| **Login** | `/login` — Seleção ou criação de usuário. Exibida quando não há usuário logado. |
| **PDV** | `/pdv` — Ponto de venda: registro de vendas do dia, relatórios diário/mensal/anual, BD ITEMS e calculadora iFood. **Rota padrão** após o login. |
| **Precificação** | `/precificacao` — Calculadora de precificação: receitas, custos fixos, taxas, markup (modelo Sebrae), relatórios e banco de ingredientes/embalagens. |

- **Front-end apenas:** não há backend; os dados são salvos no `localStorage` do navegador.
- **Multi-usuário:** cada usuário tem seus próprios dados (PDV, precificação, catálogo); as chaves no `localStorage` são prefixadas pelo ID do usuário ativo.
- **Rotas protegidas:** `/pdv` e `/precificacao` exigem usuário logado (`authGuard`); `/login` só é acessível quando não há usuário logado (`loginGuard`). Rota vazia e `**` redirecionam para `/pdv` (ou para `/login` se não autenticado).
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
    ├── app.ts              # Shell: header, sidebar, tema, router-outlet
    ├── app.html
    ├── app.config.ts       # provideRouter, Lucide icons
    ├── app.routes.ts       # Rotas lazy (login, pdv, precificacao) + guards
    ├── app.spec.ts
    ├── core/
    │   ├── auth.service.ts           # Usuários e usuário ativo (multi-usuário)
    │   ├── auth.guard.ts             # authGuard e loginGuard
    │   ├── storage.service.ts        # get/set/remove com chave prefixada por usuário
    │   ├── pricing-state.service.ts  # Estado da calculadora de precificação
    │   ├── pdv-state.service.ts      # Estado do PDV (vendas do dia, histórico)
    │   ├── pdv-cart.service.ts       # Carrinho e fluxo da tela principal do PDV
    │   ├── items-catalog.service.ts  # Catálogo de itens (BD ITEMS, categorias, preços)
    │   ├── header-actions.service.ts # Ações do header (exemplo, ficha técnica)
    │   ├── sidebar-submenu.service.ts# Aba ativa no sidebar (PDV / Precificação)
    │   ├── report-builder.service.ts # Montagem de relatórios
    │   ├── print.service.ts          # Impressão (comanda, ficha)
    │   ├── pagination.ts             # Utilitário de paginação
    │   ├── safe-num.ts               # Utilitário numérico seguro
    │   └── *.spec.ts                 # Testes dos serviços core
    └── features/
        ├── login/
        │   ├── login.component.ts
        │   └── login.component.html
        ├── precificacao/
        │   ├── precificacao.component.ts/html/scss
        │   └── pricing-*-tab.component.ts/html  # Abas: receitas, custos, taxas, etc.
        └── pdv/
            ├── pdv.component.ts/html/scss
            ├── pdv-daily-report.component.ts/html
            ├── pdv-monthly-report.component.ts/html
            ├── pdv-yearly-report.component.ts/html
            ├── pdv-items-database.component.ts/html
            └── pdv-ifood-calculator.component.ts/html
```

- **Shell (App):** layout global (header com usuário e menu “Funções”, sidebar com submenus), seletor de tema e `<router-outlet>`. Não exibido na rota `/login`.
- **Features:** cada ambiente é um componente standalone carregado sob demanda (lazy). Login, PDV e Precificação são features separadas.
- **Core:** serviços de estado reativo (signals) com persistência em `localStorage`. `StorageService` e serviços que persistem dados do usuário utilizam o prefixo do usuário ativo (via `AuthService.storageKey()`).

---

## 3. Regras e convenções

### 3.1 Estilo e UI

- **Novos componentes e telas:** usar **Tailwind CSS** e **Preline UI** (classes utilitárias e componentes Preline quando existirem).
- **Precificação:** ainda utiliza classes e variáveis de `styles.scss` (tema light/dark/neutral, cards, tabelas). Novas alterações nessa feature devem, quando possível, migrar para Tailwind/Preline.
- **Shell e PDV:** já em Tailwind/Preline; manter padrão (ex.: `rounded-lg`, `border`, `dark:`).
- **Ícones:** usar **lucide-angular** (já configurado em `app.config.ts`). Registrar novos ícones no `LucideAngularModule.pick({ ... })` quando necessário.
- **Temas:** o shell aplica `data-theme` em `<html>` com um dos valores: `light`, `dark`, `green-light`, `green-dark`. A preferência é salva em `localStorage` (chave `pricing-theme`).

### 3.2 Código

- **Angular:** componentes **standalone**; injeção de dependências com `inject()`.
- **Estado:** serviços com **signals** e **computed**; atualizações imutáveis e persistência após cada mudança relevante.
- **Rotas:** lazy loading para as features (`loadComponent`); rota vazia e `**` redirecionam para `pdv`. Guards: `authGuard` para `/pdv` e `/precificacao`, `loginGuard` para `/login`.
- **Idioma:** comentários e mensagens de UI em **português** (pt-BR).
- **Formatação:** Prettier configurado; manter consistência (aspas, ponto e vírgula, etc.).

### 3.3 Preline UI

- Componentes interativos (dropdown, tabs, etc.) são inicializados pelo script Preline (`node_modules/preline/dist/index.js`).
- Após navegação (rotas lazy), o shell chama `window.HSStaticMethods?.autoInit()` para re-inicializar componentes na nova view.
- Usar classes Preline quando aplicável: `hs-dropdown`, `hs-dropdown-toggle`, `hs-dropdown-menu`, etc., conforme a [documentação Preline](https://preline.co/docs).

### 3.4 Persistência e multi-usuário

- **Chaves globais (sem prefixo de usuário):**
  - `pricingApp.users` — lista de usuários (AuthService).
  - `pricingApp.activeUserId` — ID do usuário atualmente logado.
  - `pricing-theme` — tema escolhido (light/dark/green-light/green-dark).
- **Dados por usuário:** o `StorageService` e os serviços de estado (precificação, PDV, catálogo) usam chaves prefixadas com `u.<userId>.` (ex.: `u.abc123.pricing.v1`). Assim, cada usuário tem sua própria precificação, vendas e catálogo.
- **Exemplos de chaves prefixadas (após o prefixo do usuário):** estado da calculadora, lista de vendas do PDV, favoritos, último pedido, catálogo de itens (BD ITEMS). Os nomes exatos dependem da implementação de cada serviço (que utiliza `AuthService.storageKey()` ou `StorageService`).
- Não expor dados sensíveis; uso local apenas.

---

## 4. Utilização da aplicação

### 4.1 Como rodar

```bash
npm install
npm start
```

Acesse `http://localhost:4200/`. Se não houver usuário logado, a aplicação redireciona para **Login**. Após entrar, a rota inicial é **PDV** (`/pdv`).

### 4.2 Login

1. Na tela de login, escolha um usuário existente ou crie um novo (nome e cor do avatar).
2. Ao selecionar/criar usuário, você é redirecionado para o PDV. Os dados exibidos (precificação, vendas, catálogo) são os desse usuário.
3. Para trocar de usuário, use **Funções** no header e **Logout**; na tela de login, selecione outro usuário ou crie um novo.

### 4.3 Precificação

1. **Receitas:** cadastre receitas (nome, rendimento, tempo, categoria). Adicione ingredientes e embalagens (preço, quantidade total e usada). Use o "Banco de dados" para ingredientes/embalagens predefinidos.
2. **Custos fixos:** informe meta de horas/mês, dias úteis, valor/hora da mão de obra e a lista de custos fixos (aluguel, luz, etc.).
3. **Taxas:** cadastre taxas percentuais (cartão, iFood, imposto) e custos fixos por unidade (etiqueta, saco).
4. **Precificação:** escolha "por margem desejada" ou "por preço de mercado". O sistema calcula o preço sugerido e o markup (modelo Sebrae).
5. **Relatórios:** visão consolidada e detalhe da receita selecionada.
6. **Ações (menu Funções):** "Exemplo de dados" (dados de demonstração), "Ficha técnica" (imprimir da receita selecionada).

### 4.4 PDV (Ponto de venda e relatórios)

1. **Tela principal (PDV):** produtos por categoria, busca, código de barras (Enter), favoritos e mais vendidos. Clique nos produtos para adicionar ao pedido; ajuste quantidades e observações. Use "Finalizar venda" para escolher forma de pagamento (dinheiro, cartão, Pix etc.); em dinheiro, informe o valor recebido para ver o troco. Botões: cancelar pedido, limpar carrinho, reabrir último pedido, imprimir comanda.
2. **Abas:** "Relatório de vendas do dia", "Relatório mensal", "Relatório anual", "BD ITEMS" e "Calculadora iFood".
3. **BD ITEMS:** itens vêm da calculadora de precificação; ative "Valor manual" para definir preço de venda. Categoria e código de barras (para o PDV) podem ser configurados quando suportado na tela.
4. "Limpar dia" (no relatório) remove apenas as vendas de hoje; "Limpar tudo" remove todo o histórico salvo do usuário.

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
2. Em `app.routes.ts`, adicionar uma rota com `loadComponent: () => import('...').then(m => m.NomeComponent)`. Se a rota for restrita a usuário logado, usar `canActivate: [authGuard]`; se for só para visitante (ex.: login), usar `canActivate: [loginGuard]`.
3. No shell (`app.html`), adicionar um link com `routerLink="/<path>"` e `routerLinkActive` para destaque (se a rota fizer parte do menu).
4. Se a nova tela usar componentes Preline (dropdown, tabs, etc.), o `autoInit()` já é chamado após `NavigationEnd`; não é necessário alterar o shell para isso.

### 5.4 Adicionar novo estado global

1. Criar um serviço em `src/app/core/` com `@Injectable({ providedIn: 'root' })`.
2. Usar `signal()` e `computed()` para estado reativo.
3. Para dados **por usuário**, usar `StorageService` (que já aplica o prefixo do usuário) ou injetar `AuthService` e usar `this.auth.storageKey('nomeDaChave')` ao ler/escrever no `localStorage`. Persistir após atualizações relevantes (ex.: método `persist()`).
4. Para dados globais (não por usuário), usar chave fixa no `localStorage` (ex.: `pricing-theme`).

### 5.5 Estilização (Tailwind / Preline)

- **Globais:** editar `src/styles.css` (Tailwind, Preline, `@plugin`, `@layer`). Não remover `@import "tailwindcss"` nem o `@source` do Preline.
- **Componente:** usar `class="..."` no template com utilitários Tailwind ou classes Preline. Para estilos específicos do componente, usar o `styleUrl` (ex.: `component.scss`) com o mínimo necessário; preferir utilitários no template.
- **Tema escuro:** usar prefixo `dark:` nas classes Tailwind quando quiser suporte a tema escuro (o shell já aplica `data-theme` no `<html>`).

### 5.6 Testes

- Testes em `*.spec.ts` (ex.: `app.spec.ts`, `pricing-state.service.spec.ts`, `pdv-cart.service.spec.ts`).
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

*Última atualização: documentação alinhada ao estado atual do projeto (login multi-usuário, rota padrão PDV, guards, temas light/dark/green-light/green-dark, estrutura core e features).*
