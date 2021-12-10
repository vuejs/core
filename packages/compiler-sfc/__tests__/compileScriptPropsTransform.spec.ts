import { BindingTypes } from '@vue/compiler-core'
import { SFCScriptCompileOptions } from '../src'
import { compileSFCScript, assertCode } from './utils'

describe('sfc props transform', () => {
  function compile(src: string, options?: Partial<SFCScriptCompileOptions>) {
    return compileSFCScript(src, {
      inlineTemplate: true,
      propsDestructureTransform: true,
      ...options
    })
  }

  test('basic usage', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { foo } = defineProps(['foo'])
      console.log(foo)
      </script>
      <template>{{ foo }}</template>
    `)
    expect(content).not.toMatch(`const { foo } =`)
    expect(content).toMatch(`console.log(__props.foo)`)
    expect(content).toMatch(`_toDisplayString(__props.foo)`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS
    })
  })

  test('nested scope', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { foo, bar } = defineProps(['foo', 'bar'])
      function test(foo) {
        console.log(foo)
        console.log(bar)
      }
      </script>
    `)
    expect(content).not.toMatch(`const { foo, bar } =`)
    expect(content).toMatch(`console.log(foo)`)
    expect(content).toMatch(`console.log(__props.bar)`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      test: BindingTypes.SETUP_CONST
    })
  })

  test('default values w/ runtime declaration', () => {
    const { content } = compile(`
      <script setup>
      const { foo = 1, bar = {} } = defineProps(['foo', 'bar'])
      </script>
    `)
    // literals can be used as-is, non-literals are always returned from a
    // function
    expect(content).toMatch(`props: _mergeDefaults(['foo', 'bar'], {
  foo: 1,
  bar: () => {}
})`)
    assertCode(content)
  })

  test('default values w/ type declaration', () => {
    const { content } = compile(`
      <script setup lang="ts">
      const { foo = 1, bar = {} } = defineProps<{ foo?: number, bar?: object }>()
      </script>
    `)
    // literals can be used as-is, non-literals are always returned from a
    // function
    expect(content).toMatch(`props: {
    foo: { type: Number, required: false, default: 1 },
    bar: { type: Object, required: false, default: () => {} }
  }`)
    assertCode(content)
  })

  test('default values w/ type declaration, prod mode', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      const { foo = 1, bar = {}, func = () => {} } = defineProps<{ foo?: number, bar?: object, baz?: any, boola?: boolean, boolb?: boolean | number, func?: Function }>()
      </script>
    `,
      { isProd: true }
    )
    // literals can be used as-is, non-literals are always returned from a
    // function
    expect(content).toMatch(`props: {
    foo: { default: 1 },
    bar: { default: () => {} },
    baz: null,
    boola: { type: Boolean },
    boolb: { type: [Boolean, Number] },
    func: { type: Function, default: () => () => {} }
  }`)
    assertCode(content)
  })

  test('aliasing', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { foo: bar } = defineProps(['foo'])
      let x = foo
      let y = bar
      </script>
      <template>{{ foo + bar }}</template>
    `)
    expect(content).not.toMatch(`const { foo: bar } =`)
    expect(content).toMatch(`let x = foo`) // should not process
    expect(content).toMatch(`let y = __props.foo`)
    // should convert bar to __props.foo in template expressions
    expect(content).toMatch(`_toDisplayString(__props.foo + __props.foo)`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      x: BindingTypes.SETUP_LET,
      y: BindingTypes.SETUP_LET,
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS_ALIASED,
      __propsAliases: {
        bar: 'foo'
      }
    })
  })

  test('rest spread', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { foo, bar, ...rest } = defineProps(['foo', 'bar', 'baz'])
      </script>
    `)
    expect(content).toMatch(
      `const rest = _createPropsRestProxy(__props, ["foo","bar"])`
    )
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      baz: BindingTypes.PROPS,
      rest: BindingTypes.SETUP_CONST
    })
  })

  describe('errors', () => {
    test('should error on deep destructure', () => {
      expect(() =>
        compile(
          `<script setup>const { foo: [bar] } = defineProps(['foo'])</script>`
        )
      ).toThrow(`destructure does not support nested patterns`)

      expect(() =>
        compile(
          `<script setup>const { foo: { bar } } = defineProps(['foo'])</script>`
        )
      ).toThrow(`destructure does not support nested patterns`)
    })

    test('should error on computed key', () => {
      expect(() =>
        compile(
          `<script setup>const { [foo]: bar } = defineProps(['foo'])</script>`
        )
      ).toThrow(`destructure cannot use computed key`)
    })

    test('should error when used with withDefaults', () => {
      expect(() =>
        compile(
          `<script setup lang="ts">
          const { foo } = withDefaults(defineProps<{ foo: string }>(), { foo: 'foo' })
          </script>`
        )
      ).toThrow(`withDefaults() is unnecessary when using destructure`)
    })

    test('should error if destructure reference local vars', () => {
      expect(() =>
        compile(
          `<script setup>
          const x = 1
          const {
            foo = () => x
          } = defineProps(['foo'])
          </script>`
        )
      ).toThrow(`cannot reference locally declared variables`)
    })
  })
})
