const e2eTests = [
  'vue/__tests__/Transition',
  'vue/__tests__/TransitionGroup',
  'vue/examples/'
]

module.exports = list => {
  return {
    filtered: list
      .filter(t => e2eTests.some(tt => t.includes(tt)))
      .map(test => ({ test }))
  }
}

module.exports.e2eTests = e2eTests
