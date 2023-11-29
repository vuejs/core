import { BindingTypes, CompilerOptions, RootNode } from '@vue/compiler-dom'
// TODO remove it
import { format } from 'prettier'
import { compile as _compile } from '../src'
import { ErrorCodes } from '../src/errors'

async function compile(
  template: string | RootNode,
  options: CompilerOptions = {},
) {
  let { code } = _compile(template, options)
  code = await format(code, {
    parser: 'babel',
    printWidth: 999999,
    singleQuote: true,
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
        await compile(`<div v-bind:arg />`, { onError })

        expect(onError.mock.calls[0][0]).toMatchObject({
          code: ErrorCodes.VAPOR_BIND_NO_EXPRESSION,
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
          code: ErrorCodes.VAPOR_ON_NO_EXPRESSION,
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
          `<div @click.prevent.stop="handleClick"></div>`,
          {
            bindingMetadata: {
              handleClick: BindingTypes.SETUP_CONST,
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

      test('no expression', async () => {
        const code = await compile(`<div v-html></div>`)
        expect(code).matchSnapshot()
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
        const code = await compile(`<div v-text></div>`)
        expect(code).matchSnapshot()
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

      test.fails('as root node', async () => {
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
        expect(code).contains('<div :id="foo"><Comp></Comp>{{ bar }}</div>')
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
  })
})
