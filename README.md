# Doces - Precificação e PDV

Aplicação Angular com **Calculadora de Precificação** (receitas, custos, taxas, markup) e **PDV / Relatório diário de vendas**. Dados salvos localmente no navegador.

## Início rápido

```bash
npm install
npm start
```

Acesse `http://localhost:4200/`. A rota padrão é a calculadora de precificação (`/precificacao`). Use o menu para alternar para **PDV** (`/pdv`).

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm test` | Testes unitários (Vitest) |

## Documentação

Toda a documentação de **regras, utilização e desenvolvimento** do projeto está na pasta **`docs/`**:

- **[docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md)** — Regras, convenções, estrutura do projeto, como usar a aplicação e como desenvolver (novas features, estado, estilização, testes).

Novos arquivos `.md` para gerenciamento de regras e desenvolvimento devem ser criados em **`docs/`**.

## Stack

- Angular 21
- Tailwind CSS v4
- Preline UI
- Lucide (ícones)
- Vitest (testes)

---

Projeto gerado com [Angular CLI](https://github.com/angular/angular-cli) 21.2.1.
