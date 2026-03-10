import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // The DS barrel index.ts references many components not yet shipped in the
      // installed package version. These aliases point vitest at a thin stub that
      // only re-exports what actually exists, avoiding resolution errors.
      // Next.js (with transpilePackages) resolves the real DS package at build time.
      '@thefairies/design-system/components': resolve(
        __dirname,
        './src/test/__mocks__/@thefairies/design-system/components.ts'
      ),
      '__DS_COMPONENTS__': resolve(
        __dirname,
        './node_modules/@thefairies/design-system/src/components'
      ),
    },
  },
})
