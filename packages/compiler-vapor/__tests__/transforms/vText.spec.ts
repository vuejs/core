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

describe('v-text', () => {
  test('simple expression', () => {
    const code = compile(`<div v-text="str"></div>`, {
      bindingMetadata: {
        str: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  test('no expression', () => {
    const onError = vi.fn()
    const code = compile(`<div v-text></div>`, { onError })
    expect(code).matchSnapshot()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_TEXT_NO_EXPRESSION }],
    ])
  })
})
