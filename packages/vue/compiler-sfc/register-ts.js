if (typeof require !== 'undefined') {
  try {
    require('@vue/compiler-sfc').registerTS(require('typescript'))
  } catch (e) {}
}
