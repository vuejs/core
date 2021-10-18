'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/runtime-test.prod.cjs')
} else {
  module.exports = require('./dist/runtime-test.cjs')
}
