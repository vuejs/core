import { compileStyle } from '../src'
import { compileSFCScript, assertCode } from './utils'

describe('CSS vars injection', () => {
  describe('codegen', () => {
    test('<script> w/ no default export', () => {
      assertCode(
        compileSFCScript(
          `<script>const a = 1</script>\n` +
            `<style>div{ color: var(--v-bind:color); }</style>`
        ).content
      )
    })

    test('<script> w/ default export', () => {
      assertCode(
        compileSFCScript(
          `<script>export default { setup() {} }</script>\n` +
            `<style>div{ color: var(--:color); }</style>`
        ).content
      )
    })

    test('<script> w/ default export in strings/comments', () => {
      assertCode(
        compileSFCScript(
          `<script>
          // export default {}
          export default {}
        </script>\n` + `<style>div{ color: var(--:color); }</style>`
        ).content
      )
    })

    test('w/ <script setup>', () => {
      assertCode(
        compileSFCScript(
          `<script setup>const color = 'red'</script>\n` +
            `<style>div{ color: var(--:color); }</style>`
        ).content
      )
    })
  })

  test('generating correct code for nested paths', () => {
    const { content } = compileSFCScript(
      `<script>const a = 1</script>\n` +
        `<style>div{
          color: var(--v-bind:color);
          color: var(--v-bind:font.size);
        }</style>`
    )
    expect(content).toMatch(`_useCssVars(_ctx => ({
  color: (_ctx.color),
  font_size: (_ctx.font.size)
})`)
    assertCode(content)
  })

  test('w/ <script setup> binding analysis', () => {
    const { content } = compileSFCScript(
      `<script setup>
        import { defineOptions, ref } from 'vue'
        const color = 'red'
        const size = ref('10px')
        defineOptions({
          props: {
            foo: String
          }
        })
        </script>\n` +
        `<style>
          div {
            color: var(--:color);
            font-size: var(--:size);
            border: var(--:foo);
          }
        </style>`
    )
    // should handle:
    // 1. local const bindings
    // 2. local potential ref bindings
    // 3. props bindings (analyzed)
    expect(content).toMatch(`_useCssVars(_ctx => ({
  color: (color),
  size: (_unref(size)),
  foo: (__props.foo)
})`)
    expect(content).toMatch(
      `import { useCssVars as _useCssVars, unref as _unref } from 'vue'`
    )
    assertCode(content)
  })

  test('should rewrite CSS vars in scoped mode', () => {
    const { code } = compileStyle({
      source: `.foo {
        color: var(--v-bind:color);
        font-size: var(--:font.size);
      }`,
      filename: 'test.css',
      id: 'data-v-test'
    })
    expect(code).toMatchInlineSnapshot(`
      ".foo {
              color: var(--test-color);
              font-size: var(--test-font_size);
      }"
    `)
  })
})
