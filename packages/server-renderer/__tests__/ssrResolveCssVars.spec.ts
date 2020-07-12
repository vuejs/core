import { ssrResolveCssVars } from '../src'

describe('ssr: resolveCssVars', () => {
  test('should work', () => {
    expect(ssrResolveCssVars({ color: 'red' })).toMatchObject({
      style: {
        '--color': 'red'
      }
    })
  })

  test('should work with scopeId', () => {
    expect(ssrResolveCssVars({ color: 'red' }, 'scoped')).toMatchObject({
      style: {
        '--scoped-color': 'red'
      }
    })
  })

  test('should strip data-v prefix', () => {
    expect(ssrResolveCssVars({ color: 'red' }, 'data-v-123456')).toMatchObject({
      style: {
        '--123456-color': 'red'
      }
    })
  })
})
