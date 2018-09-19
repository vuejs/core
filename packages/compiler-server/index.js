'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/compiler-server.cjs.prod.js')
} else {
  module.exports = require('./dist/compiler-server.cjs.js')
}
