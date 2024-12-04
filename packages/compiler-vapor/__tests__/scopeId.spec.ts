import { compile } from '../src/compile'

describe('scopeId compiler support', () => {
  test('should only work in module mode', () => {
    expect(() => {
      compile(``, { scopeId: 'test' })
    }).toThrow(`"scopeId" option is only supported in module mode`)
  })
})
