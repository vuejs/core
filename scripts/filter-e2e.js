const e2eTests = ['/Transition', '/TransitionGroup', '/examples/']

module.exports = list => {
  return {
    filtered: list
      .filter(t => e2eTests.some(tt => t.includes(tt)))
      .map(test => ({ test }))
  }
}

module.exports.e2eTests = e2eTests
