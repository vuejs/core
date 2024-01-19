import { compileStyle, parse } from '../src'
import { assertCode, compileSFCScript, mockId } from './utils'

describe('CSS vars injection', () => {
  test('generating correct code for nested paths', () => {
    const { content } = compileSFCScript(
      `<script>const a = 1</script>\n` +
        `<style>div{
          color: v-bind(color);
          font-size: v-bind('font.size');
        }</style>`,
    )
    expect(content).toMatch(`_useCssVars(_ctx => ({
  "${mockId}-color": (_ctx.color),
  "${mockId}-font\\.size": (_ctx.font.size)
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
        </style>`,
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
        </style>`,
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
      `import { useCssVars as _useCssVars, unref as _unref } from 'vue'`,
    )
    assertCode(content)
  })

  test('should rewrite CSS vars in compileStyle', () => {
    const { code } = compileStyle({
      source: `.foo {
        color: v-bind(color);
        font-size: v-bind('font.size');

        font-weight: v-bind(_φ);
        font-size: v-bind(1-字号);
        font-family: v-bind(フォント);
      }`,
      filename: 'test.css',
      id: 'data-v-test',
    })
    expect(code).toMatchInlineSnapshot(`
      ".foo {
              color: var(--test-color);
              font-size: var(--test-font\\.size);

              font-weight: var(--test-_φ);
              font-size: var(--test-1-字号);
              font-family: var(--test-フォント);
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
      { isProd: true },
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
      isProd: true,
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
            `<style>div{ color: v-bind(color); }</style>`,
        ).content,
      )
    })

    test('<script> w/ default export', () => {
      assertCode(
        compileSFCScript(
          `<script>export default { setup() {} }</script>\n` +
            `<style>div{ color: v-bind(color); }</style>`,
        ).content,
      )
    })

    test('<script> w/ default export in strings/comments', () => {
      assertCode(
        compileSFCScript(
          `<script>
          // export default {}
          export default {}
        </script>\n` + `<style>div{ color: v-bind(color); }</style>`,
        ).content,
      )
    })

    test('w/ <script setup>', () => {
      assertCode(
        compileSFCScript(
          `<script setup>const color = 'red'</script>\n` +
            `<style>div{ color: v-bind(color); }</style>`,
        ).content,
      )
    })

    //#4185
    test('should ignore comments', () => {
      const { content } = compileSFCScript(
        `<script setup>const color = 'red';const width = 100</script>\n` +
          `<style>
            /* comment **/
            div{ /* color: v-bind(color); */ width:20; }
            div{ width: v-bind(width); }
            /* comment */
          </style>`,
      )

      expect(content).not.toMatch(`"${mockId}-color": (color)`)
      expect(content).toMatch(`"${mockId}-width": (width)`)
      assertCode(content)
    })

    test('w/ <script setup> using the same var multiple times', () => {
      const { content } = compileSFCScript(
        `<script setup>
        const color = 'red'
        </script>\n` +
          `<style>
          div {
            color: v-bind(color);
          }
          p {
            color: v-bind(color);
          }
        </style>`,
      )
      // color should only be injected once, even if it is twice in style
      expect(content).toMatch(`_useCssVars(_ctx => ({
  "${mockId}-color": (color)
})`)
      assertCode(content)
    })

    test('should work with w/ complex expression', () => {
      const { content } = compileSFCScript(
        `<script setup>
        let a = 100
        let b = 200
        let foo = 300
        </script>\n` +
          `<style>
          p{
            width: calc(v-bind(foo) - 3px);
            height: calc(v-bind('foo') - 3px);
            top: calc(v-bind(foo + 'px') - 3px);
          }
          div {
            color: v-bind((a + b) / 2 + 'px' );
          }
          div {
            color: v-bind    ((a + b) / 2 + 'px' );
          }
          p {
            color: v-bind(((a + b)) / (2 * a));
          }
        </style>`,
      )
      expect(content).toMatch(`_useCssVars(_ctx => ({
  "${mockId}-foo": (_unref(foo)),
  "${mockId}-foo\\ \\+\\ \\'px\\'": (_unref(foo) + 'px'),
  "${mockId}-\\(a\\ \\+\\ b\\)\\ \\/\\ 2\\ \\+\\ \\'px\\'": ((_unref(a) + _unref(b)) / 2 + 'px'),
  "${mockId}-\\(\\(a\\ \\+\\ b\\)\\)\\ \\/\\ \\(2\\ \\*\\ a\\)": (((_unref(a) + _unref(b))) / (2 * _unref(a)))
}))`)
      assertCode(content)
    })

    // #6022
    test('should be able to parse incomplete expressions', () => {
      const {
        descriptor: { cssVars },
      } = parse(
        `<script setup>let xxx = 1</script>
        <style scoped>
        label {
          font-weight: v-bind("count.toString(");
          font-weight: v-bind(xxx);
        }
        </style>`,
      )
      expect(cssVars).toMatchObject([`count.toString(`, `xxx`])
    })

    // #7759
    test('It should correctly parse the case where there is no space after the script tag', () => {
      const { content } = compileSFCScript(
        `<script setup>import { ref as _ref } from 'vue';
                let background = _ref('red')
             </script>
             <style>
             label {
               background: v-bind(background);
             }
             </style>`,
      )
      expect(content).toMatch(
        `export default {\n  setup(__props, { expose: __expose }) {\n  __expose();\n\n_useCssVars(_ctx => ({\n  "xxxxxxxx-background": (_unref(background))\n}))`,
      )
    })

    describe('skip codegen in SSR', () => {
      test('script setup, inline', () => {
        const { content } = compileSFCScript(
          `<script setup>
          let size = 1
          </script>\n` +
            `<style>
              div {
                font-size: v-bind(size);
              }
            </style>`,
          {
            inlineTemplate: true,
            templateOptions: {
              ssr: true,
            },
          },
        )
        expect(content).not.toMatch(`_useCssVars`)
      })

      // #6926
      test('script, non-inline', () => {
        const { content } = compileSFCScript(
          `<script setup>
          let size = 1
          </script>\n` +
            `<style>
              div {
                font-size: v-bind(size);
              }
            </style>`,
          {
            inlineTemplate: false,
            templateOptions: {
              ssr: true,
            },
          },
        )
        expect(content).not.toMatch(`_useCssVars`)
      })

      test('normal script', () => {
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
            </style>`,
          {
            templateOptions: {
              ssr: true,
            },
          },
        )
        expect(content).not.toMatch(`_useCssVars`)
      })
    })
  })
})
