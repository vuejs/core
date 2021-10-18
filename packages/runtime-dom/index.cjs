'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/runtime-dom.prod.cjs')
} else {
  module.exports = require('./dist/runtime-dom.cjs')
}
