'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/runtime-shared.cjs.prod.js')
} else {
  module.exports = require('./dist/runtime-shared.cjs.js')
}
