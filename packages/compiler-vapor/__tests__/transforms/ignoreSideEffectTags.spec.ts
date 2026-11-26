import { type CompilerError, DOMErrorCodes } from '@vue/compiler-dom'
import { compile } from '../../src'

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

  it('should keep the v-if chain of an ignored tag', () => {
    const errors: CompilerError[] = []
    const { code } = compile(
      `<style v-if="ok">{{ css }}</style><div v-else>x</div>`,
      {
        onError(e) {
          errors.push(e)
        },
      },
    )
    expect(errors.map(e => e.code)).toEqual([
      DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
    ])
    expect(code).toMatchSnapshot()
  })

  it('should drop an ignored tag between text', () => {
    const errors: CompilerError[] = []
    const { code } = compile(`<div>{{ a }}<style>x</style>{{ b }}</div>`, {
      onError(e) {
        errors.push(e)
      },
    })
    expect(errors.map(e => e.code)).toEqual([
      DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
    ])
    expect(code).toMatchSnapshot()
  })

  it('should drop an ignored tag between v-if branches', () => {
    const errors: CompilerError[] = []
    const { code } = compile(
      `<div v-if="ok">a</div><script>x</script><div v-else>b</div>`,
      {
        onError(e) {
          errors.push(e)
        },
      },
    )
    expect(errors.map(e => e.code)).toEqual([
      DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
    ])
    expect(code).toMatchSnapshot()
  })

  it('should merge static text around an ignored tag', () => {
    const errors: CompilerError[] = []
    const { code } = compile(`<div>a<style>x</style>b<span :id="id"/></div>`, {
      onError(e) {
        errors.push(e)
      },
    })
    expect(errors.map(e => e.code)).toEqual([
      DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
    ])
    expect(code).toMatchSnapshot()
  })

  it('should keep the v-for of an ignored tag', () => {
    const errors: CompilerError[] = []
    const { code } = compile(
      `<style v-for="i in list">{{ i }}</style><p>{{ msg }}</p>`,
      {
        onError(e) {
          errors.push(e)
        },
      },
    )
    expect(errors.map(e => e.code)).toEqual([
      DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
    ])
    expect(code).toMatchSnapshot()
  })
})
