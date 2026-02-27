/**
 * E2E: fluxo "Clientes → Cadastrar cliente (pessoa)".
 *
 * Como rodar:
 *   Local (app já rodando):  npx playwright test tests/e2e/customer-person-registration.spec.ts
 *   Local com app automático: DISABLE_AUTH=true npm run dev (em outro terminal) e npx playwright test tests/e2e/customer-person-registration.spec.ts
 *   Headless/CI:            npx playwright test tests/e2e/customer-person-registration.spec.ts --project=chromium
 *   Com UI:                 npx playwright test tests/e2e/customer-person-registration.spec.ts --ui
 *
 * Requisito: para acessar /clientes sem login, rode a app com DISABLE_AUTH=true (desenvolvimento/CI).
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const NEW_PERSON_URL = `${BASE.replace(/\/$/, "")}/clientes/new`;

function randomEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@empresa.com`;
}

test.describe("Cadastrar cliente (pessoa) - Renderização e campos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }
  });

  test("página carrega com título e formulário visível", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Cadastrar cliente (pessoa)", level: 1 })).toBeVisible();
    await expect(page.getByTestId("person-group-form")).toBeVisible();
  });

  test("todos os campos existem e estão habilitados", async ({ page }) => {
    const form = page.getByTestId("person-group-form");

    await expect(form.getByTestId("person-fullName")).toBeEnabled();
    await expect(form.getByTestId("person-givenName")).toBeEnabled();
    await expect(form.getByTestId("person-surName")).toBeEnabled();
    await expect(form.getByTestId("person-citizenshipCountry")).toBeEnabled();
    await expect(form.getByTestId("person-phone")).toBeEnabled();
    await expect(form.getByTestId("person-email")).toBeEnabled();
    await expect(form.getByTestId("person-address-line1")).toBeEnabled();
    await expect(form.getByTestId("person-address-line2")).toBeEnabled();
    await expect(form.getByTestId("person-address-city")).toBeEnabled();
    await expect(form.getByTestId("person-address-stateProvince")).toBeEnabled();
    await expect(form.getByTestId("person-address-postalCode")).toBeEnabled();
    await expect(form.getByTestId("person-address-country")).toBeEnabled();
    await expect(form.getByTestId("person-submit")).toBeEnabled();
  });

  test("campos obrigatórios exibem asterisco no label", async ({ page }) => {
    await expect(page.getByLabel(/Nome completo \*/)).toBeVisible();
    await expect(page.getByLabel(/Given Name \*/)).toBeVisible();
    await expect(page.getByLabel(/Sobrenome \*/)).toBeVisible();
    await expect(page.getByText("Cidadania *")).toBeVisible();
    await expect(page.getByLabel(/E-mail pessoal \*/)).toBeVisible();
    await expect(page.getByLabel(/Linha 1 \*/)).toBeVisible();
    await expect(page.getByLabel(/Cidade \*/)).toBeVisible();
    await expect(page.getByLabel(/Estado\/Província \*/)).toBeVisible();
    await expect(page.getByLabel(/Código postal \*/)).toBeVisible();
    await expect(page.getByText("País *", { exact: true }).first()).toBeVisible();
  });

  test("Telefone e Linha 2 não têm asterisco (opcionais)", async ({ page }) => {
    await expect(page.getByLabel("Telefone")).toBeVisible();
    await expect(page.getByLabel("Linha 2")).toBeVisible();
  });
});

test.describe("Cadastrar cliente (pessoa) - Validação de obrigatórios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }
  });

  test("submit vazio exibe erros nos campos obrigatórios", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-submit").click();

    await expect(page.getByTestId("error-fullName")).toHaveText("Nome completo é obrigatório");
    await expect(page.getByTestId("error-givenName")).toHaveText("Given name é obrigatório");
    await expect(page.getByTestId("error-surName")).toHaveText("Sobrenome é obrigatório");
    await expect(page.getByTestId("error-citizenshipCountry")).toHaveText("Cidadania é obrigatória");
    await expect(page.getByTestId("error-email")).toBeVisible();
    await expect(page.getByTestId("error-address-line1")).toHaveText("Endereço (linha 1) é obrigatório");
    await expect(page.getByTestId("error-address-city")).toHaveText("Cidade é obrigatória");
    await expect(page.getByTestId("error-address-stateProvince")).toHaveText("Estado/Província é obrigatório");
    await expect(page.getByTestId("error-address-postalCode")).toHaveText("Código postal é obrigatório");
    await expect(page.getByTestId("error-address-country")).toHaveText("País é obrigatório");
  });

  test("Telefone e Linha 2 vazios não geram erro", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-submit").click();

    await expect(page.getByTestId("person-group-form")).not.toContainText("Telefone é obrigatório");
    await expect(page.locator("[data-testid^='error-']")).not.toContainText("Linha 2");
  });
});

test.describe("Cadastrar cliente (pessoa) - Validações de formato", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }
  });

  test("e-mail inválido exibe erro", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-email").fill("abc");
    await form.getByTestId("person-submit").click();
    await expect(page.getByTestId("error-email")).toHaveText("E-mail inválido");
  });

  test("e-mail válido é aceito (não exibe E-mail inválido)", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-email").fill("qa+1@empresa.com");
    await form.getByTestId("person-submit").click();
    await expect(page.locator("[data-testid='error-email']")).not.toHaveText("E-mail inválido");
  });

  test("código postal vazio exibe erro; valor válido é aceito", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-submit").click();
    await expect(page.getByTestId("error-address-postalCode")).toHaveText("Código postal é obrigatório");

    await form.getByTestId("person-address-postalCode").fill("10001");
    await form.getByTestId("person-submit").click();
    await expect(page.getByTestId("error-address-postalCode")).not.toBeVisible();
  });

  test("Estado/Província obrigatório e aceita texto", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-submit").click();
    await expect(page.getByTestId("error-address-stateProvince")).toHaveText("Estado/Província é obrigatório");

    await form.getByTestId("person-address-stateProvince").fill("SP");
    await form.getByTestId("person-submit").click();
    await expect(page.getByTestId("error-address-stateProvince")).not.toBeVisible();
  });
});

test.describe("Cadastrar cliente (pessoa) - Selects (Cidadania e País)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }
  });

  test("Cidadania: abrir, buscar e selecionar Brasil", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-citizenshipCountry").click();
    await expect(page.getByPlaceholder("Buscar país...")).toBeVisible();
    await page.getByPlaceholder("Buscar país...").fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).click();
    await expect(form.getByTestId("person-citizenshipCountry")).toContainText("Brasil");
  });

  test("País (endereço): abrir, buscar e selecionar Brasil", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-address-country").click();
    await expect(page.getByPlaceholder("Buscar país...")).toBeVisible();
    await page.getByPlaceholder("Buscar país...").last().fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).last().click();
    await expect(form.getByTestId("person-address-country")).toContainText("Brasil");
  });

  test("valor selecionado no select persiste (não volta ao placeholder)", async ({ page }) => {
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-citizenshipCountry").click();
    await page.getByPlaceholder("Buscar país...").fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).first().click();
    await expect(form.getByTestId("person-citizenshipCountry")).toHaveText("Brasil");
    await form.getByTestId("person-fullName").focus();
    await expect(form.getByTestId("person-citizenshipCountry")).toHaveText("Brasil");
  });
});

test.describe("Cadastrar cliente (pessoa) - Fluxo feliz (submit)", () => {
  test("preencher com dados válidos e submeter redireciona para /clientes/pagadores/[id] e registro aparece na lista", async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }

    const fullName = "Maria E2E Silva Lista";
    const email = randomEmail();
    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-fullName").fill(fullName);
    await form.getByTestId("person-givenName").fill("Maria");
    await form.getByTestId("person-surName").fill("Silva");
    await form.getByTestId("person-citizenshipCountry").click();
    await page.getByPlaceholder("Buscar país...").fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).first().click();
    await form.getByTestId("person-email").fill(email);
    await form.getByTestId("person-address-line1").fill("Rua Teste 123");
    await form.getByTestId("person-address-city").fill("São Paulo");
    await form.getByTestId("person-address-stateProvince").fill("SP");
    await form.getByTestId("person-address-postalCode").fill("01310-100");
    await form.getByTestId("person-address-country").click();
    await page.getByPlaceholder("Buscar país...").last().fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).last().click();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/person-groups") && res.request().method() === "POST",
      { timeout: 15_000 }
    );

    await form.getByTestId("person-submit").click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty("personGroupId");
    const personGroupId = body.personGroupId as string;
    expect(typeof personGroupId).toBe("string");

    const basePath = BASE.replace(/\/$/, "");
    await expect(page).toHaveURL(new RegExp(`^${basePath}/clientes/pagadores/[a-f0-9-]+$`));
    await expect(page).toHaveURL(`${basePath}/clientes/pagadores/${personGroupId}`);

    await page.goto(`${basePath}/clientes?tab=customers`);
    await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
    const listTable = page.getByRole("table").first();
    await expect(listTable.getByText(fullName)).toBeVisible();
    await expect(listTable.getByText(email)).toBeVisible();
  });

  test("payload da request contém campos principais", async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }

    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-fullName").fill("João E2E Payload");
    await form.getByTestId("person-givenName").fill("João");
    await form.getByTestId("person-surName").fill("Payload");
    await form.getByTestId("person-citizenshipCountry").click();
    await page.getByPlaceholder("Buscar país...").fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).first().click();
    const email = randomEmail();
    await form.getByTestId("person-email").fill(email);
    await form.getByTestId("person-address-line1").fill("Av Payload 1");
    await form.getByTestId("person-address-city").fill("Rio");
    await form.getByTestId("person-address-stateProvince").fill("RJ");
    await form.getByTestId("person-address-postalCode").fill("20000-000");
    await form.getByTestId("person-address-country").click();
    await page.getByPlaceholder("Buscar país...").last().fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).last().click();

    let requestBody: unknown = null;
    page.on("request", (req) => {
      if (req.url().includes("/api/person-groups") && req.method() === "POST") {
        requestBody = req.postDataJSON();
      }
    });

    await form.getByTestId("person-submit").click();
    await page.waitForURL(new RegExp(`^${BASE.replace(/\/$/, "")}/clientes/pagadores/[a-f0-9-]+$`), { timeout: 15_000 }).catch(() => {});

    expect(requestBody).not.toBeNull();
    const body = requestBody as Record<string, unknown>;
    expect(body.fullName).toBe("João E2E Payload");
    expect(body.givenName).toBe("João");
    expect(body.surName).toBe("Payload");
    expect(body.email).toBe(email);
    expect(body.citizenshipCountry).toBe("Brasil");
    expect(body.address).toBeDefined();
    const addr = body.address as Record<string, unknown>;
    expect(addr.line1).toBe("Av Payload 1");
    expect(addr.city).toBe("Rio");
    expect(addr.stateProvince).toBe("RJ");
    expect(addr.postalCode).toBe("20000-000");
    expect(addr.country).toBe("Brasil");
  });
});

test.describe("Cadastrar cliente (pessoa) - Erro da API", () => {
  test("resposta 500 exibe mensagem amigável", async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }

    await page.route("**/api/person-groups", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 500, body: JSON.stringify({ error: "Erro ao cadastrar pessoa" }) });
      } else {
        route.continue();
      }
    });

    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-fullName").fill("Erro 500");
    await form.getByTestId("person-givenName").fill("Erro");
    await form.getByTestId("person-surName").fill("500");
    await form.getByTestId("person-citizenshipCountry").click();
    await page.getByPlaceholder("Buscar país...").fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).first().click();
    await form.getByTestId("person-email").fill(randomEmail());
    await form.getByTestId("person-address-line1").fill("Rua 1");
    await form.getByTestId("person-address-city").fill("Cidade");
    await form.getByTestId("person-address-stateProvince").fill("SP");
    await form.getByTestId("person-address-postalCode").fill("01000");
    await form.getByTestId("person-address-country").click();
    await page.getByPlaceholder("Buscar país...").last().fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).last().click();

    await form.getByTestId("person-submit").click();

    await expect(page.getByTestId("form-error-alert")).toBeVisible();
    await expect(page.getByTestId("form-error-alert")).toContainText("Erro ao cadastrar");
    await expect(page).toHaveURL(NEW_PERSON_URL);
  });

  test("resposta 400 exibe mensagem do servidor", async ({ page }) => {
    await page.goto(NEW_PERSON_URL);
    if (page.url().includes("/login")) {
      throw new Error("Página redirecionou para /login. Rode a app com DISABLE_AUTH=true (ex.: DISABLE_AUTH=true npm run dev).");
    }

    await page.route("**/api/person-groups", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 400,
          body: JSON.stringify({ error: "E-mail já cadastrado" }),
        });
      } else {
        route.continue();
      }
    });

    const form = page.getByTestId("person-group-form");
    await form.getByTestId("person-fullName").fill("Conflict");
    await form.getByTestId("person-givenName").fill("Conflict");
    await form.getByTestId("person-surName").fill("User");
    await form.getByTestId("person-citizenshipCountry").click();
    await page.getByPlaceholder("Buscar país...").fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).first().click();
    await form.getByTestId("person-email").fill(randomEmail());
    await form.getByTestId("person-address-line1").fill("Rua 1");
    await form.getByTestId("person-address-city").fill("Cidade");
    await form.getByTestId("person-address-stateProvince").fill("SP");
    await form.getByTestId("person-address-postalCode").fill("01000");
    await form.getByTestId("person-address-country").click();
    await page.getByPlaceholder("Buscar país...").last().fill("Brasil");
    await page.getByRole("button", { name: "Brasil" }).last().click();

    await form.getByTestId("person-submit").click();

    await expect(page.getByTestId("form-error-alert")).toBeVisible();
    await expect(page.getByTestId("form-error-alert")).toContainText("E-mail já cadastrado");
  });
});
