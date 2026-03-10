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
      '@thefairies/design-system/components': resolve(
        __dirname,
        './node_modules/@thefairies/design-system/src/components/index.ts'
      ),
      '@thefairies/design-system/styles/tokens.css': resolve(
        __dirname,
        './node_modules/@thefairies/design-system/src/styles/tokens.css'
      ),
      '@thefairies/design-system/styles/animations.css': resolve(
        __dirname,
        './node_modules/@thefairies/design-system/src/styles/animations.css'
      ),
    },
  },
})
