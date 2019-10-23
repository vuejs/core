const jest = require('jest')

const argv = process.argv

argv.push('--config', 'jest.config.js')

jest.run(argv)
