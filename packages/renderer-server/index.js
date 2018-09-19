'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/renderer-server.cjs.prod.js')
} else {
  module.exports = require('./dist/renderer-server.cjs.js')
}
