# Testes E2E (Playwright)

## Pré-requisito

- App rodando com **autenticação desabilitada** para acessar `/clientes` sem login:
  - **Local:** `DISABLE_AUTH=true npm run dev`
  - **CI:** o `playwright.config.ts` já define `DISABLE_AUTH=true` no `webServer` quando `CI=true`.

## Comandos

| Comando | Descrição |
|--------|------------|
| `npm run test:e2e` | Roda todos os testes E2E (headless). Requer app em execução com `DISABLE_AUTH=true`. |
| `npm run test:e2e:customer-person` | Roda apenas o spec "Cadastrar cliente (pessoa)". |
| `npm run test:e2e:ui` | Abre a UI do Playwright para debugar. |
| `npm run test:e2e:headed` | Roda com browser visível. |

## Local (desenvolvimento)

1. Em um terminal: `DISABLE_AUTH=true npm run dev`
2. Em outro: `npm run test:e2e:customer-person`

## CI (headless)

```bash
CI=true npm run test:e2e -- --project=chromium
```

O config sobe a app automaticamente (`npm run build && npm run start`) com `DISABLE_AUTH=true`.

## Instalar browsers (primeira vez)

```bash
npx playwright install
# ou só Chromium:
npx playwright install chromium
```
