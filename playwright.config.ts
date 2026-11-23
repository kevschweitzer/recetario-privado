import { defineConfig, devices } from '@playwright/test'

import { loadTestEnv } from './tests/helpers/loadTestEnv'

/**
 * Carga .env.test (base de datos de tests) en lugar de .env. El servidor que
 * levanta `webServer` hereda estas variables, y Next.js no pisa las que ya existen.
 */
loadTestEnv()

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/helpers/limpiarMedia.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Los archivos e2e comparten la base de tests: correrlos de a uno. */
  workers: 1,
  /* En modo dev, Next.js compila cada página la primera vez que se pide (>30 s en /admin). */
  timeout: 120_000,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    // No reutilizar un servidor ya levantado: podría ser el de desarrollo,
    // conectado a la base de desarrollo. Si el puerto 3000 está ocupado, falla.
    reuseExistingServer: false,
    url: 'http://localhost:3000',
  },
})
