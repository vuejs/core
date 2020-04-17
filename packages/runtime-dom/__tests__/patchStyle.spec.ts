import { patchProp } from '../src/patchProp'

describe(`runtime-dom: style patching`, () => {
  it('string', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, 'color:red')
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')
  })

  it('plain object', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, { color: 'red' })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')
  })

  it('camelCase', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, { marginRight: '10px' })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('margin-right:10px;')
  })

  it('remove if falsy value', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', { color: 'red' }, { color: undefined })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('')
  })

  it('!important', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, { color: 'red !important' })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red!important;')
  })

  it('camelCase with !important', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, { marginRight: '10px !important' })
    expect(el.style.cssText.replace(/\s/g, '')).toBe(
      'margin-right:10px!important;'
    )
  })

  it('object with multiple entries', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, { color: 'red', marginRight: '10px' })
    expect(el.style.getPropertyValue('color')).toBe('red')
    expect(el.style.getPropertyValue('margin-right')).toBe('10px')
  })

  // JSDOM doesn't support custom properties on style object so we have to
  // mock it here.
  function mockElementWithStyle() {
    const store: any = {}
    return {
      style: {
        WebkitTransition: '',
        setProperty(key: string, val: string) {
          store[key] = val
        },
        getPropertyValue(key: string) {
          return store[key]
        }
      }
    }
  }

  it('CSS custom properties', () => {
    const el = mockElementWithStyle()
    patchProp(el as any, 'style', {}, { '--theme': 'red' } as any)
    expect(el.style.getPropertyValue('--theme')).toBe('red')
  })

  it('auto vendor prefixing', () => {
    const el = mockElementWithStyle()
    patchProp(el as any, 'style', {}, { transition: 'all 1s' })
    expect(el.style.WebkitTransition).toBe('all 1s')
  })
})
