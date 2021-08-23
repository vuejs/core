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

### `shouldTransform`

Can be used to do a cheap check to determine whether full transform should be performed.

```js
import { shouldTransform } from '@vue/ref-transform'

shouldTransform(`let a = ref(0)`) // false
shouldTransform(`let a = $ref(0)`) // true
```

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

  // @babel/parser plugins to enable.
  // 'typescript' and 'jsx' will be auto-inferred from filename if provided,
  // so in most cases explicit parserPlugins are not necessary
  parserPlugins: [/* ... */]
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

Transform with an existing Babel AST + MagicString instance. This is used internally by `@vue/compiler-sfc` to avoid double parse/transform cost.

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
