import type { CompilerError } from '@vue/compiler-core'
import { compile } from '@vue/compiler-ssr'

describe('validate html nesting', () => {
  it('should warn with p > div', () => {
    let err: CompilerError | undefined
    compile(`<p><div></div></p>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeDefined()
    expect(err!.message).toMatch(`<div> as a child of <p>`)
  })

  it('should not warn with select > hr', () => {
    let err: CompilerError | undefined
    compile(`<select><hr></select>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeUndefined()
  })
})
