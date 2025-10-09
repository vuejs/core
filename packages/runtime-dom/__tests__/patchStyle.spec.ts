import { patchProp } from '../src/patchProp'

describe(`runtime-dom: style patching`, () => {
  it('string', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, 'color:red')
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')
  })

  // #1309
  it('should not patch same string style', () => {
    const el = document.createElement('div')
    const fn = vi.fn()
    const value = (el.style.cssText = 'color:red;')
    Object.defineProperty(el.style, 'cssText', {
      get(): any {
        return value
      },
      set: fn,
    })
    patchProp(el, 'style', value, value)
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')
    expect(fn).not.toBeCalled()
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
    patchProp(el, 'style', null, {
      color: undefined,
      borderRadius: null,
    })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('')

    patchProp(
      el,
      'style',
      { color: 'red' },
      { color: null, borderRadius: undefined },
    )
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
      'margin-right:10px!important;',
    )
  })

  it('object with multiple entries', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, { color: 'red', marginRight: '10px' })
    expect(el.style.getPropertyValue('color')).toBe('red')
    expect(el.style.getPropertyValue('margin-right')).toBe('10px')
  })

  it('patch with falsy style value', () => {
    const el = document.createElement('div')
    patchProp(el as any, 'style', { width: '100px' }, { width: 0 })
    expect(el.style.width).toBe('0px')
  })

  it('multiple patch with boolean style value', () => {
    const el = document.createElement('div')
    const styleA = {
      left: 0,
      right: true,
      top: 0,
      bottom: true,
    }
    patchProp(el as any, 'style', null, styleA)
    expect(el.style.left).toBe('0px')
    expect(el.style.right).toBe('')
    expect(el.style.top).toBe('0px')
    expect(el.style.bottom).toBe('')
    const styleB = {
      left: true,
      right: 0,
      top: true,
      bottom: 0,
    }
    patchProp(el as any, 'style', styleA, styleB)
    expect(el.style.left).toBe('')
    expect(el.style.right).toBe('0px')
    expect(el.style.top).toBe('')
    expect(el.style.bottom).toBe('0px')
  })

  it('should remove style attribute on falsy value', () => {
    const el = document.createElement('div')
    el.style.cssText = 'color: red;'
    patchProp(el as any, 'style', {}, null)
    expect(el.hasAttribute('style')).toBe(false)
    expect(el.style.cssText).toBe('')
  })

  it('should warn for trailing semicolons', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', null, { color: 'red;' })
    expect(
      `Unexpected semicolon at the end of 'color' style value: 'red;'`,
    ).toHaveBeenWarned()

    patchProp(el, 'style', null, { '--custom': '100; ' })
    expect(
      `Unexpected semicolon at the end of '--custom' style value: '100; '`,
    ).toHaveBeenWarned()
  })

  it('should not warn for escaped trailing semicolons', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', null, { '--custom': '100\\;' })
    expect(el.style.getPropertyValue('--custom')).toBe('100\\;')
  })

  it('shorthand properties', () => {
    const el = document.createElement('div')
    patchProp(
      el as any,
      'style',
      { borderBottom: '1px solid red' },
      { border: '1px solid green' },
    )
    expect(el.style.border).toBe('1px solid green')
    expect(el.style.borderBottom).toBe('1px solid green')
  })

  // JSDOM doesn't support custom properties on style object so we have to
  // mock it here.
  function mockElementWithStyle() {
    const store: any = {}
    return {
      style: {
        display: '',
        WebkitTransition: '',
        setProperty(key: string, val: string) {
          store[key] = val
        },
        getPropertyValue(key: string) {
          return store[key]
        },
      },
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

  it('multiple values', () => {
    const el = mockElementWithStyle()
    patchProp(
      el as any,
      'style',
      {},
      { display: ['-webkit-box', '-ms-flexbox', 'flex'] },
    )
    expect(el.style.display).toBe('flex')
  })

  it('should clear previous css string value', () => {
    const el = document.createElement('div')
    patchProp(el, 'style', {}, 'color:red')
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')

    patchProp(el, 'style', 'color:red', { fontSize: '12px' })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('font-size:12px;')
  })
})
