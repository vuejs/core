'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/compat.cjs.prod.js')
} else {
  module.exports = require('./dist/compat.cjs.js')
}
