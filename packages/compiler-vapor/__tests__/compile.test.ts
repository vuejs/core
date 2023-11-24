import { BindingTypes } from '@vue/compiler-dom'
import { compile } from '../src'

describe('comile', () => {
  it('static template', () => {
    const { code } = compile(
      `<div>
        <p>hello</p>
        <input />
      </div>`,
      {},
    )
    expect(code).matchSnapshot()
  })

  it('bindings', () => {
    const { code } = compile(`<div>{{ count }}</div>`, {
      bindingMetadata: {
        count: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })
})
