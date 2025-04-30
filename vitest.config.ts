/// <reference types="vitest" />

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'], // optional
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
})
