// Run Rollup in watch mode for a single package for development.
// Only the ES modules format will be generated, as it is expected to be tested
// in a modern browser using <script type="module">.
// Defaults to watch the `vue` meta package.
// To specific the package to watch, simply pass its name. e.g.
// ```
// yarn dev observer
// ```

const execa = require('execa')
const { targets, fuzzyMatchTarget } = require('./utils')

const target = fuzzyMatchTarget(process.argv[2] || 'runtime-dom')

execa(
  'rollup',
  [
    '-wc',
    '--environment',
    `TARGET:${target},FORMATS:umd`
  ],
  {
    stdio: 'inherit'
  }
)
