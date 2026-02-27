import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração E2E com Playwright.
 * Rodar com a app em execução (npm run dev) ou usar webServer para subir automaticamente.
 *
 * Local:  npx playwright test
 * CI:     npx playwright test --project=chromium
 * UI:     npx playwright test --ui
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120_000,
        env: { ...process.env, DISABLE_AUTH: "true" },
      }
    : undefined,
});
