import { parse, SFCScriptCompileOptions, compileScript } from '../src'
import { parse as babelParse } from '@babel/parser'
import { babelParserDefaultPlugins } from '@vue/shared'

function compile(src: string, options?: SFCScriptCompileOptions) {
  const { descriptor } = parse(src)
  return compileScript(descriptor, options)
}

function assertCode(code: string) {
  // parse the generated code to make sure it is valid
  try {
    babelParse(code, {
      sourceType: 'module',
      plugins: [...babelParserDefaultPlugins, 'typescript']
    })
  } catch (e) {
    console.log(code)
    throw e
  }
  expect(code).toMatchSnapshot()
}

describe('SFC compile <script setup>', () => {
  test('explicit setup signature', () => {
    assertCode(
      compile(`<script setup="props, { emit }">emit('foo')</script>`).content
    )
  })

  test('should expose top level declarations', () => {
    const { content } = compile(`
      <script setup>
      import { x } from './x'
      let a = 1
      const b = 2
      function c() {}
      class d {}
      </script>
      `)
    assertCode(content)
    expect(content).toMatch('return { x, a, b, c, d }')
  })

  describe('imports', () => {
    test('should hoist and expose imports', () => {
      assertCode(
        compile(`<script setup>import { ref } from 'vue'</script>`).content
      )
    })

    test('should extract comment for import or type declarations', () => {
      assertCode(
        compile(`<script setup>
  import a from 'a' // comment
  import b from 'b'
  </script>`).content
      )
    })

    test('dedupe between user & helper', () => {
      const { content } = compile(`<script setup>
  import { ref } from 'vue'
  ref: foo = 1
  </script>`)
      assertCode(content)
      expect(content).toMatch(`import { ref } from 'vue'`)
    })

    test('import dedupe between <script> and <script setup>', () => {
      const { content } = compile(`
        <script>
        import { x } from './x'
        </script>
        <script setup>
        import { x } from './x'
        x()
        </script>
        `)
      assertCode(content)
      expect(content.indexOf(`import { x }`)).toEqual(
        content.lastIndexOf(`import { x }`)
      )
    })
  })

  describe('<script setup lang="ts">', () => {
    test('hoist type declarations', () => {
      const { content } = compile(`
      <script setup lang="ts">
        export interface Foo {}
        type Bar = {}
      </script>`)
      assertCode(content)
    })

    test('extract props', () => {
      const { content } = compile(`
      <script setup="myProps" lang="ts">
      interface Test {}

      type Alias = number[]

      declare const myProps: {
        string: string
        number: number
        boolean: boolean
        object: object
        objectLiteral: { a: number }
        fn: (n: number) => void
        functionRef: Function
        objectRef: Object
        array: string[]
        arrayRef: Array<any>
        tuple: [number, number]
        set: Set<string>
        literal: 'foo'
        optional?: any
        recordRef: Record<string, null>
        interface: Test
        alias: Alias

        union: string | number
        literalUnion: 'foo' | 'bar'
        literalUnionMixed: 'foo' | 1 | boolean
        intersection: Test & {}
      }
      </script>`)
      assertCode(content)
      expect(content).toMatch(`string: { type: String, required: true }`)
      expect(content).toMatch(`number: { type: Number, required: true }`)
      expect(content).toMatch(`boolean: { type: Boolean, required: true }`)
      expect(content).toMatch(`object: { type: Object, required: true }`)
      expect(content).toMatch(`objectLiteral: { type: Object, required: true }`)
      expect(content).toMatch(`fn: { type: Function, required: true }`)
      expect(content).toMatch(`functionRef: { type: Function, required: true }`)
      expect(content).toMatch(`objectRef: { type: Object, required: true }`)
      expect(content).toMatch(`array: { type: Array, required: true }`)
      expect(content).toMatch(`arrayRef: { type: Array, required: true }`)
      expect(content).toMatch(`tuple: { type: Array, required: true }`)
      expect(content).toMatch(`set: { type: Set, required: true }`)
      expect(content).toMatch(`literal: { type: String, required: true }`)
      expect(content).toMatch(`optional: { type: null, required: false }`)
      expect(content).toMatch(`recordRef: { type: Object, required: true }`)
      expect(content).toMatch(`interface: { type: Object, required: true }`)
      expect(content).toMatch(`alias: { type: Array, required: true }`)
      expect(content).toMatch(
        `union: { type: [String, Number], required: true }`
      )
      expect(content).toMatch(
        `literalUnion: { type: [String, String], required: true }`
      )
      expect(content).toMatch(
        `literalUnionMixed: { type: [String, Number, Boolean], required: true }`
      )
      expect(content).toMatch(`intersection: { type: Object, required: true }`)
    })

    test('extract emits', () => {
      const { content } = compile(`
      <script setup="_, { emit: myEmit }" lang="ts">
      declare function myEmit(e: 'foo' | 'bar'): void
      declare function myEmit(e: 'baz', id: number): void
      </script>
      `)
      assertCode(content)
      expect(content).toMatch(
        `declare function __emit__(e: 'foo' | 'bar'): void`
      )
      expect(content).toMatch(
        `declare function __emit__(e: 'baz', id: number): void`
      )
      expect(content).toMatch(
        `emits: ["foo", "bar", "baz"] as unknown as undefined`
      )
    })
  })

  describe('CSS vars injection', () => {
    test('<script> w/ no default export', () => {
      assertCode(
        compile(
          `<script>const a = 1</script>\n` +
            `<style vars="{ color }">div{ color: var(--color); }</style>`
        ).content
      )
    })

    test('<script> w/ default export', () => {
      assertCode(
        compile(
          `<script>export default { setup() {} }</script>\n` +
            `<style vars="{ color }">div{ color: var(--color); }</style>`
        ).content
      )
    })

    test('<script> w/ default export in strings/comments', () => {
      assertCode(
        compile(
          `<script>
          // export default {}
          export default {}
        </script>\n` +
            `<style vars="{ color }">div{ color: var(--color); }</style>`
        ).content
      )
    })

    test('w/ <script setup>', () => {
      assertCode(
        compile(
          `<script setup>const color = 'red'</script>\n` +
            `<style vars="{ color }">div{ color: var(--color); }</style>`
        ).content
      )
    })
  })

  describe('async/await detection', () => {
    function assertAwaitDetection(code: string, shouldAsync = true) {
      const { content } = compile(`<script setup>${code}</script>`)
      expect(content).toMatch(
        `export ${shouldAsync ? `async ` : ``}function setup`
      )
    }

    test('expression statement', () => {
      assertAwaitDetection(`await foo`)
    })

    test('variable', () => {
      assertAwaitDetection(`const a = 1 + (await foo)`)
    })

    test('ref', () => {
      assertAwaitDetection(`ref: a = 1 + (await foo)`)
    })

    test('nested statements', () => {
      assertAwaitDetection(`if (ok) { await foo } else { await bar }`)
    })

    test('should ignore await inside functions', () => {
      // function declaration
      assertAwaitDetection(`async function foo() { await bar }`, false)
      // function expression
      assertAwaitDetection(`const foo = async () => { await bar }`, false)
      // object method
      assertAwaitDetection(`const obj = { async method() { await bar }}`, false)
      // class method
      assertAwaitDetection(
        `const cls = class Foo { async method() { await bar }}`,
        false
      )
    })
  })

  describe('ref: syntax sugar', () => {
    test('convert ref declarations', () => {
      const { content, bindings } = compile(`<script setup>
      ref: foo
      ref: a = 1
      ref: b = {
        count: 0
      }
      let c = () => {}
      let d
      </script>`)
      expect(content).toMatch(`import { ref } from 'vue'`)
      expect(content).not.toMatch(`ref: foo`)
      expect(content).not.toMatch(`ref: a`)
      expect(content).not.toMatch(`ref: b`)
      expect(content).toMatch(`const foo = ref()`)
      expect(content).toMatch(`const a = ref(1)`)
      expect(content).toMatch(`
      const b = ref({
        count: 0
      })
      `)
      // normal declarations left untouched
      expect(content).toMatch(`let c = () => {}`)
      expect(content).toMatch(`let d`)
      assertCode(content)
      expect(bindings).toStrictEqual({
        foo: 'setup',
        a: 'setup',
        b: 'setup',
        c: 'setup',
        d: 'setup'
      })
    })

    test('multi ref declarations', () => {
      const { content, bindings } = compile(`<script setup>
      ref: a = 1, b = 2, c = {
        count: 0
      }
      </script>`)
      expect(content).toMatch(`
      const a = ref(1), b = ref(2), c = ref({
        count: 0
      })
      `)
      expect(content).toMatch(`return { a, b, c }`)
      assertCode(content)
      expect(bindings).toStrictEqual({
        a: 'setup',
        b: 'setup',
        c: 'setup'
      })
    })

    test('should not convert non ref labels', () => {
      const { content } = compile(`<script setup>
      foo: a = 1, b = 2, c = {
        count: 0
      }
      </script>`)
      expect(content).toMatch(`foo: a = 1, b = 2`)
      assertCode(content)
    })

    test('accessing ref binding', () => {
      const { content } = compile(`<script setup>
      ref: a = 1
      console.log(a)
      function get() {
        return a + 1
      }
      </script>`)
      expect(content).toMatch(`console.log(a.value)`)
      expect(content).toMatch(`return a.value + 1`)
      assertCode(content)
    })

    test('cases that should not append .value', () => {
      const { content } = compile(`<script setup>
      ref: a = 1
      console.log(b.a)
      function get(a) {
        return a + 1
      }
      </script>`)
      expect(content).not.toMatch(`a.value`)
    })

    test('mutating ref binding', () => {
      const { content } = compile(`<script setup>
      ref: a = 1
      ref: b = { count: 0 }
      function inc() {
        a++
        a = a + 1
        b.count++
        b.count = b.count + 1
      }
      </script>`)
      expect(content).toMatch(`a.value++`)
      expect(content).toMatch(`a.value = a.value + 1`)
      expect(content).toMatch(`b.value.count++`)
      expect(content).toMatch(`b.value.count = b.value.count + 1`)
      assertCode(content)
    })

    test('using ref binding in property shorthand', () => {
      const { content } = compile(`<script setup>
      ref: a = 1
      const b = { a }
      function test() {
        const { a } = b
      }
      </script>`)
      expect(content).toMatch(`const b = { a: a.value }`)
      // should not convert destructure
      expect(content).toMatch(`const { a } = b`)
      assertCode(content)
    })

    test('object destructure', () => {
      const { content, bindings } = compile(`<script setup>
      ref: n = 1, ({ a, b: c, d = 1, e: f = 2, ...g } = useFoo())
      console.log(n, a, c, d, f, g)
      </script>`)
      expect(content).toMatch(
        `const n = ref(1), { a: __a, b: __c, d: __d = 1, e: __f = 2, ...__g } = useFoo()`
      )
      expect(content).toMatch(`\nconst a = ref(__a);`)
      expect(content).not.toMatch(`\nconst b = ref(__b);`)
      expect(content).toMatch(`\nconst c = ref(__c);`)
      expect(content).toMatch(`\nconst d = ref(__d);`)
      expect(content).not.toMatch(`\nconst e = ref(__e);`)
      expect(content).toMatch(`\nconst f = ref(__f);`)
      expect(content).toMatch(`\nconst g = ref(__g);`)
      expect(content).toMatch(
        `console.log(n.value, a.value, c.value, d.value, f.value, g.value)`
      )
      expect(content).toMatch(`return { n, a, c, d, f, g }`)
      expect(bindings).toStrictEqual({
        n: 'setup',
        a: 'setup',
        c: 'setup',
        d: 'setup',
        f: 'setup',
        g: 'setup'
      })
      assertCode(content)
    })

    test('array destructure', () => {
      const { content, bindings } = compile(`<script setup>
      ref: n = 1, [a, b = 1, ...c] = useFoo()
      console.log(n, a, b, c)
      </script>`)
      expect(content).toMatch(
        `const n = ref(1), [__a, __b = 1, ...__c] = useFoo()`
      )
      expect(content).toMatch(`\nconst a = ref(__a);`)
      expect(content).toMatch(`\nconst b = ref(__b);`)
      expect(content).toMatch(`\nconst c = ref(__c);`)
      expect(content).toMatch(`console.log(n.value, a.value, b.value, c.value)`)
      expect(content).toMatch(`return { n, a, b, c }`)
      expect(bindings).toStrictEqual({
        n: 'setup',
        a: 'setup',
        b: 'setup',
        c: 'setup'
      })
      assertCode(content)
    })

    test('nested destructure', () => {
      const { content, bindings } = compile(`<script setup>
      ref: [{ a: { b }}] = useFoo()
      ref: ({ c: [d, e] } = useBar())
      console.log(b, d, e)
      </script>`)
      expect(content).toMatch(`const [{ a: { b: __b }}] = useFoo()`)
      expect(content).toMatch(`const { c: [__d, __e] } = useBar()`)
      expect(content).not.toMatch(`\nconst a = ref(__a);`)
      expect(content).not.toMatch(`\nconst c = ref(__c);`)
      expect(content).toMatch(`\nconst b = ref(__b);`)
      expect(content).toMatch(`\nconst d = ref(__d);`)
      expect(content).toMatch(`\nconst e = ref(__e);`)
      expect(content).toMatch(`return { b, d, e }`)
      expect(bindings).toStrictEqual({
        b: 'setup',
        d: 'setup',
        e: 'setup'
      })
      assertCode(content)
    })
  })

  describe('errors', () => {
    test('<script> and <script setup> must have same lang', () => {
      expect(() =>
        compile(`<script>foo()</script><script setup lang="ts">bar()</script>`)
      ).toThrow(`<script> and <script setup> must have the same language type`)
    })

    test('non-type named exports', () => {
      expect(() =>
        compile(`<script setup>
        export const a = 1
        </script>`)
      ).toThrow(`cannot contain non-type named or * exports`)

      expect(() =>
        compile(`<script setup>
        export * from './foo'
        </script>`)
      ).toThrow(`cannot contain non-type named or * exports`)

      expect(() =>
        compile(`<script setup>
          const bar = 1
          export { bar as default }
        </script>`)
      ).toThrow(`cannot contain non-type named or * exports`)
    })

    test('ref: non-assignment expressions', () => {
      expect(() =>
        compile(`<script setup>
        ref: a = 1, foo()
        </script>`)
      ).toThrow(`ref: statements can only contain assignment expressions`)
    })

    test('export default referencing local var', () => {
      expect(() =>
        compile(`<script setup>
          const bar = 1
          export default {
            props: {
              foo: {
                default: () => bar
              }
            }
          }
        </script>`)
      ).toThrow(`cannot reference locally declared variables`)
    })

    test('export default referencing ref declarations', () => {
      expect(() =>
        compile(`<script setup>
        ref: bar = 1
        export default {
          props: bar
        }
      </script>`)
      ).toThrow(`cannot reference locally declared variables`)
    })

    test('should allow export default referencing scope var', () => {
      assertCode(
        compile(`<script setup>
          const bar = 1
          export default {
            props: {
              foo: {
                default: bar => bar + 1
              }
            }
          }
        </script>`).content
      )
    })

    test('should allow export default referencing imported binding', () => {
      assertCode(
        compile(`<script setup>
          import { bar } from './bar'
          export default {
            props: {
              foo: {
                default: () => bar
              }
            }
          }
        </script>`).content
      )
    })

    test('error on duplicated default export', () => {
      expect(() =>
        compile(`
      <script>
      export default {}
      </script>
      <script setup>
      export default {}
      </script>
      `)
      ).toThrow(`Default export is already declared`)

      expect(() =>
        compile(`
      <script>
      export { x as default } from './y'
      </script>
      <script setup>
      export default {}
      </script>
      `)
      ).toThrow(`Default export is already declared`)

      expect(() =>
        compile(`
      <script>
      const x = {}
      export { x as default }
      </script>
      <script setup>
      export default {}
      </script>
      `)
      ).toThrow(`Default export is already declared`)
    })
  })
})

describe('SFC analyze <script> bindings', () => {
  it('can parse decorators syntax in typescript block', () => {
    const { scriptAst } = compile(`
      <script lang="ts">
        import { Options, Vue } from 'vue-class-component';
        @Options({
          components: {
            HelloWorld,
          },
          props: ['foo', 'bar']
        })
        export default class Home extends Vue {}
      </script>
    `)

    expect(scriptAst).toBeDefined()
  })
  it('recognizes props array declaration', () => {
    const { bindings } = compile(`
      <script>
        export default {
          props: ['foo', 'bar']
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'props', bar: 'props' })
  })

  it('recognizes props object declaration', () => {
    const { bindings } = compile(`
      <script>
        export default {
          props: {
            foo: String,
            bar: {
              type: String,
            },
            baz: null,
            qux: [String, Number]
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({
      foo: 'props',
      bar: 'props',
      baz: 'props',
      qux: 'props'
    })
  })

  it('recognizes setup return', () => {
    const { bindings } = compile(`
      <script>
        const bar = 2
        export default {
          setup() {
            return {
              foo: 1,
              bar
            }
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'setup', bar: 'setup' })
  })

  it('recognizes async setup return', () => {
    const { bindings } = compile(`
      <script>
        const bar = 2
        export default {
          async setup() {
            return {
              foo: 1,
              bar
            }
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'setup', bar: 'setup' })
  })

  it('recognizes data return', () => {
    const { bindings } = compile(`
      <script>
        const bar = 2
        export default {
          data() {
            return {
              foo: null,
              bar
            }
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'data', bar: 'data' })
  })

  it('recognizes methods', () => {
    const { bindings } = compile(`
      <script>
        export default {
          methods: {
            foo() {}
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'options' })
  })

  it('recognizes computeds', () => {
    const { bindings } = compile(`
      <script>
        export default {
          computed: {
            foo() {},
            bar: {
              get() {},
              set() {},
            }
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'options', bar: 'options' })
  })

  it('recognizes injections array declaration', () => {
    const { bindings } = compile(`
      <script>
        export default {
          inject: ['foo', 'bar']
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'options', bar: 'options' })
  })

  it('recognizes injections object declaration', () => {
    const { bindings } = compile(`
      <script>
        export default {
          inject: {
            foo: {},
            bar: {},
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({ foo: 'options', bar: 'options' })
  })

  it('works for mixed bindings', () => {
    const { bindings } = compile(`
      <script>
        export default {
          inject: ['foo'],
          props: {
            bar: String,
          },
          setup() {
            return {
              baz: null,
            }
          },
          data() {
            return {
              qux: null
            }
          },
          methods: {
            quux() {}
          },
          computed: {
            quuz() {}
          }
        }
      </script>
    `)
    expect(bindings).toStrictEqual({
      foo: 'options',
      bar: 'props',
      baz: 'setup',
      qux: 'data',
      quux: 'options',
      quuz: 'options'
    })
  })

  it('works for script setup', () => {
    const { bindings } = compile(`
      <script setup>
        export default {
          props: {
            foo: String,
          },
        }
      </script>
    `)
    expect(bindings).toStrictEqual({
      foo: 'props'
    })
  })
})
