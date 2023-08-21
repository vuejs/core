import { compileSFCScript as compile, assertCode } from '../utils'

describe('defineOptions()', () => {
  test('basic usage', () => {
    const { content } = compile(`
      <script setup>
      defineOptions({ name: 'FooApp' })
      </script>
    `)
    assertCode(content)
    // should remove defineOptions import and call
    expect(content).not.toMatch('defineOptions')
    // should include context options in default export
    expect(content).toMatch(
      `export default /*#__PURE__*/Object.assign({ name: 'FooApp' }, `
    )
  })

  test('empty argument', () => {
    const { content } = compile(`
      <script setup>
      defineOptions()
      </script>
    `)
    assertCode(content)
    expect(content).toMatch(`export default {`)
    // should remove defineOptions import and call
    expect(content).not.toMatch('defineOptions')
  })

  it('should hoist leading comments up to export default', () => {
    const { content } = compile(
      `<script>\n` +
        `/** Script docstring. */\n` +
        `export default {}\n` +
        `</script>\n` +
        `\n` +
        `<script setup>\n` +
        `/** Script setup docstring 1 */\n` +
        `// Script setup docstring 2\n` +
        `/**\n` +
        ` * Script setup docstring 3\n` +
        ` */\n` +
        `defineOptions({})\n` +
        `</script>\n`
    )
    assertCode(content)
    // export default comments are set before __default__.
    expect(content).toMatch(`/** Script docstring. */\nconst __default__ = {}`)
    // defineOptions comments are set before export default.
    expect(content).toMatch(
      `/** Script setup docstring 1 */\n` +
        `// Script setup docstring 2\n` +
        `/**\n` +
        ` * Script setup docstring 3\n` +
        ` */\n` +
        `export default /*#__PURE__*/Object.assign(__default__, {}, {`
    )
  })

  it('should hoist comments even when called with no arguments', () => {
    const { content } = compile(
      `<script>\n` +
        `/** Script docstring. */\n` +
        `export default {}\n` +
        `</script>\n` +
        `\n` +
        `<script setup>\n` +
        `/** Script setup docstring 1 */\n` +
        `// Script setup docstring 2\n` +
        `/**\n` +
        ` * Script setup docstring 3\n` +
        ` */\n` +
        `defineOptions()\n` +
        `</script>\n`
    )
    assertCode(content)
    // export default comments are set before __default__.
    expect(content).toMatch(`/** Script docstring. */\nconst __default__ = {}`)
    // defineOptions comments are set before export default.
    expect(content).toMatch(
      `/** Script setup docstring 1 */\n` +
        `// Script setup docstring 2\n` +
        `/**\n` +
        ` * Script setup docstring 3\n` +
        ` */\n` +
        `export default /*#__PURE__*/Object.assign(__default__, {`
    )
  })

  it('should emit an error with two defineOptions', () => {
    expect(() =>
      compile(`
      <script setup>
      defineOptions({ name: 'FooApp' })
      defineOptions({ name: 'BarApp' })
      </script>
      `)
    ).toThrowError('[@vue/compiler-sfc] duplicate defineOptions() call')
  })

  it('should emit an error with props or emits property', () => {
    expect(() =>
      compile(`
      <script setup>
      defineOptions({ props: { foo: String } })
      </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare props. Use defineProps() instead.'
    )

    expect(() =>
      compile(`
      <script setup>
      defineOptions({ emits: ['update'] })
      </script>
    `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare emits. Use defineEmits() instead.'
    )

    expect(() =>
      compile(`
      <script setup>
      defineOptions({ expose: ['foo'] })
      </script>
    `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare expose. Use defineExpose() instead.'
    )

    expect(() =>
      compile(`
      <script setup>
      defineOptions({ slots: ['foo'] })
      </script>
    `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare slots. Use defineSlots() instead.'
    )
  })

  it('should emit an error with type generic', () => {
    expect(() =>
      compile(`
      <script setup lang="ts">
      defineOptions<{ name: 'FooApp' }>()
      </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot accept type arguments'
    )
  })

  it('should emit an error with type assertion', () => {
    expect(() =>
      compile(`
      <script setup lang="ts">
      defineOptions({ props: [] } as any)
      </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare props. Use defineProps() instead.'
    )
  })

  it('should emit an error with declaring props/emits/slots/expose', () => {
    expect(() =>
      compile(`
        <script setup>
        defineOptions({ props: ['foo'] })
        </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare props. Use defineProps() instead'
    )

    expect(() =>
      compile(`
        <script setup>
        defineOptions({ emits: ['update'] })
        </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare emits. Use defineEmits() instead'
    )

    expect(() =>
      compile(`
        <script setup>
        defineOptions({ expose: ['foo'] })
        </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare expose. Use defineExpose() instead'
    )

    expect(() =>
      compile(`
        <script setup lang="ts">
        defineOptions({ slots: Object })
        </script>
      `)
    ).toThrowError(
      '[@vue/compiler-sfc] defineOptions() cannot be used to declare slots. Use defineSlots() instead'
    )
  })
})
