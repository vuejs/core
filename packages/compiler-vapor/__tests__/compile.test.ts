import { BindingTypes, CompilerOptions, RootNode } from '@vue/compiler-dom'
// TODO remove it
import { format } from 'prettier'
import { compile as _compile } from '../src'

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

describe('comile', () => {
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
        expect(code).not.contains('watchEffect')
      })
    })
  })
})
