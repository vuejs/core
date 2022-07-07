const path = require('path')
const { e2eTests } = require('./filter-e2e')

module.exports = list => {
  return {
    filtered: list
      .filter(t => !e2eTests.some(tt => t.includes(path.normalize(tt))))
      .map(test => ({ test }))
  }
}
