import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    deps: {
      inline: ['react-pdf'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mock react-pdf CSS imports
      'react-pdf/dist/Page/AnnotationLayer.css': path.resolve(__dirname, './src/test/empty-mock.ts'),
      'react-pdf/dist/Page/TextLayer.css': path.resolve(__dirname, './src/test/empty-mock.ts'),
    },
  },
})
