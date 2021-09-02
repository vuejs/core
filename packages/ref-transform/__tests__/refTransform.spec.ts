import { parse } from '@babel/parser'
import { babelParserDefaultPlugins } from '@vue/shared'
import { transform } from '../src'

function assertCode(code: string) {
  // parse the generated code to make sure it is valid
  try {
    parse(code, {
      sourceType: 'module',
      plugins: [...babelParserDefaultPlugins, 'typescript']
    })
  } catch (e: any) {
    console.log(code)
    throw e
  }
  expect(code).toMatchSnapshot()
}

test('$ unwrapping', () => {
  const { code, rootVars } = transform(`
    import { ref, shallowRef } from 'vue'
    let foo = $(ref())
    let a = $(ref(1))
    let b = $(shallowRef({
      count: 0
    }))
    let c = () => {}
    let d
    `)
  expect(code).not.toMatch(`$(ref())`)
  expect(code).not.toMatch(`$(ref(1))`)
  expect(code).not.toMatch(`$(shallowRef({`)
  expect(code).toMatch(`let foo = (ref())`)
  expect(code).toMatch(`let a = (ref(1))`)
  expect(code).toMatch(`
    let b = (shallowRef({
      count: 0
    }))
    `)
  // normal declarations left untouched
  expect(code).toMatch(`let c = () => {}`)
  expect(code).toMatch(`let d`)
  expect(rootVars).toStrictEqual(['foo', 'a', 'b'])
  assertCode(code)
})

test('$ref & $shallowRef declarations', () => {
  const { code, rootVars, importedHelpers } = transform(`
    let foo = $ref()
    let a = $ref(1)
    let b = $shallowRef({
      count: 0
    })
    let c = () => {}
    let d
    `)
  expect(code).toMatch(
    `import { ref as _ref, shallowRef as _shallowRef } from 'vue'`
  )
  expect(code).not.toMatch(`$ref()`)
  expect(code).not.toMatch(`$ref(1)`)
  expect(code).not.toMatch(`$shallowRef({`)
  expect(code).toMatch(`let foo = _ref()`)
  expect(code).toMatch(`let a = _ref(1)`)
  expect(code).toMatch(`
    let b = _shallowRef({
      count: 0
    })
    `)
  // normal declarations left untouched
  expect(code).toMatch(`let c = () => {}`)
  expect(code).toMatch(`let d`)
  expect(rootVars).toStrictEqual(['foo', 'a', 'b'])
  expect(importedHelpers).toStrictEqual(['ref', 'shallowRef'])
  assertCode(code)
})

test('multi $ref declarations', () => {
  const { code, rootVars, importedHelpers } = transform(`
    let a = $ref(1), b = $ref(2), c = $ref({
      count: 0
    })
    `)
  expect(code).toMatch(`
    let a = _ref(1), b = _ref(2), c = _ref({
      count: 0
    })
    `)
  expect(rootVars).toStrictEqual(['a', 'b', 'c'])
  expect(importedHelpers).toStrictEqual(['ref'])
  assertCode(code)
})

test('$computed declaration', () => {
  const { code, rootVars, importedHelpers } = transform(`
    let a = $computed(() => 1)
    `)
  expect(code).toMatch(`
    let a = _computed(() => 1)
    `)
  expect(rootVars).toStrictEqual(['a'])
  expect(importedHelpers).toStrictEqual(['computed'])
  assertCode(code)
})

test('mixing $ref & $computed declarations', () => {
  const { code, rootVars, importedHelpers } = transform(`
    let a = $ref(1), b = $computed(() => a + 1)
    `)
  expect(code).toMatch(`
    let a = _ref(1), b = _computed(() => a.value + 1)
    `)
  expect(rootVars).toStrictEqual(['a', 'b'])
  expect(importedHelpers).toStrictEqual(['ref', 'computed'])
  assertCode(code)
})

test('accessing ref binding', () => {
  const { code } = transform(`
    let a = $ref(1)
    console.log(a)
    function get() {
      return a + 1
    }
    `)
  expect(code).toMatch(`console.log(a.value)`)
  expect(code).toMatch(`return a.value + 1`)
  assertCode(code)
})

test('cases that should not append .value', () => {
  const { code } = transform(`
    let a = $ref(1)
    console.log(b.a)
    function get(a) {
      return a + 1
    }
    `)
  expect(code).not.toMatch(`a.value`)
})

test('mutating ref binding', () => {
  const { code } = transform(`
    let a = $ref(1)
    let b = $ref({ count: 0 })
    function inc() {
      a++
      a = a + 1
      b.count++
      b.count = b.count + 1
      ;({ a } = { a: 2 })
      ;[a] = [1]
    }
    `)
  expect(code).toMatch(`a.value++`)
  expect(code).toMatch(`a.value = a.value + 1`)
  expect(code).toMatch(`b.value.count++`)
  expect(code).toMatch(`b.value.count = b.value.count + 1`)
  expect(code).toMatch(`;({ a: a.value } = { a: 2 })`)
  expect(code).toMatch(`;[a.value] = [1]`)
  assertCode(code)
})

test('using ref binding in property shorthand', () => {
  const { code } = transform(`
    let a = $ref(1)
    const b = { a }
    function test() {
      const { a } = b
    }
    `)
  expect(code).toMatch(`const b = { a: a.value }`)
  // should not convert destructure
  expect(code).toMatch(`const { a } = b`)
  assertCode(code)
})

test('should not rewrite scope variable', () => {
  const { code } = transform(`

      let a = $ref(1)
      let b = $ref(1)
      let d = $ref(1)
      const e = 1
      function test() {
        const a = 2
        console.log(a)
        console.log(b)
        let c = { c: 3 }
        console.log(c)
        console.log(d)
        console.log(e)
      }
    `)
  expect(code).toMatch('console.log(a)')
  expect(code).toMatch('console.log(b.value)')
  expect(code).toMatch('console.log(c)')
  expect(code).toMatch('console.log(d.value)')
  expect(code).toMatch('console.log(e)')
  assertCode(code)
})

test('object destructure', () => {
  const { code, rootVars } = transform(`
    let n = $ref(1), { a, b: c, d = 1, e: f = 2, ...g } = $(useFoo())
    let { foo } = $(useSomthing(() => 1));
    console.log(n, a, c, d, f, g, foo)
    `)
  expect(code).toMatch(
    `let n = _ref(1), { a: __a, b: __c, d: __d = 1, e: __f = 2, ...__g } = (useFoo())`
  )
  expect(code).toMatch(`let { foo: __foo } = (useSomthing(() => 1))`)
  expect(code).toMatch(`\nconst a = _shallowRef(__a);`)
  expect(code).not.toMatch(`\nconst b = _shallowRef(__b);`)
  expect(code).toMatch(`\nconst c = _shallowRef(__c);`)
  expect(code).toMatch(`\nconst d = _shallowRef(__d);`)
  expect(code).not.toMatch(`\nconst e = _shallowRef(__e);`)
  expect(code).toMatch(`\nconst f = _shallowRef(__f);`)
  expect(code).toMatch(`\nconst g = _shallowRef(__g);`)
  expect(code).toMatch(`\nconst foo = _shallowRef(__foo);`)
  expect(code).toMatch(
    `console.log(n.value, a.value, c.value, d.value, f.value, g.value, foo.value)`
  )
  expect(rootVars).toStrictEqual(['n', 'a', 'c', 'd', 'f', 'g', 'foo'])
  assertCode(code)
})

test('array destructure', () => {
  const { code, rootVars } = transform(`
    let n = $ref(1), [a, b = 1, ...c] = $(useFoo())
    console.log(n, a, b, c)
    `)
  expect(code).toMatch(`let n = _ref(1), [__a, __b = 1, ...__c] = (useFoo())`)
  expect(code).toMatch(`\nconst a = _shallowRef(__a);`)
  expect(code).toMatch(`\nconst b = _shallowRef(__b);`)
  expect(code).toMatch(`\nconst c = _shallowRef(__c);`)
  expect(code).toMatch(`console.log(n.value, a.value, b.value, c.value)`)
  expect(rootVars).toStrictEqual(['n', 'a', 'b', 'c'])
  assertCode(code)
})

test('nested destructure', () => {
  const { code, rootVars } = transform(`
    let [{ a: { b }}] = $(useFoo())
    let { c: [d, e] } = $(useBar())
    console.log(b, d, e)
    `)
  expect(code).toMatch(`let [{ a: { b: __b }}] = (useFoo())`)
  expect(code).toMatch(`let { c: [__d, __e] } = (useBar())`)
  expect(code).not.toMatch(`\nconst a = _shallowRef(__a);`)
  expect(code).not.toMatch(`\nconst c = _shallowRef(__c);`)
  expect(code).toMatch(`\nconst b = _shallowRef(__b);`)
  expect(code).toMatch(`\nconst d = _shallowRef(__d);`)
  expect(code).toMatch(`\nconst e = _shallowRef(__e);`)
  expect(rootVars).toStrictEqual(['b', 'd', 'e'])
  assertCode(code)
})

test('$$', () => {
  const { code } = transform(`
    let a = $ref(1)
    const b = $$(a)
    const c = $$({ a })
    callExternal($$(a))
    `)
  expect(code).toMatch(`const b = (a)`)
  expect(code).toMatch(`const c = ({ a })`)
  expect(code).toMatch(`callExternal((a))`)
  assertCode(code)
})

test('nested scopes', () => {
  const { code, rootVars } = transform(`
    let a = $ref(0)
    let b = $ref(0)
    let c = 0

    a++ // outer a
    b++ // outer b
    c++ // outer c

    let bar = $ref(0)
    bar++ // outer bar

    function foo({ a }) {
      a++ // inner a
      b++ // inner b
      let c = $ref(0)
      c++ // inner c
      let d = $ref(0)

      function bar(c) {
        c++ // nested c
        d++ // nested d
      }
      bar() // inner bar

      if (true) {
        let a = $ref(0)
        a++ // if block a
      }

      return $$({ a, b, c, d })
    }
    `)
  expect(rootVars).toStrictEqual(['a', 'b', 'bar'])

  expect(code).toMatch('a.value++ // outer a')
  expect(code).toMatch('b.value++ // outer b')
  expect(code).toMatch('c++ // outer c')

  expect(code).toMatch('a++ // inner a') // shadowed by function arg
  expect(code).toMatch('b.value++ // inner b')
  expect(code).toMatch('c.value++ // inner c') // shadowed by local ref binding

  expect(code).toMatch('c++ // nested c') // shadowed by inline fn arg
  expect(code).toMatch(`d.value++ // nested d`)

  expect(code).toMatch(`a.value++ // if block a`) // if block

  expect(code).toMatch(`bar.value++ // outer bar`)
  // inner bar shadowed by function declaration
  expect(code).toMatch(`bar() // inner bar`)

  expect(code).toMatch(`return ({ a, b, c, d })`)
  assertCode(code)
})

//#4062
test('should not rewrite type identifiers', () => {
  const { code } = transform(
    `const props = defineProps<{msg: string; ids?: string[]}>()
        let ids = $ref([])`,
    {
      parserPlugins: ['typescript']
    }
  )
  expect(code).not.toMatch('.value')
  assertCode(code)
})

// #4254
test('handle TS casting syntax', () => {
  const { code } = transform(
    `
      let a = $ref(1)
      console.log(a!)
      console.log(a! + 1)
      console.log(a as number)
      console.log((a as number) + 1)
      console.log(<number>a)
      console.log(<number>a + 1)
      console.log(a! + (a as number))
      console.log(a! + <number>a)
      console.log((a as number) + <number>a)
      `,
    {
      parserPlugins: ['typescript']
    }
  )
  expect(code).toMatch('console.log(a.value!)')
  expect(code).toMatch('console.log(a.value as number)')
  expect(code).toMatch('console.log(<number>a.value)')
  assertCode(code)
})

describe('errors', () => {
  test('non-let $ref declaration', () => {
    expect(() => transform(`const a = $ref(1)`)).toThrow(
      `$ref() bindings can only be declared with let`
    )
  })

  test('$ref w/ destructure', () => {
    expect(() => transform(`let { a } = $ref(1)`)).toThrow(
      `cannot be used with destructure`
    )
  })

  test('$computed w/ destructure', () => {
    expect(() => transform(`let { a } = $computed(() => 1)`)).toThrow(
      `cannot be used with destructure`
    )
  })

  test('warn usage in non-init positions', () => {
    expect(() =>
      transform(
        `let bar = $ref(1)
          bar = $ref(2)`
      )
    ).toThrow(`$ref can only be used as the initializer`)

    expect(() => transform(`let bar = { foo: $computed(1) }`)).toThrow(
      `$computed can only be used as the initializer`
    )
  })
})
