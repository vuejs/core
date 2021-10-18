'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/server-renderer.prod.cjs')
} else {
  module.exports = require('./dist/server-renderer.cjs')
}
