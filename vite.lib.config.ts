import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Separate config for building the publishable package (`npm run build:lib`),
// kept apart from the default app build (`npm run build`) which produces the
// demo playground in `dist/`.
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src/lib'], tsconfigPath: './tsconfig.app.json', rollupTypes: true }),
  ],
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: resolve(import.meta.dirname, 'src/lib/index.ts'),
      name: 'AnimationEngineering',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
})
