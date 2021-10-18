'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/reactivity.prod.cjs')
} else {
  module.exports = require('./dist/reactivity.cjs')
}
