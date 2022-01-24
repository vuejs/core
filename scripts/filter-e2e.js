const e2eTests = ['/Transition', '/TransitionGroup', '/examples/']
const path = require('path')

module.exports = list => {
  return {
    filtered: list
      .filter(t => e2eTests.some(tt => t.includes(path.normalize(tt))))
      .map(test => ({ test }))
  }
}

module.exports.e2eTests = e2eTests
