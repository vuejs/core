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

  it('should emit an error with two defineProps', () => {
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
