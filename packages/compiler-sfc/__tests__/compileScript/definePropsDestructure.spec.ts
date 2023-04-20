import { BindingTypes } from '@vue/compiler-core'
import { SFCScriptCompileOptions } from '../../src'
import { compileSFCScript, assertCode } from '../utils'

describe('sfc reactive props destructure', () => {
  function compile(src: string, options?: Partial<SFCScriptCompileOptions>) {
    return compileSFCScript(src, {
      inlineTemplate: true,
      propsDestructure: true,
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

  test('multiple variable declarations', () => {
    const { content, bindings } = compile(`
      <script setup>
      const bar = 'fish', { foo } = defineProps(['foo']), hello = 'world'
      </script>
      <template><div>{{ foo }} {{ hello }} {{ bar }}</div></template>
    `)
    expect(content).not.toMatch(`const { foo } =`)
    expect(content).toMatch(`const bar = 'fish', hello = 'world'`)
    expect(content).toMatch(`_toDisplayString(hello)`)
    expect(content).toMatch(`_toDisplayString(bar)`)
    expect(content).toMatch(`_toDisplayString(__props.foo)`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.LITERAL_CONST,
      hello: BindingTypes.LITERAL_CONST
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

  test('default values w/ array runtime declaration', () => {
    const { content } = compile(`
      <script setup>
      const { foo = 1, bar = {}, func = () => {} } = defineProps(['foo', 'bar', 'baz'])
      </script>
    `)
    // literals can be used as-is, non-literals are always returned from a
    // function
    // functions need to be marked with a skip marker
    expect(content).toMatch(`props: _mergeDefaults(['foo', 'bar', 'baz'], {
  foo: 1,
  bar: () => ({}),
  func: () => {}, __skip_func: true
})`)
    assertCode(content)
  })

  test('default values w/ object runtime declaration', () => {
    const { content } = compile(`
      <script setup>
      const { foo = 1, bar = {}, func = () => {}, ext = x } = defineProps({ foo: Number, bar: Object, func: Function, ext: null })
      </script>
    `)
    // literals can be used as-is, non-literals are always returned from a
    // function
    // functions need to be marked with a skip marker since we cannot always
    // safely infer whether runtime type is Function (e.g. if the runtime decl
    // is imported, or spreads another object)
    expect(content)
      .toMatch(`props: _mergeDefaults({ foo: Number, bar: Object, func: Function, ext: null }, {
  foo: 1,
  bar: () => ({}),
  func: () => {}, __skip_func: true,
  ext: x, __skip_ext: true
})`)
    assertCode(content)
  })

  test('default values w/ type declaration', () => {
    const { content } = compile(`
      <script setup lang="ts">
      const { foo = 1, bar = {}, func = () => {} } = defineProps<{ foo?: number, bar?: object, func?: () => any }>()
      </script>
    `)
    // literals can be used as-is, non-literals are always returned from a
    // function
    expect(content).toMatch(`props: {
    foo: { type: Number, required: false, default: 1 },
    bar: { type: Object, required: false, default: () => ({}) },
    func: { type: Function, required: false, default: () => {} }
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
    assertCode(content)
    // literals can be used as-is, non-literals are always returned from a
    // function
    expect(content).toMatch(`props: {
    foo: { default: 1 },
    bar: { default: () => ({}) },
    baz: {},
    boola: { type: Boolean },
    boolb: { type: [Boolean, Number] },
    func: { type: Function, default: () => {} }
  }`)
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

  // #5425
  test('non-identifier prop names', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { 'foo.bar': fooBar } = defineProps({ 'foo.bar': Function })
      let x = fooBar
      </script>
      <template>{{ fooBar }}</template>
    `)
    expect(content).toMatch(`x = __props["foo.bar"]`)
    expect(content).toMatch(`toDisplayString(__props["foo.bar"])`)
    assertCode(content)
    expect(bindings).toStrictEqual({
      x: BindingTypes.SETUP_LET,
      'foo.bar': BindingTypes.PROPS,
      fooBar: BindingTypes.PROPS_ALIASED,
      __propsAliases: {
        fooBar: 'foo.bar'
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
      rest: BindingTypes.SETUP_REACTIVE_CONST
    })
  })

  // #6960
  test('computed static key', () => {
    const { content, bindings } = compile(`
    <script setup>
    const { ['foo']: foo } = defineProps(['foo'])
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
          let x = 1
          const {
            foo = () => x
          } = defineProps(['foo'])
          </script>`
        )
      ).toThrow(`cannot reference locally declared variables`)
    })

    test('should error if assignment to destructured prop binding', () => {
      expect(() =>
        compile(
          `<script setup>
          const { foo } = defineProps(['foo'])
          foo = 'bar'
          </script>`
        )
      ).toThrow(`Cannot assign to destructured props`)

      expect(() =>
        compile(
          `<script setup>
          let { foo } = defineProps(['foo'])
          foo = 'bar'
          </script>`
        )
      ).toThrow(`Cannot assign to destructured props`)
    })

    test('should error when passing destructured prop into certain methods', () => {
      expect(() =>
        compile(
          `<script setup>
        import { watch } from 'vue'
        const { foo } = defineProps(['foo'])
        watch(foo, () => {})
        </script>`
        )
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to watch().`
      )

      expect(() =>
        compile(
          `<script setup>
        import { watch as w } from 'vue'
        const { foo } = defineProps(['foo'])
        w(foo, () => {})
        </script>`
        )
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to watch().`
      )

      expect(() =>
        compile(
          `<script setup>
        import { toRef } from 'vue'
        const { foo } = defineProps(['foo'])
        toRef(foo)
        </script>`
        )
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to toRef().`
      )

      expect(() =>
        compile(
          `<script setup>
        import { toRef as r } from 'vue'
        const { foo } = defineProps(['foo'])
        r(foo)
        </script>`
        )
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to toRef().`
      )
    })

    // not comprehensive, but should help for most common cases
    test('should error if default value type does not match declared type', () => {
      expect(() =>
        compile(
          `<script setup lang="ts">
        const { foo = 'hello' } = defineProps<{ foo?: number }>()
        </script>`
        )
      ).toThrow(`Default value of prop "foo" does not match declared type.`)
    })

    // #8017
    test('should not throw an error if the variable is not a props', () => {
      expect(() =>
        compile(
          `<script setup lang='ts'>
        import { watch } from 'vue'
        const { userId } = defineProps({ userId: Number })
        const { error: e, info } = useRequest();
        watch(e, () => {});
        watch(info, () => {});
        </script>`
        )
      ).not.toThrowError()
    })
  })
})
