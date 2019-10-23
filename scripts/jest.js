/**
 * This file is the entry for debug single test file in vscode
 *
 * Why not use node_modules/.bin/jest ?
 * The node_modules/.bin/jest is not work for all operating system, see this issue https://github.com/microsoft/vscode-recipes/issues/107
 */

const jest = require('jest')

const argv = process.argv

argv.push('--config', 'jest.config.js')

jest.run(argv)
