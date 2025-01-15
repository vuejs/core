module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testRegex: '/tests/.*\\.test\\.ts$',
  collectCoverage: true,
  coverageDirectory: 'coverage'
}
