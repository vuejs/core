# @vue/reactivity-transform

> ⚠️ This is experimental and the proposal has been dropped.
> The feature is now marked as deprecated and will be removed from Vue core
> in 3.4.
>
> See reason for deprecation [here](https://github.com/vuejs/rfcs/discussions/369#discussioncomment-5059028).

## Basic Rules

- Ref-creating APIs have `$`-prefixed versions that create reactive variables instead. They also do not need to be explicitly imported. These include:
  - `ref`
  - `computed`
  - `shallowRef`
  - `customRef`
  - `toRef`
- `$()` can be used to destructure an object into reactive variables, or turn existing refs into reactive variables
- `$$()` to "escape" the transform, which allows access to underlying refs

```js
import { watchEffect } from 'vue'

// bind ref as a variable
let count = $ref(0)

watchEffect(() => {
  // no need for .value
  console.log(count)
})

// assignments are reactive
count++

// get the actual ref
console.log($$(count)) // { value: 1 }
```

Macros can be optionally imported to make it more explicit:

```js
// not necessary, but also works
import { $, $ref } from 'vue/macros'

let count = $ref(0)
const { x, y } = $(useMouse())
```

### Global Types

To enable types for the macros globally, include the following in a `.d.ts` file:

```ts
/// <reference types="vue/macros-global" />
```

## API

This package is the lower-level transform that can be used standalone. Higher-level tooling (e.g. `@vitejs/plugin-vue` and `vue-loader`) will provide integration via options.

### `shouldTransform`

Can be used to do a cheap check to determine whether full transform should be performed.

```js
import { shouldTransform } from '@vue/reactivity-transform'

shouldTransform(`let a = ref(0)`) // false
shouldTransform(`let a = $ref(0)`) // true
```

### `transform`

```js
import { transform } from '@vue/reactivity-transform'

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
  parserPlugins: [
    /* ... */
  ]
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
import { transformAST } from '@vue/reactivity-transform'
import { parse } from '@babel/parser'
import MagicString from 'magic-string'

const src = `let a = $ref(0); a++`
const ast = parse(src, { sourceType: 'module' })
const s = new MagicString(src)

const {
  rootRefs, // ['a']
  importedHelpers // ['ref']
} = transformAST(ast, s)

console.log(s.toString()) // let a = _ref(0); a.value++
```
