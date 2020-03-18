/**
 * This file is the entry for debug single test file in vscode
 *
 * Not using node_modules/.bin/jest due to cross platform issues, see
 * https://github.com/microsoft/vscode-recipes/issues/107
 */
require('jest').run(process.argv)
