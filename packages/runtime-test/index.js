'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/runtime-test.cjs.prod.js')
} else {
  module.exports = require('./dist/runtime-test.cjs.js')
}
