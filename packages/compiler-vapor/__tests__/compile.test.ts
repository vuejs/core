import { BindingTypes } from '@vue/compiler-dom'
import { compile } from '../src'

describe('comile', () => {
  test('static template', () => {
    const { code } = compile(
      `<div>
        <p>hello</p>
        <input />
        <span />
      </div>`,
    )
    expect(code).matchSnapshot()
  })

  test('bindings', () => {
    const { code } = compile(`<div>{{ count }}</div>`, {
      bindingMetadata: {
        count: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  describe('directives', () => {
    describe('v-bind', () => {
      test('simple expression', () => {
        const { code } = compile(`<div :id="id"></div>`, {
          bindingMetadata: {
            id: BindingTypes.SETUP_REF,
          },
        })
        expect(code).matchSnapshot()
      })
    })

    describe('v-on', () => {
      test('simple expression', () => {
        const { code } = compile(`<div @click="handleClick"></div>`, {
          bindingMetadata: {
            handleClick: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })
    })

    describe('v-html', () => {
      test('simple expression', () => {
        const { code } = compile(`<div v-html="code"></div>`, {
          bindingMetadata: {
            code: BindingTypes.SETUP_REF,
          },
        })
        expect(code).matchSnapshot()
      })

      test('no expression', () => {
        const { code } = compile(`<div v-html></div>`)
        expect(code).matchSnapshot()
      })
    })

    describe('v-text', () => {
      test('simple expression', () => {
        const { code } = compile(`<div v-text="str"></div>`, {
          bindingMetadata: {
            str: BindingTypes.SETUP_REF,
          },
        })
        expect(code).matchSnapshot()
      })

      test('no expression', () => {
        const { code } = compile(`<div v-text></div>`)
        expect(code).matchSnapshot()
      })
    })

    test('v-once', () => {
      const { code } = compile(
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
  })
})
