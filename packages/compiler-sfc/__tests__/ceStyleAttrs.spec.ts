import { parse } from '../src'
import { assertCode, compileSFCScript } from './utils'

describe('CE style attrs injection', () => {
  test('generating correct code for nested paths', () => {
    const { content } = compileSFCScript(
      `<script>const a = 1</script>\n` +
        `<style :id="{ id: msg3, 'other-attr': msg }"
id="{ id: msg2, 'other-attr': msg }"
.id="{ id: msg, 'other-attr': msg }"
v-bind:src="msg"
v-bind:[msg]="msg"
:[msg]="msg"
:xlink:special="msg">div{
          color: red;
        }</style>`,
    )

    expect(content).toMatch(`_useCEStyleAttrs(_ctx => ([
  {
   "id": { id: _ctx.msg3, 'other-attr': _ctx.msg },
   "src": _ctx.msg,
   [_ctx.msg]: _ctx.msg,
   "xlink:special": _ctx.msg,
 },
]))}`)
    assertCode(content)
  })

  test('w/ normal <script> binding analysis', () => {
    const { content } = compileSFCScript(
      `<script>
      export default {
        setup() {
          return {
            msg: ref('100px')
          }
        }
      }
      </script>\n` +
        `<style :id="{ id: msg3, 'other-attr': msg }"
      id="{ id: msg2, 'other-attr': msg }"
      .id="{ id: msg, 'other-attr': msg }"
      v-bind:src="msg"
      v-bind:[msg]="msg"
      :[msg]="msg"
      :xlink:special="msg">
          div {
            color: red;
          }
        </style>`,
    )
    expect(content).toMatch(`_useCEStyleAttrs(_ctx => ([
  {
   "id": { id: _ctx.msg3, 'other-attr': _ctx.msg },
   "src": _ctx.msg,
   [_ctx.msg]: _ctx.msg,
   "xlink:special": _ctx.msg,
 },
]))}`)
    expect(content).toMatch(
      `import { useCEStyleAttrs as _useCEStyleAttrs } from 'vue'`,
    )
    assertCode(content)
  })

  test('w/ <script setup> binding analysis', () => {
    const { content } = compileSFCScript(
      `<script setup>
        import { defineProps, ref } from 'vue'
        const msg = 'red'
        const msg2 = ref('10px')
        defineProps({
          msg3: String
        })
        </script>\n` +
        `<style :id="{ id: msg3, 'other-attr': msg }"
      id="{ id: msg2, 'other-attr': msg }"
      .id="{ id: msg, 'other-attr': msg }"
      v-bind:src="msg2"
      v-bind:[msg]="msg"
      :[msg]="msg3"
      :xlink:special="msg3">
          div {
            color: red;
          }
        </style>`,
    )
    // should handle:
    // 1. local const bindings
    // 2. local potential ref bindings
    // 3. props bindings (analyzed)
    expect(content).toMatch(`_useCEStyleAttrs(_ctx => ([
  {
   "id": { id: __props.msg3, 'other-attr': msg },
   "src": msg2.value,
   [msg]: msg,
   "xlink:special": __props.msg3,
 },
]))`)
    expect(content).toMatch(
      `import { useCEStyleAttrs as _useCEStyleAttrs, unref as _unref } from 'vue'`,
    )
    assertCode(content)
  })

  describe('codegen', () => {
    test('<script> w/ no default export', () => {
      assertCode(
        compileSFCScript(
          `<script>const msg = 1</script>\n` +
            `<style :id="{ id: msg3, 'other-attr': msg }"
id="{ id: msg2, 'other-attr': msg }"
.id="{ id: msg, 'other-attr': msg }"
v-bind:src="msg"
v-bind:[msg]="msg"
:[msg]="msg"
:xlink:special="msg">div{ color: red; }</style>`,
        ).content,
      )
    })

    test('<script> w/ default export', () => {
      assertCode(
        compileSFCScript(
          `<script>export default { setup() {} }</script>\n` +
            `<style :id="{ id: msg3, 'other-attr': msg }"
id="{ id: msg2, 'other-attr': msg }"
.id="{ id: msg, 'other-attr': msg }"
v-bind:src="msg"
v-bind:[msg]="msg"
:[msg]="msg"
:xlink:special="msg>div{ color: red }</style>`,
        ).content,
      )
    })

    test('<script> w/ default export in strings/comments', () => {
      assertCode(
        compileSFCScript(
          `<script>
          // export default {}
          export default {}
        </script>\n` +
            `<style :id="{ id: msg3, 'other-attr': msg }"
id="{ id: msg2, 'other-attr': msg }"
.id="{ id: msg, 'other-attr': msg }"
v-bind:src="msg"
v-bind:[msg]="msg"
:[msg]="msg"
:xlink:special="msg>div{ color: red }</style>`,
        ).content,
      )
    })

    test('w/ <script setup>', () => {
      assertCode(
        compileSFCScript(
          `<script setup>const msg = 'red'</script>\n` +
            `<style :id="{ id: msg3, 'other-attr': msg }"
id="{ id: msg2, 'other-attr': msg }"
.id="{ id: msg, 'other-attr': msg }"
v-bind:src="msg"
v-bind:[msg]="msg"
:[msg]="msg"
:xlink:special="msg>div{ color: red }</style>`,
        ).content,
      )
    })

    test('w/ <script setup> using the same var multiple times', () => {
      const { content } = compileSFCScript(
        `<script setup>
        const msg = 'red'
        </script>\n` +
          `<style :id="{ id: msg3, 'other-attr': msg }"
id="{ id: msg2, 'other-attr': msg }"
.id="{ id: msg, 'other-attr': msg }">
        
          p {
            color: red;
          }
        </style>`,
      )

      // id should only be injected once, even if it is twice in style
      expect(content).toMatch(`_useCEStyleAttrs(_ctx => ([
  {
   "id": { id: _ctx.msg3, 'other-attr': msg },
 },
]))`)
      assertCode(content)
    })

    test('should be able to parse incomplete expressions', () => {
      const {
        descriptor: { ceStyleAttrs },
      } = parse(
        `<script setup>let xxx = 1</script>
        <style scoped lang :id="xxx" :data-name="count.toString(">
        label {
         color:red
        }
        </style>`,
      )
      expect(ceStyleAttrs[0].length).toBe(2)
      expect(ceStyleAttrs[0]).toMatchObject([
        {
          name: 'bind',
          exp: {
            content: 'xxx',
            isStatic: false,
            constType: 0,
          },
          arg: {
            content: 'id',
            isStatic: true,
            constType: 3,
          },
        },
        {
          name: 'bind',
          exp: {
            content: 'count.toString(',
            isStatic: false,
            constType: 0,
          },
          arg: {
            content: 'data-name',
            isStatic: true,
            constType: 3,
          },
        },
      ])
    })

    test('It should correctly parse the case where there is no space after the script tag', () => {
      const { content } = compileSFCScript(
        `<script setup>import { ref as _ref } from 'vue';
                let background = _ref('red')
             </script>
             <style :id="background">
             h1 {color: red}
             </style>`,
      )
      expect(content).toMatch(
        `import { useCEStyleAttrs as _useCEStyleAttrs, unref as _unref } from 'vue'\nimport { ref as _ref } from 'vue';\n                \nexport default {\n  setup(__props, { expose: __expose }) {\n  __expose();\n\n_useCEStyleAttrs(_ctx => ([\n  {\n   \"id\": _unref(background),\n },\n]))\nlet background = _ref('red')\n             \nreturn { get background() { return background }, set background(v) { background = v }, _ref }\n}\n\n}`,
      )
    })

    test('With cssvars', () => {
      const { content } = compileSFCScript(
        `<script setup>import { ref as _ref } from 'vue';
                let background = _ref('red')
             </script>
             <style :id="background">
             label {
               background: v-bind(background);
             }
             </style>`,
      )
      expect(content).toMatch(
        `import { useCssVars as _useCssVars, unref as _unref, useCEStyleAttrs as _useCEStyleAttrs } from 'vue'\nimport { ref as _ref } from 'vue';\n                \nexport default {\n  setup(__props, { expose: __expose }) {\n  __expose();\n\n_useCEStyleAttrs(_ctx => ([\n  {\n   \"id\": _unref(background),\n },\n]))\n\n_useCssVars(_ctx => ({\n  \"xxxxxxxx-background\": (_unref(background))\n}))\nlet background = _ref('red')\n             \nreturn { get background() { return background }, set background(v) { background = v }, _ref }\n}\n\n}`,
      )
    })

    test('Multiple style tags', () => {
      const { content } = compileSFCScript(
        `<script setup>import { ref as _ref } from 'vue';
                let background = _ref('red')
             </script>
             <style :id="background">
             label {
               background: v-bind(background);
             }
             </style>
             <style :id="background">
             h1 {
               background: v-bind(background);
             }
             </style>`,
      )
      expect(content).toMatch(
        `import { useCssVars as _useCssVars, unref as _unref, useCEStyleAttrs as _useCEStyleAttrs } from 'vue'\nimport { ref as _ref } from 'vue';\n                \nexport default {\n  setup(__props, { expose: __expose }) {\n  __expose();\n\n_useCEStyleAttrs(_ctx => ([\n  {\n   \"id\": _unref(background),\n },\n  {\n   \"id\": _unref(background),\n },\n]))\n\n_useCssVars(_ctx => ({\n  \"xxxxxxxx-background\": (_unref(background))\n}))\nlet background = _ref('red')\n             \nreturn { get background() { return background }, set background(v) { background = v }, _ref }\n}\n\n}`,
      )
    })

    describe('skip codegen in SSR', () => {
      test('script setup, inline', () => {
        const { content } = compileSFCScript(
          `<script setup>
          let size = 1
          </script>\n` +
            `<style :id="size">
              div {
                color: red
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
            `<style :id="size">
              div {
                color: red
              }
            </style>\``,
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
            `<style :id="size">
              div {
                color: red
              }
            </style>\``,
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
