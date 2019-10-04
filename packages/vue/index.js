'use strict'

module.exports = process.env.NODE_ENV === 'production' ? 
  require('./dist/vue.cjs.prod.js') : 
  require('./dist/vue.cjs.js')
