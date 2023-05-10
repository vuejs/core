export default {
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
  }
}
