# @vue/ref-transform

> ⚠️ This is experimental and currently only provided for testing and feedback. It may break during patches or even be removed. Use at your own risk!
>
> Follow https://github.com/vuejs/rfcs/discussions/369 for details and updates.

## Basic Rules

- `$()` to turn refs into reative variables
- `$$()` to access the original refs from reative variables

```js
import { ref, watch } from 'vue'

// bind ref as a variable
let count = $(ref(0))

// no need for .value
console.log(count)

// get the actual ref
watch($$(count), c => console.log(`count changed to ${c}`))

// assignments are reactive
count++
```

### Shorthands

A few commonly used APIs have shorthands (which also removes the need to import them):

- `$(ref(0))` -> `$ref(0)`
- `$(computed(() => 123))` -> `$computed(() => 123)`
- `$(shallowRef({}))` -> `$shallowRef({})`

## API

This package is the lower-level transform that can be used standalone. Higher-level tooling (e.g. `@vitejs/plugin-vue` and `vue-loader`) will provide integration via options.

### `transform`

```js
import { transform } from '@vue/ref-transform'

const src = `let a = $ref(0); a++`
const {
  code, // import { ref as _ref } from 'vue'; let a = (ref(0)); a.value++"
  map
} = transform(src, {
  filename: 'foo.ts',
  sourceMap: true,
  parserPlugins: ['typescript']
})
```

**Options**

```ts
interface RefTransformOptions {
  filename?: string
  sourceMap?: boolean // default: false
  parserPlugins?: ParserPlugin[]
  importHelpersFrom?: string // default: "vue"
}
```

### `transformAST`

```js
import { transformAST } from '@vue/ref-transform'
import { parse } from '@babel/parser'
import MagicString from 'magic-string'

const src = `let a = $ref(0); a++`
const ast = parse(src, { sourceType: 'module' })
const s = new MagicString(src)

const {
  rootVars, // ['a']
  importedHelpers // ['ref']
} = transformAST(ast, s)

console.log(s.toString()) // let a = _ref(0); a.value++
```
