import { defineConfig } from 'vite'
import { sizeReport } from './size-report'

export default defineConfig({
  define: {
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_OPTIONS_API__: true
  },
  build: {
    rollupOptions: {
      input: ['src/index.ts'],
      output: {
        entryFileNames: `[name].js`
      }
    },
    minify: 'terser'
  },
  plugins: [
    {
      name: 'size-report',
      buildEnd: () => sizeReport()
    }
  ]
})
