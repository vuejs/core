const { compress } = require('brotli')

const file = require('fs').readFileSync('dist/index.js')
const compressed = compress(file)
const compressedSize = (compressed.length / 1024).toFixed(2) + 'kb'
console.log(`brotli: ${compressedSize}`)
