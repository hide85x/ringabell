import { defineConfig } from 'vitest/config'
import { cloudflarePool } from '@cloudflare/vitest-pool-workers'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['**/*.test.ts'],
          exclude: ['**/*.integration.test.ts', 'node_modules/**'],
          pool: cloudflarePool({
            wrangler: { configPath: './wrangler.toml' },
          }),
        },
      },
      {
        test: {
          name: 'integration',
          include: ['**/*.integration.test.ts'],
          exclude: ['node_modules/**'],
          pool: 'forks',
        },
      },
    ],
  },
})
