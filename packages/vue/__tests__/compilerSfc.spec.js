import loadTS from '../compiler-sfc/load-ts.js'

describe('compiler-sfc TypeScript loading', () => {
  test('uses the installed classic API', () => {
    const ts = { resolveModuleName() {} }
    const load = vi.fn(id => {
      if (id === 'typescript') return ts
      throw new Error(`unexpected module: ${id}`)
    })

    expect(loadTS(load)).toBe(ts)
    expect(load).toHaveBeenCalledOnce()
  })

  test('falls back to the compatibility package for TypeScript 7', () => {
    const ts7 = { version: '7.0.2', versionMajorMinor: '7.0' }
    const ts6 = { resolveModuleName() {} }
    const load = vi.fn(id => (id === 'typescript' ? ts7 : ts6))

    expect(loadTS(load)).toBe(ts6)
    expect(load).toHaveBeenNthCalledWith(2, '@typescript/typescript6')
  })
})
