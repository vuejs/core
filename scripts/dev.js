/*
Run Rollup in watch mode for development.

To specific the package to watch, simply pass its name and the desired build
formats to watch (defaults to "global"):

```
# name supports fuzzy match. will watch all packages with name containing "dom"
yarn dev dom

# specify the format to output
yarn dev core --formats cjs
```
*/

const execa = require('execa')
const { targets, fuzzyMatchTarget } = require('./utils')

const args = require('minimist')(process.argv.slice(2))
const target = fuzzyMatchTarget(args._[0] || 'renderer-dom')
const formats = args.formats || args.f

execa(
  'rollup',
  ['-wc', '--environment', `TARGET:${target},FORMATS:${formats || 'global'}`],
  {
    stdio: 'inherit'
  }
)
