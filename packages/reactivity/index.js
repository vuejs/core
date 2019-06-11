'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/reactivity.cjs.prod.js.js')
} else {
  module.exports = require('./dist/reactivity.cjs.js.js')
}
