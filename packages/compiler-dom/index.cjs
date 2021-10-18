'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/compiler-dom.prod.cjs')
} else {
  module.exports = require('./dist/compiler-dom.cjs')
}
