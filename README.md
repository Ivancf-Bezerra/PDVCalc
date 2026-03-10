# Doces - Precificação e PDV

Aplicação Angular com **login multi-usuário**, **Calculadora de Precificação** (receitas, custos, taxas, markup) e **PDV / Relatório de vendas**. Dados salvos localmente no navegador, isolados por usuário.

## Início rápido

```bash
npm install
npm start
```

Acesse `http://localhost:4200/`. Se não houver usuário logado, a aplicação exibe a tela de **Login**; após entrar, a rota padrão é o **PDV** (`/pdv`). Use o menu lateral para alternar entre **PDV** e **Calculadora** (`/precificacao`).

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm test` | Testes unitários (Vitest) |

## Documentação

Toda a documentação de **regras, utilização e desenvolvimento** do projeto está na pasta **`docs/`**:

- **[docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md)** — Regras, convenções, estrutura do projeto, autenticação, como usar a aplicação e como desenvolver (novas features, estado, estilização, testes).

Novos arquivos `.md` para gerenciamento de regras e desenvolvimento devem ser criados em **`docs/`**.

## Stack

- Angular 21
- Tailwind CSS v4
- Preline UI
- Lucide (ícones)
- Vitest (testes)

---

Projeto gerado com [Angular CLI](https://github.com/angular/angular-cli) 21.2.1.
