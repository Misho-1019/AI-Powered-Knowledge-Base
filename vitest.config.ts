import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mirrors tsconfig `paths` (`@/*` -> `./src/*`) so tests import like app code.
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
