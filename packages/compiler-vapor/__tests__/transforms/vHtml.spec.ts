import { type RootNode, BindingTypes, DOMErrorCodes } from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../../src'

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

describe('v-html', () => {
  test('simple expression', () => {
    const code = compile(`<div v-html="code"></div>`, {
      bindingMetadata: {
        code: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  test('should raise error and ignore children when v-html is present', () => {
    const onError = vi.fn()
    const code = compile(`<div v-html="test">hello</div>`, {
      onError,
    })
    expect(code).matchSnapshot()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_WITH_CHILDREN }],
    ])
  })

  test('should raise error if has no expression', () => {
    const onError = vi.fn()
    const code = compile(`<div v-html></div>`, {
      onError,
    })
    expect(code).matchSnapshot()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_NO_EXPRESSION }],
    ])
  })
})
