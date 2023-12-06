import {
  type RootNode,
  BindingTypes,
  ErrorCodes,
  DOMErrorCodes,
} from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../src'

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

describe('compile', () => {
  test('static template', async () => {
    const code = await compile(
      `<div>
        <p>hello</p>
        <input />
        <span />
      </div>`,
    )
    expect(code).matchSnapshot()
  })

  test('dynamic root', async () => {
    const code = await compile(`{{ 1 }}{{ 2 }}`)
    expect(code).matchSnapshot()
  })

  test('dynamic root nodes and interpolation', async () => {
    const code = await compile(
      `<button @click="handleClick" :id="count">{{count}}foo{{count}}foo{{count}} </button>`,
    )
    expect(code).matchSnapshot()
  })

  test('static + dynamic root', async () => {
    const code = await compile(
      `{{ 1 }}{{ 2 }}3{{ 4 }}{{ 5 }}6{{ 7 }}{{ 8 }}9{{ 'A' }}{{ 'B' }}`,
    )
    expect(code).matchSnapshot()
  })

  test('fragment', async () => {
    const code = await compile(`<p/><span/><div/>`)
    expect(code).matchSnapshot()
  })

  test('bindings', async () => {
    const code = await compile(`<div>count is {{ count }}.</div>`, {
      bindingMetadata: {
        count: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  describe('directives', () => {
    describe('v-bind', () => {
      test('simple expression', async () => {
        const code = await compile(`<div :id="id"></div>`, {
          bindingMetadata: {
            id: BindingTypes.SETUP_REF,
          },
        })
        expect(code).matchSnapshot()
      })

      test('should error if no expression', async () => {
        const onError = vi.fn()
        const code = await compile(`<div v-bind:arg="" />`, { onError })

        expect(onError.mock.calls[0][0]).toMatchObject({
          code: ErrorCodes.X_V_BIND_NO_EXPRESSION,
          loc: {
            start: {
              line: 1,
              column: 6,
            },
            end: {
              line: 1,
              column: 19,
            },
          },
        })

        expect(code).matchSnapshot()
        // the arg is static
        expect(code).contains(JSON.stringify('<div arg=""></div>'))
      })

      test('no expression', async () => {
        const code = await compile('<div v-bind:id />', {
          bindingMetadata: {
            id: BindingTypes.SETUP_REF,
          },
        })

        expect(code).matchSnapshot()
        expect(code).contains('_setAttr(n1, "id", undefined, _ctx.id)')
      })

      test('no expression (shorthand)', async () => {
        const code = await compile('<div :camel-case />', {
          bindingMetadata: {
            camelCase: BindingTypes.SETUP_REF,
          },
        })

        expect(code).matchSnapshot()
        expect(code).contains(
          '_setAttr(n1, "camel-case", undefined, _ctx.camelCase)',
        )
      })

      test('dynamic arg', async () => {
        const code = await compile('<div v-bind:[id]="id"/>', {
          bindingMetadata: {
            id: BindingTypes.SETUP_REF,
          },
        })

        expect(code).matchSnapshot()
        expect(code).contains('_setAttr(n1, _ctx.id, undefined, _ctx.id)')
      })

      // TODO: camel modifier for v-bind
      test.fails('.camel modifier', async () => {
        const code = await compile(`<div v-bind:foo-bar.camel="id"/>`)

        expect(code).matchSnapshot()
        expect(code).contains('fooBar')
      })
    })

    describe('v-on', () => {
      test('simple expression', async () => {
        const code = await compile(`<div @click="handleClick"></div>`, {
          bindingMetadata: {
            handleClick: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('should error if no expression AND no modifier', async () => {
        const onError = vi.fn()
        await compile(`<div v-on:click />`, { onError })
        expect(onError.mock.calls[0][0]).toMatchObject({
          code: ErrorCodes.X_V_ON_NO_EXPRESSION,
          loc: {
            start: {
              line: 1,
              column: 6,
            },
            end: {
              line: 1,
              column: 16,
            },
          },
        })
      })

      test('event modifier', async () => {
        const code = await compile(
          `<a @click.stop="handleEvent"></a>
            <form @submit.prevent="handleEvent"></form>
            <a @click.stop.prevent="handleEvent"></a>
            <div @click.self="handleEvent"></div>
            <div @click.capture="handleEvent"></div>
            <a @click.once="handleEvent"></a>
            <div @scroll.passive="handleEvent"></div>
            <input @click.right="handleEvent" />
            <input @click.left="handleEvent" />
            <input @click.middle="handleEvent" />
            <input @click.enter.right="handleEvent" />
            <input @keyup.enter="handleEvent" />
            <input @keyup.tab="handleEvent" />
            <input @keyup.delete="handleEvent" />
            <input @keyup.esc="handleEvent" />
            <input @keyup.space="handleEvent" />
            <input @keyup.up="handleEvent" />
            <input @keyup.down="handleEvent" />
            <input @keyup.left="handleEvent" />
            <input @keyup.middle="submit" />
            <input @keyup.middle.self="submit" />
            <input @keyup.self.enter="handleEvent" />`,
          {
            bindingMetadata: {
              handleEvent: BindingTypes.SETUP_CONST,
            },
          },
        )
        expect(code).matchSnapshot()
      })
    })

    describe('v-html', () => {
      test('simple expression', async () => {
        const code = await compile(`<div v-html="code"></div>`, {
          bindingMetadata: {
            code: BindingTypes.SETUP_REF,
          },
        })
        expect(code).matchSnapshot()
      })

      test('should raise error and ignore children when v-html is present', async () => {
        const onError = vi.fn()
        const code = await compile(`<div v-html="test">hello</div>`, {
          onError,
        })
        expect(code).matchSnapshot()
        expect(onError.mock.calls).toMatchObject([
          [{ code: DOMErrorCodes.X_V_HTML_WITH_CHILDREN }],
        ])
      })

      test('should raise error if has no expression', async () => {
        const onError = vi.fn()
        const code = await compile(`<div v-html></div>`, {
          onError,
        })
        expect(code).matchSnapshot()
        expect(onError.mock.calls).toMatchObject([
          [{ code: DOMErrorCodes.X_V_HTML_NO_EXPRESSION }],
        ])
      })
    })

    describe('v-text', () => {
      test('simple expression', async () => {
        const code = await compile(`<div v-text="str"></div>`, {
          bindingMetadata: {
            str: BindingTypes.SETUP_REF,
          },
        })
        expect(code).matchSnapshot()
      })

      test('no expression', async () => {
        const onError = vi.fn()
        const code = await compile(`<div v-text></div>`, { onError })
        expect(code).matchSnapshot()
        expect(onError.mock.calls).toMatchObject([
          [{ code: DOMErrorCodes.X_V_TEXT_NO_EXPRESSION }],
        ])
      })
    })

    describe('v-once', () => {
      test('basic', async () => {
        const code = await compile(
          `<div v-once>
            {{ msg }}
            <span :class="clz" />
          </div>`,
          {
            bindingMetadata: {
              msg: BindingTypes.SETUP_REF,
              clz: BindingTypes.SETUP_REF,
            },
          },
        )
        expect(code).matchSnapshot()
      })

      test('as root node', async () => {
        const code = await compile(`<div :id="foo" v-once />`)
        expect(code).toMatchSnapshot()
        expect(code).not.contains('effect')
      })
    })

    describe('v-pre', () => {
      test('basic', async () => {
        const code = await compile(
          `<div v-pre :id="foo"><Comp/>{{ bar }}</div>\n`,
          {
            bindingMetadata: {
              foo: BindingTypes.SETUP_REF,
              bar: BindingTypes.SETUP_REF,
            },
          },
        )

        expect(code).toMatchSnapshot()
        expect(code).contains(
          JSON.stringify('<div :id="foo"><Comp></Comp>{{ bar }}</div>'),
        )
        expect(code).not.contains('effect')
      })

      // TODO: support multiple root nodes and components
      test('should not affect siblings after it', async () => {
        const code = await compile(
          `<div v-pre :id="foo"><Comp/>{{ bar }}</div>\n` +
            `<div :id="foo"><Comp/>{{ bar }}</div>`,
          {
            bindingMetadata: {
              foo: BindingTypes.SETUP_REF,
              bar: BindingTypes.SETUP_REF,
            },
          },
        )

        expect(code).toMatchSnapshot()
        // Waiting for TODO, There should be more here.
      })

      // TODO: support multiple root nodes and components
      test('self-closing v-pre', async () => {
        const code = await compile(
          `<div v-pre/>\n<div :id="foo"><Comp/>{{ bar }}</div>`,
        )

        expect(code).toMatchSnapshot()
        expect(code).contains('<div></div><div><Comp></Comp></div>')
        // Waiting for TODO, There should be more here.
      })
    })

    describe('v-cloak', () => {
      test('basic', async () => {
        const code = await compile(`<div v-cloak>test</div>`)
        expect(code).toMatchSnapshot()
        expect(code).not.contains('v-cloak')
      })
    })
  })

  describe('expression parsing', () => {
    test('interpolation', async () => {
      const code = await compile(`{{ a + b }}`, {
        inline: true,
        bindingMetadata: {
          b: BindingTypes.SETUP_REF,
        },
      })
      expect(code).matchSnapshot()
      expect(code).contains('a + b.value')
    })

    test('v-bind', async () => {
      const code = compile(`<div :[key+1]="foo[key+1]()" />`, {
        inline: true,
        bindingMetadata: {
          key: BindingTypes.SETUP_REF,
          foo: BindingTypes.SETUP_MAYBE_REF,
        },
      })
      expect(code).matchSnapshot()
      expect(code).contains('key.value+1')
      expect(code).contains('_unref(foo)[key.value+1]()')
    })

    // TODO: add more test for expression parsing (v-on, v-slot, v-for)
  })
})
