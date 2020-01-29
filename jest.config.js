module.exports = {
  preset: 'ts-jest',
  globals: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: require('./package.json').version,
    __BROWSER__: false,
    __BUNDLER__: true,
    __RUNTIME_COMPILE__: true,
    __NODE_JS__: true,
    __FEATURE_OPTIONS__: true,
    __FEATURE_SUSPENSE__: true
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'lcov', 'text'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/runtime-test/src/utils/**',
    '!packages/template-explorer/**',
    '!packages/size-check/**'
  ],
  watchPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@vue/(.*?)$': '<rootDir>/packages/$1/src',
    vue: '<rootDir>/packages/vue/src'
  },
  rootDir: __dirname,
  testMatch: ['<rootDir>/packages/**/__tests__/**/*spec.[jt]s?(x)'],
  testPathIgnorePatterns: process.env.SKIP_E2E
    ? // ignore example tests on netlify builds since they don't contribute
      // to coverage and can cause netlify builds to fail
      ['/node_modules/', '/examples/__tests__']
    : ['/node_modules/']
}
