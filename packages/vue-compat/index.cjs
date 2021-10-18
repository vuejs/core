'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/vue.prod.cjs')
} else {
  module.exports = require('./dist/vue.cjs')
}
