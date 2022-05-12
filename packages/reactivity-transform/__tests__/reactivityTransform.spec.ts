import { parse } from '@babel/parser'
import { transform } from '../src'

function assertCode(code: string) {
  // parse the generated code to make sure it is valid
  try {
    parse(code, {
      sourceType: 'module',
      plugins: ['typescript']
    })
  } catch (e: any) {
    console.log(code)
    throw e
  }
  expect(code).toMatchSnapshot()
}

test('$ unwrapping', () => {
  const { code, rootRefs } = transform(`
    import { ref, shallowRef } from 'vue'
    let foo = $(ref())
    export let a = $(ref(1))
    let b = $(shallowRef({
      count: 0
    }))
    let c = () => {}
    let d
    label: var e = $(ref())
    `)
  expect(code).not.toMatch(`$(ref())`)
  expect(code).not.toMatch(`$(ref(1))`)
  expect(code).not.toMatch(`$(shallowRef({`)
  expect(code).toMatch(`let foo = (ref())`)
  expect(code).toMatch(`export let a = (ref(1))`)
  expect(code).toMatch(`
    let b = (shallowRef({
      count: 0
    }))
    `)
  // normal declarations left untouched
  expect(code).toMatch(`let c = () => {}`)
  expect(code).toMatch(`let d`)
  expect(code).toMatch(`label: var e = (ref())`)
  expect(rootRefs).toStrictEqual(['foo', 'a', 'b', 'e'])
  assertCode(code)
})

test('$ref & $shallowRef declarations', () => {
  const { code, rootRefs, importedHelpers } = transform(`
    let foo = $ref()
    export let a = $ref(1)
    let b = $shallowRef({
      count: 0
    })
    let c = () => {}
    let d
    label: var e = $ref()
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
  expect(code).toMatch(`label: var e = _ref()`)
  expect(rootRefs).toStrictEqual(['foo', 'a', 'b', 'e'])
  expect(importedHelpers).toStrictEqual(['ref', 'shallowRef'])
  assertCode(code)
})

test('multi $ref declarations', () => {
  const { code, rootRefs, importedHelpers } = transform(`
    let a = $ref(1), b = $ref(2), c = $ref({
      count: 0
    })
    `)
  expect(code).toMatch(`
    let a = _ref(1), b = _ref(2), c = _ref({
      count: 0
    })
    `)
  expect(rootRefs).toStrictEqual(['a', 'b', 'c'])
  expect(importedHelpers).toStrictEqual(['ref'])
  assertCode(code)
})

test('$computed declaration', () => {
  const { code, rootRefs, importedHelpers } = transform(`
    let a = $computed(() => 1)
    `)
  expect(code).toMatch(`
    let a = _computed(() => 1)
    `)
  expect(rootRefs).toStrictEqual(['a'])
  expect(importedHelpers).toStrictEqual(['computed'])
  assertCode(code)
})

test('mixing $ref & $computed declarations', () => {
  const { code, rootRefs, importedHelpers } = transform(`
    let a = $ref(1), b = $computed(() => a + 1)
    `)
  expect(code).toMatch(`
    let a = _ref(1), b = _computed(() => a.value + 1)
    `)
  expect(rootRefs).toStrictEqual(['a', 'b'])
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

describe('cases that should not append .value', () => {
  test('member expression', () => {
    const { code } = transform(`
      let a = $ref(1)
      console.log(b.a)
      `)
    expect(code).not.toMatch(`a.value`)
  })

  test('function argument', () => {
    const { code } = transform(`
      let a = $ref(1)
      function get(a) {
        return a + 1
      }
      function get2({ a }) {
        return a + 1
      }
      function get3([a]) {
        return a + 1
      }
      `)
    expect(code).not.toMatch(`a.value`)
  })

  test('for in/of loops', () => {
    const { code } = transform(`
    let a = $ref(1)
    for (const [a, b] of arr) {
      console.log(a)
    }
    for (let a in arr) {
      console.log(a)
    }
    `)
    expect(code).not.toMatch(`a.value`)
  })
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
      let err = $ref(null)
      try {
      } catch (err) {
        console.log(err)
      }
    `)
  expect(code).toMatch('console.log(a)')
  expect(code).toMatch('console.log(b.value)')
  expect(code).toMatch('console.log(c)')
  expect(code).toMatch('console.log(d.value)')
  expect(code).toMatch('console.log(e)')
  expect(code).toMatch('console.log(err)')
  assertCode(code)
})

test('object destructure', () => {
  const { code, rootRefs } = transform(`
    let n = $ref(1), { a, b: c, d = 1, e: f = 2, [g]: h } = $(useFoo())
    let { foo } = $(useSomething(() => 1));
    console.log(n, a, c, d, f, h, foo)
    `)
  expect(code).toMatch(`a = _toRef(__$temp_1, 'a')`)
  expect(code).toMatch(`c = _toRef(__$temp_1, 'b')`)
  expect(code).toMatch(`d = _toRef(__$temp_1, 'd', 1)`)
  expect(code).toMatch(`f = _toRef(__$temp_1, 'e', 2)`)
  expect(code).toMatch(`h = _toRef(__$temp_1, g)`)
  expect(code).toMatch(`foo = _toRef(__$temp_2, 'foo')`)
  expect(code).toMatch(
    `console.log(n.value, a.value, c.value, d.value, f.value, h.value, foo.value)`
  )
  expect(rootRefs).toStrictEqual(['n', 'a', 'c', 'd', 'f', 'h', 'foo'])
  assertCode(code)
})

test('object destructure w/ mid-path default values', () => {
  const { code, rootRefs } = transform(`
    const { a: { b } = { b: 123 }} = $(useFoo())
    console.log(b)
  `)
  expect(code).toMatch(`b = _toRef((__$temp_1.a || { b: 123 }), 'b')`)
  expect(code).toMatch(`console.log(b.value)`)
  expect(rootRefs).toStrictEqual(['b'])
  assertCode(code)
})

test('array destructure', () => {
  const { code, rootRefs } = transform(`
    let n = $ref(1), [a, b = 1] = $(useFoo())
    console.log(n, a, b)
    `)
  expect(code).toMatch(`a = _toRef(__$temp_1, 0)`)
  expect(code).toMatch(`b = _toRef(__$temp_1, 1, 1)`)
  expect(code).toMatch(`console.log(n.value, a.value, b.value)`)
  expect(rootRefs).toStrictEqual(['n', 'a', 'b'])
  assertCode(code)
})

test('nested destructure', () => {
  const { code, rootRefs } = transform(`
    let [{ a: { b }}] = $(useFoo())
    let { c: [d, e] } = $(useBar())
    console.log(b, d, e)
    `)
  expect(code).toMatch(`b = _toRef(__$temp_1[0].a, 'b')`)
  expect(code).toMatch(`d = _toRef(__$temp_2.c, 0)`)
  expect(code).toMatch(`e = _toRef(__$temp_2.c, 1)`)
  expect(rootRefs).toStrictEqual(['b', 'd', 'e'])
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
  const { code, rootRefs } = transform(`
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
  expect(rootRefs).toStrictEqual(['a', 'b', 'bar'])

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

test('macro import alias and removal', () => {
  const { code } = transform(
    `
    import { $ as fromRefs, $ref } from 'vue/macros'

    let a = $ref(1)
    const { x, y } = fromRefs(useMouse())
    `
  )
  // should remove imports
  expect(code).not.toMatch(`from 'vue/macros'`)
  expect(code).toMatch(`let a = _ref(1)`)
  expect(code).toMatch(`const __$temp_1 = (useMouse())`)
  assertCode(code)
})

describe('errors', () => {
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

  test('not transform the prototype attributes', () => {
    const { code } = transform(`
    const hasOwnProperty = Object.prototype.hasOwnProperty
    const hasOwn = (val, key) => hasOwnProperty.call(val, key)
    `)
    expect(code).not.toMatch('.value')
  })

  test('rest element in $() destructure', () => {
    expect(() => transform(`let { a, ...b } = $(foo())`)).toThrow(
      `does not support rest element`
    )
    expect(() => transform(`let [a, ...b] = $(foo())`)).toThrow(
      `does not support rest element`
    )
  })
})
