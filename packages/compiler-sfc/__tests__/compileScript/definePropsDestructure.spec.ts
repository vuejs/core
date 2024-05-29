import { BindingTypes } from '@vue/compiler-core'
import type { SFCScriptCompileOptions } from '../../src'
import { assertCode, compileSFCScript } from '../utils'

describe('sfc reactive props destructure', () => {
  function compile(src: string, options?: Partial<SFCScriptCompileOptions>) {
    return compileSFCScript(src, {
      inlineTemplate: true,
      propsDestructure: true,
      ...options,
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
      foo: BindingTypes.PROPS,
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
      hello: BindingTypes.LITERAL_CONST,
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
      test: BindingTypes.SETUP_CONST,
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
    expect(content)
      .toMatch(`props: /*#__PURE__*/_mergeDefaults(['foo', 'bar', 'baz'], {
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
      .toMatch(`props: /*#__PURE__*/_mergeDefaults({ foo: Number, bar: Object, func: Function, ext: null }, {
  foo: 1,
  bar: () => ({}),
  func: () => {}, __skip_func: true,
  ext: x, __skip_ext: true
})`)
    assertCode(content)
  })
  test('default values w/ runtime declaration & key is string', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { foo = 1, 'foo:bar': fooBar = 'foo-bar' } = defineProps(['foo', 'foo:bar'])
      </script>
    `)
    expect(bindings).toStrictEqual({
      __propsAliases: {
        fooBar: 'foo:bar',
      },
      foo: BindingTypes.PROPS,
      'foo:bar': BindingTypes.PROPS,
      fooBar: BindingTypes.PROPS_ALIASED,
    })

    expect(content).toMatch(`
  props: /*#__PURE__*/_mergeDefaults(['foo', 'foo:bar'], {
  foo: 1,
  "foo:bar": 'foo-bar'
}),`)
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

  test('default values w/ type declaration & key is string', () => {
    const { content, bindings } = compile(`
      <script setup lang="ts">
      const { foo = 1, bar = 2, 'foo:bar': fooBar = 'foo-bar' } = defineProps<{ 
        "foo": number // double-quoted string
        'bar': number // single-quoted string
        'foo:bar': string // single-quoted string containing symbols
        "onUpdate:modelValue": (val: number) => void  // double-quoted string containing symbols
      }>()
      </script>
    `)
    expect(bindings).toStrictEqual({
      __propsAliases: {
        fooBar: 'foo:bar',
      },
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      'foo:bar': BindingTypes.PROPS,
      fooBar: BindingTypes.PROPS_ALIASED,
      'onUpdate:modelValue': BindingTypes.PROPS,
    })
    expect(content).toMatch(`
  props: {
    foo: { type: Number, required: true, default: 1 },
    bar: { type: Number, required: true, default: 2 },
    "foo:bar": { type: String, required: true, default: 'foo-bar' },
    "onUpdate:modelValue": { type: Function, required: true }
  },`)
    assertCode(content)
  })

  test('default values w/ type declaration, prod mode', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      const { foo = 1, bar = {}, func = () => {} } = defineProps<{ foo?: number, bar?: object, baz?: any, boola?: boolean, boolb?: boolean | number, func?: Function }>()
      </script>
    `,
      { isProd: true },
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
        bar: 'foo',
      },
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
        fooBar: 'foo.bar',
      },
    })
  })

  test('rest spread', () => {
    const { content, bindings } = compile(`
      <script setup>
      const { foo, bar, ...rest } = defineProps(['foo', 'bar', 'baz'])
      </script>
    `)
    expect(content).toMatch(
      `const rest = _createPropsRestProxy(__props, ["foo","bar"])`,
    )
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      baz: BindingTypes.PROPS,
      rest: BindingTypes.SETUP_REACTIVE_CONST,
    })
  })

  test('rest spread non-inline', () => {
    const { content, bindings } = compile(
      `
      <script setup>
      const { foo, ...rest } = defineProps(['foo', 'bar'])
      </script>
      <template>{{ rest.bar }}</template>
    `,
      { inlineTemplate: false },
    )
    expect(content).toMatch(
      `const rest = _createPropsRestProxy(__props, ["foo"])`,
    )
    assertCode(content)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      rest: BindingTypes.SETUP_REACTIVE_CONST,
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
      foo: BindingTypes.PROPS,
    })
  })

  test('multi-variable declaration', () => {
    const { content } = compile(`
    <script setup>
    const { item } = defineProps(['item']),
      a = 1;
    </script>
  `)
    assertCode(content)
    expect(content).toMatch(`const a = 1;`)
    expect(content).toMatch(`props: ['item'],`)
  })

  // #6757
  test('multi-variable declaration fix #6757 ', () => {
    const { content } = compile(`
    <script setup>
    const a = 1,
      { item } = defineProps(['item']);
    </script>
  `)
    assertCode(content)
    expect(content).toMatch(`const a = 1;`)
    expect(content).toMatch(`props: ['item'],`)
  })

  // #7422
  test('multi-variable declaration fix #7422', () => {
    const { content } = compile(`
    <script setup>
    const { item } = defineProps(['item']),
          a = 0,
          b = 0;
    </script>
  `)
    assertCode(content)
    expect(content).toMatch(`const a = 0,`)
    expect(content).toMatch(`b = 0;`)
    expect(content).toMatch(`props: ['item'],`)
  })

  test('defineProps/defineEmits in multi-variable declaration (full removal)', () => {
    const { content } = compile(`
    <script setup>
    const props = defineProps(['item']),
          emit = defineEmits(['a']);
    </script>
  `)
    assertCode(content)
    expect(content).toMatch(`props: ['item'],`)
    expect(content).toMatch(`emits: ['a'],`)
  })

  describe('errors', () => {
    test('should error on deep destructure', () => {
      expect(() =>
        compile(
          `<script setup>const { foo: [bar] } = defineProps(['foo'])</script>`,
        ),
      ).toThrow(`destructure does not support nested patterns`)

      expect(() =>
        compile(
          `<script setup>const { foo: { bar } } = defineProps(['foo'])</script>`,
        ),
      ).toThrow(`destructure does not support nested patterns`)
    })

    test('should error on computed key', () => {
      expect(() =>
        compile(
          `<script setup>const { [foo]: bar } = defineProps(['foo'])</script>`,
        ),
      ).toThrow(`destructure cannot use computed key`)
    })

    test('should error when used with withDefaults', () => {
      expect(() =>
        compile(
          `<script setup lang="ts">
          const { foo } = withDefaults(defineProps<{ foo: string }>(), { foo: 'foo' })
          </script>`,
        ),
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
          </script>`,
        ),
      ).toThrow(`cannot reference locally declared variables`)
    })

    test('should error if assignment to destructured prop binding', () => {
      expect(() =>
        compile(
          `<script setup>
          const { foo } = defineProps(['foo'])
          foo = 'bar'
          </script>`,
        ),
      ).toThrow(`Cannot assign to destructured props`)

      expect(() =>
        compile(
          `<script setup>
          let { foo } = defineProps(['foo'])
          foo = 'bar'
          </script>`,
        ),
      ).toThrow(`Cannot assign to destructured props`)
    })

    test('should error when passing destructured prop into certain methods', () => {
      expect(() =>
        compile(
          `<script setup>
        import { watch } from 'vue'
        const { foo } = defineProps(['foo'])
        watch(foo, () => {})
        </script>`,
        ),
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to watch().`,
      )

      expect(() =>
        compile(
          `<script setup>
        import { watch as w } from 'vue'
        const { foo } = defineProps(['foo'])
        w(foo, () => {})
        </script>`,
        ),
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to watch().`,
      )

      expect(() =>
        compile(
          `<script setup>
        import { toRef } from 'vue'
        const { foo } = defineProps(['foo'])
        toRef(foo)
        </script>`,
        ),
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to toRef().`,
      )

      expect(() =>
        compile(
          `<script setup>
        import { toRef as r } from 'vue'
        const { foo } = defineProps(['foo'])
        r(foo)
        </script>`,
        ),
      ).toThrow(
        `"foo" is a destructured prop and should not be passed directly to toRef().`,
      )
    })

    // not comprehensive, but should help for most common cases
    test('should error if default value type does not match declared type', () => {
      expect(() =>
        compile(
          `<script setup lang="ts">
        const { foo = 'hello' } = defineProps<{ foo?: number }>()
        </script>`,
        ),
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
        </script>`,
        ),
      ).not.toThrowError()
    })
  })
})
