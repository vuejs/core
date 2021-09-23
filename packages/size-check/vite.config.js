export default {
  resolve: {
    alias: {
      vue: '@vue/runtime-dom/dist/runtime-dom.esm-bundler.js'
    }
  },
  build: {
    rollupOptions: {
      input: ['src/index.ts'],
      output: {
        entryFileNames: `[name].js`
      }
    }
  }
}
