/// <reference types="vitest" />

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'], // optional
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
})
