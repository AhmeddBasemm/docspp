import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/docs/e2e/**/*.test.ts', 'extensions/*/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
})
