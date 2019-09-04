module.exports = {
  preset: 'ts-jest',
  globals: {
    __DEV__: true,
    __JSDOM__: true,
    __FEATURE_OPTIONS__: true,
    __FEATURE_PRODUCTION_TIP__: false
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'lcov', 'text'],
  collectCoverageFrom: ['packages/*/src/**/*.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@vue/(.*?)$': '<rootDir>/packages/$1/src'
  },
  rootDir: __dirname,
  testMatch: ['<rootDir>/packages/**/__tests__/**/*spec.[jt]s?(x)']
}
