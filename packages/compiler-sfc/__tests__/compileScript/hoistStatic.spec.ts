import { BindingTypes } from '@vue/compiler-core'
import type { SFCScriptCompileOptions } from '../../src'
import { assertCode, compileSFCScript } from '../utils'

describe('sfc hoist static', () => {
  function compile(src: string, options?: Partial<SFCScriptCompileOptions>) {
    return compileSFCScript(src, {
      inlineTemplate: true,
      hoistStatic: true,
      ...options,
    })
  }

  test('should hoist literal value', () => {
    const code = `
    const string = 'default value'
    const number = 123
    const boolean = false
    const nil = null
    const bigint = 100n
    const template = \`str\`
    `.trim()
    const { content, bindings } = compile(`
    <script setup>
    ${code}
    </script>
    `)

    // should hoist to first line
    expect(content.startsWith(code)).toBe(true)
    expect(bindings).toStrictEqual({
      string: BindingTypes.LITERAL_CONST,
      number: BindingTypes.LITERAL_CONST,
      boolean: BindingTypes.LITERAL_CONST,
      nil: BindingTypes.LITERAL_CONST,
      bigint: BindingTypes.LITERAL_CONST,
      template: BindingTypes.LITERAL_CONST,
    })
    assertCode(content)
  })

  test('should hoist expressions', () => {
    const code = `
    const unary = !false
    const binary = 1 + 2
    const conditional = 1 ? 2 : 3
    const sequence = (1, true, 'foo', 1)
    `.trim()
    const { content, bindings } = compile(`
    <script setup>
    ${code}
    </script>
    `)
    // should hoist to first line
    expect(content.startsWith(code)).toBe(true)
    expect(bindings).toStrictEqual({
      binary: BindingTypes.LITERAL_CONST,
      conditional: BindingTypes.LITERAL_CONST,
      unary: BindingTypes.LITERAL_CONST,
      sequence: BindingTypes.LITERAL_CONST,
    })
    assertCode(content)
  })

  test('should hoist w/ defineProps/Emits', () => {
    const hoistCode = `const defaultValue = 'default value'`
    const { content, bindings } = compile(`
    <script setup>
    ${hoistCode}
    defineProps({
      foo: {
        default: defaultValue
      }
    })
    </script>
    `)

    // should hoist to first line
    expect(content.startsWith(hoistCode)).toBe(true)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      defaultValue: BindingTypes.LITERAL_CONST,
    })
    assertCode(content)
  })

  test('should not hoist a variable', () => {
    const code = `
    let KEY1 = 'default value'
    var KEY2 = 123
    const regex = /.*/g
    const undef = undefined
    `.trim()
    const { content, bindings } = compile(`
    <script setup>
    ${code}
    </script>
    `)
    expect(bindings).toStrictEqual({
      KEY1: BindingTypes.SETUP_LET,
      KEY2: BindingTypes.SETUP_LET,
      regex: BindingTypes.SETUP_CONST,
      undef: BindingTypes.SETUP_MAYBE_REF,
    })
    expect(content).toMatch(`setup(__props) {\n\n    ${code}`)
    assertCode(content)
  })

  test('should not hoist a constant initialized to a reference value', () => {
    const code = `
    const KEY1 = Boolean
    const KEY2 = [Boolean]
    const KEY3 = [getCurrentInstance()]
    let i = 0;
    const KEY4 = (i++, 'foo')
    enum KEY5 {
      FOO = 1,
      BAR = getCurrentInstance(),
    }
    const KEY6 = \`template\${i}\`
    `.trim()
    const { content, bindings } = compile(`
    <script setup lang="ts">
    ${code}
    </script>
    `)
    expect(bindings).toStrictEqual({
      KEY1: BindingTypes.SETUP_MAYBE_REF,
      KEY2: BindingTypes.SETUP_CONST,
      KEY3: BindingTypes.SETUP_CONST,
      KEY4: BindingTypes.SETUP_CONST,
      KEY5: BindingTypes.SETUP_CONST,
      KEY6: BindingTypes.SETUP_CONST,
      i: BindingTypes.SETUP_LET,
    })
    expect(content).toMatch(`setup(__props) {\n\n    ${code}`)
    assertCode(content)
  })

  test('should not hoist a object or array', () => {
    const code = `
    const obj = { foo: 'bar' }
    const arr = [1, 2, 3]
    `.trim()
    const { content, bindings } = compile(`
    <script setup>
    ${code}
    </script>
    `)
    expect(bindings).toStrictEqual({
      arr: BindingTypes.SETUP_CONST,
      obj: BindingTypes.SETUP_CONST,
    })
    expect(content).toMatch(`setup(__props) {\n\n    ${code}`)
    assertCode(content)
  })

  test('should not hoist a function or class', () => {
    const code = `
    const fn = () => {}
    function fn2() {}
    class Foo {}
    `.trim()
    const { content, bindings } = compile(`
    <script setup>
    ${code}
    </script>
    `)
    expect(bindings).toStrictEqual({
      Foo: BindingTypes.SETUP_CONST,
      fn: BindingTypes.SETUP_CONST,
      fn2: BindingTypes.SETUP_CONST,
    })
    expect(content).toMatch(`setup(__props) {\n\n    ${code}`)
    assertCode(content)
  })

  test('should enable when only script setup', () => {
    const { content, bindings } = compile(`
    <script>
    const foo = 'bar'
    </script>
    <script setup>
    const foo = 'bar'
    </script>
    `)
    expect(bindings).toStrictEqual({
      foo: BindingTypes.SETUP_CONST,
    })
    assertCode(content)
  })

  test('should not hoist when disabled', () => {
    const { content, bindings } = compile(
      `
    <script setup>
    const foo = 'bar'
    </script>
    `,
      { hoistStatic: false },
    )
    expect(bindings).toStrictEqual({
      foo: BindingTypes.SETUP_CONST,
    })
    assertCode(content)
  })

  test('template binding access in inline mode', () => {
    const { content } = compile(
      `
    <script setup>
    const foo = 'bar'
    </script>
    <template>{{ foo }}</template>
    `,
    )
    expect(content).toMatch('_toDisplayString(foo)')
  })
})
