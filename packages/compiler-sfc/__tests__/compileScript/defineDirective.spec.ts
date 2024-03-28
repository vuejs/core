import { assertCode, compileSFCScript as compile } from '../utils'

describe('defineProps', () => {
  test('basic usage', () => {
    const { content } = compile(`
    <script setup>
      const vTest = defineDirective({ created(){} })
    </script>
    `)
    expect(content).toMatchInlineSnapshot(`
      "
      export default {
        setup(__props, { expose: __expose }) {
        __expose();

            const vTest = { created(){} }
          
      return { vTest }
      }

      }"
    `)

    assertCode(content)
    expect(content).not.toMatch('defineDirective')
    expect(content).toMatch('const vTest = { created(){} }')
    expect(content).toMatch('return { vTest }')
  })

  test('with typescript', () => {
    const { content } = compile(`
    <script setup lang="ts">
      const vTest = defineDirective({ created(){} } as { name: string })
    </script>
    `)
    expect(content).toMatchInlineSnapshot(`
      "import { defineComponent as _defineComponent } from 'vue'

      export default /*#__PURE__*/_defineComponent({
        setup(__props, { expose: __expose }) {
        __expose();

            const vTest = { created(){} }
          
      return { vTest }
      }

      })"
    `)

    assertCode(content)
    expect(content).not.toMatch('defineDirective')
    expect(content).toMatch('const vTest = { created(){} }')
    expect(content).toMatch('return { vTest }')
  })

  test('use with other micro', () => {
    const { content } = compile(`
    <script setup>
      const vTest = defineDirective({ created(){} })
      const props = defineProps({
        bar: String
      })
    </script>
    `)
    expect(content).toMatchInlineSnapshot(`
      "
      export default {
        props: {
              bar: String
            },
        setup(__props, { expose: __expose }) {
        __expose();

            const vTest = { created(){} }
            const props = __props
          
      return { vTest, props }
      }

      }"
    `)

    assertCode(content)
    expect(content).not.toMatch('defineDirective')
    expect(content).toMatch('const vTest = { created(){} }')
    expect(content).toMatch('return { vTest, props }')
  })

  test('use of multiple define micro', () => {
    const { content } = compile(`
    <script setup>
      const vTest = defineDirective({ created(){} })
      const props = defineProps({
        bar: String
      })
      const vFoo = defineDirective({ mounted(){} })
    </script>
    `)
    expect(content).toMatchInlineSnapshot(`
      "
      export default {
        props: {
              bar: String
            },
        setup(__props, { expose: __expose }) {
        __expose();

            const vTest = { created(){} }
            const props = __props
            const vFoo = { mounted(){} }
          
      return { vTest, props, vFoo }
      }

      }"
    `)

    assertCode(content)
    expect(content).not.toMatch('defineDirective')
    expect(content).toMatch('const vTest = { created(){} }')
    expect(content).toMatch('const vFoo = { mounted(){} }')
    expect(content).toMatch('return { vTest, props, vFoo }')
  })
})
