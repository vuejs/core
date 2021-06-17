import { compileStyle } from '../src'
import { mockId, compileSFCScript, assertCode } from './utils'

describe('CSS vars injection', () => {
  test('generating correct code for nested paths', () => {
    const { content } = compileSFCScript(
      `<script>const a = 1</script>\n` +
        `<style>div{
          color: v-bind(color);
          font-size: v-bind('font.size');
        }</style>`
    )
    expect(content).toMatch(`_useCssVars(_ctx => ({
  "${mockId}-color": (_ctx.color),
  "${mockId}-font_size": (_ctx.font.size)
})`)
    assertCode(content)
  })

  test('w/ normal <script> binding analysis', () => {
    const { content } = compileSFCScript(
      `<script>
      export default {
        setup() {
          return {
            size: ref('100px')
          }
        }
      }
      </script>\n` +
        `<style>
          div {
            font-size: v-bind(size);
          }
        </style>`
    )
    expect(content).toMatch(`_useCssVars(_ctx => ({
  "${mockId}-size": (_ctx.size)
})`)
    expect(content).toMatch(`import { useCssVars as _useCssVars } from 'vue'`)
    assertCode(content)
  })

  test('w/ <script setup> binding analysis', () => {
    const { content } = compileSFCScript(
      `<script setup>
        import { defineProps, ref } from 'vue'
        const color = 'red'
        const size = ref('10px')
        defineProps({
          foo: String
        })
        </script>\n` +
        `<style>
          div {
            color: v-bind(color);
            font-size: v-bind(size);
            border: v-bind(foo);
          }
        </style>`
    )
    // should handle:
    // 1. local const bindings
    // 2. local potential ref bindings
    // 3. props bindings (analyzed)
    expect(content).toMatch(`_useCssVars(_ctx => ({
  "${mockId}-color": (color),
  "${mockId}-size": (size.value),
  "${mockId}-foo": (__props.foo)
})`)
    expect(content).toMatch(
      `import { useCssVars as _useCssVars, unref as _unref } from 'vue'`
    )
    assertCode(content)
  })

  test('should rewrite CSS vars in compileStyle', () => {
    const { code } = compileStyle({
      source: `.foo {
        color: v-bind(color);
        font-size: v-bind('font.size');
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

  test('prod mode', () => {
    const { content } = compileSFCScript(
      `<script>const a = 1</script>\n` +
        `<style>div{
          color: v-bind(color);
          font-size: v-bind('font.size');
        }</style>`,
      { isProd: true }
    )
    expect(content).toMatch(`_useCssVars(_ctx => ({
  "4003f1a6": (_ctx.color),
  "41b6490a": (_ctx.font.size)
}))}`)

    const { code } = compileStyle({
      source: `.foo {
        color: v-bind(color);
        font-size: v-bind('font.size');
      }`,
      filename: 'test.css',
      id: mockId,
      isProd: true
    })
    expect(code).toMatchInlineSnapshot(`
      ".foo {
              color: var(--4003f1a6);
              font-size: var(--41b6490a);
      }"
    `)
  })

  describe('codegen', () => {
    test('<script> w/ no default export', () => {
      assertCode(
        compileSFCScript(
          `<script>const a = 1</script>\n` +
            `<style>div{ color: v-bind(color); }</style>`
        ).content
      )
    })

    test('<script> w/ default export', () => {
      assertCode(
        compileSFCScript(
          `<script>export default { setup() {} }</script>\n` +
            `<style>div{ color: v-bind(color); }</style>`
        ).content
      )
    })

    test('<script> w/ default export in strings/comments', () => {
      assertCode(
        compileSFCScript(
          `<script>
          // export default {}
          export default {}
        </script>\n` + `<style>div{ color: v-bind(color); }</style>`
        ).content
      )
    })

    test('w/ <script setup>', () => {
      assertCode(
        compileSFCScript(
          `<script setup>const color = 'red'</script>\n` +
            `<style>div{ color: v-bind(color); }</style>`
        ).content
      )
    })
  })
})
