import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globalSetup: ['./tests/helpers/limpiarMedia.ts'],
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Los archivos de tests comparten la base de tests y la vacían entre casos:
    // correrlos en paralelo haría que se pisen los datos.
    fileParallelism: false,
    // Cada caso crea varios usuarios (con hash de contraseña) en una base real.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
