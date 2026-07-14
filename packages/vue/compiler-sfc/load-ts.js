module.exports = function loadTS(load) {
  try {
    const ts = load('typescript')
    if (typeof ts?.resolveModuleName === 'function') {
      return ts
    }
  } catch (err) {
    if (err?.code !== 'MODULE_NOT_FOUND') {
      throw err
    }
  }
  return load('@typescript/typescript6')
}
