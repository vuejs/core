import { type CompilerError, compile } from '../../src'

describe('validate html nesting', () => {
  it('should warn with p > div', () => {
    let err: CompilerError | undefined
    compile(`<p><div></div></p>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeDefined()
    expect(err!.message).toMatch(`<div> cannot be child of <p>`)
  })

  it('should not warn with select > hr', () => {
    let err: CompilerError | undefined
    compile(`<select><hr></select>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeUndefined()
  })
})
