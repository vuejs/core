if (typeof require !== 'undefined') {
  const loadTS = require('./load-ts.js')
  require('@vue/compiler-sfc').registerTS(() => loadTS(require))
}
