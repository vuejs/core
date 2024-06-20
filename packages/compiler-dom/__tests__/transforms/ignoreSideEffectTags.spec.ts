import { type CompilerError, compile } from '../../src'

describe('compiler: ignore side effect tags', () => {
  it('should ignore script', () => {
    let err: CompilerError | undefined
    const { code } = compile(`<script>console.log(1)</script>`, {
      onError(e) {
        err = e
      },
    })
    expect(code).not.toMatch('script')
    expect(err).toBeDefined()
    expect(err!.message).toMatch(`Tags with side effect`)
  })

  it('should allow script when allowSideEffectTags is true', () => {
    const { code } = compile(`<script>console.log(1)</script>`, {
      allowSideEffectTags: true,
    })
    expect(code).toMatch('script')
  })

  it('should ignore style', () => {
    let err: CompilerError | undefined
    const { code } = compile(`<style>h1 { color: red }</style>`, {
      onError(e) {
        err = e
      },
    })
    expect(code).not.toMatch('style')
    expect(err).toBeDefined()
    expect(err!.message).toMatch(`Tags with side effect`)
  })

  it('should allow style when allowSideEffectTags is true', () => {
    const { code } = compile(`<style>h1 { color: red }</style>`, {
      allowSideEffectTags: true,
    })
    expect(code).toMatch('style')
  })
})
