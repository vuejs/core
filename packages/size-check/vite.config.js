export default {
  build: {
    rollupOptions: {
      input: ['src/index.ts'],
      output: {
        entryFileNames: `[name].js`
      }
    }
  }
}
