import { patchProp } from '../src/patchProp'
import { render, h } from '../src'

describe('runtime-dom: props patching', () => {
  test('basic', () => {
    const el = document.createElement('div')
    patchProp(el, 'id', null, 'foo')
    expect(el.id).toBe('foo')
    patchProp(el, 'id', null, null)
    expect(el.id).toBe('')
  })

  test('value', () => {
    const el = document.createElement('input')
    patchProp(el, 'value', null, 'foo')
    expect(el.value).toBe('foo')
    patchProp(el, 'value', null, null)
    expect(el.value).toBe('')
    const obj = {}
    patchProp(el, 'value', null, obj)
    expect(el.value).toBe(obj.toString())
    expect((el as any)._value).toBe(obj)
  })

  test('boolean prop', () => {
    const el = document.createElement('select')
    patchProp(el, 'multiple', null, '')
    expect(el.multiple).toBe(true)
    patchProp(el, 'multiple', null, null)
    expect(el.multiple).toBe(false)
  })

  test('innerHTML unmount prev children', () => {
    const fn = jest.fn()
    const comp = {
      render: () => 'foo',
      unmounted: fn
    }
    const root = document.createElement('div')
    render(h('div', null, [h(comp)]), root)
    expect(root.innerHTML).toBe(`<div>foo</div>`)

    render(h('div', { innerHTML: 'bar' }), root)
    expect(root.innerHTML).toBe(`<div>bar</div>`)
    expect(fn).toHaveBeenCalled()
  })

  // #954
  test('(svg) innerHTML unmount prev children', () => {
    const fn = jest.fn()
    const comp = {
      render: () => 'foo',
      unmounted: fn
    }
    const root = document.createElement('div')
    render(h('div', null, [h(comp)]), root)
    expect(root.innerHTML).toBe(`<div>foo</div>`)

    render(h('svg', { innerHTML: '<g></g>' }), root)
    expect(root.innerHTML).toBe(`<svg><g></g></svg>`)
    expect(fn).toHaveBeenCalled()
  })

  test('textContent unmount prev children', () => {
    const fn = jest.fn()
    const comp = {
      render: () => 'foo',
      unmounted: fn
    }
    const root = document.createElement('div')
    render(h('div', null, [h(comp)]), root)
    expect(root.innerHTML).toBe(`<div>foo</div>`)

    render(h('div', { textContent: 'bar' }), root)
    expect(root.innerHTML).toBe(`<div>bar</div>`)
    expect(fn).toHaveBeenCalled()
  })

  // #1049
  test('set domProps where string is not accepted', () => {
    const realCreateElement = document.createElement.bind(document)
    const spyCreateElement = jest
      .spyOn(document, 'createElement')
      .mockImplementation(tagName => {
        const el = realCreateElement(tagName)
        let srcObject: any = undefined
        Object.defineProperty(el, 'srcObject', {
          enumerable: true,
          set(v) {
            if (typeof v === 'string') {
              throw new TypeError(
                `Failed to set the 'srcObject' property on 'HTMLMediaElement'`
              )
            }
            srcObject = v
          },
          get() {
            return srcObject
          }
        })
        return el
      })

    const el = document.createElement('video')

    patchProp(el, 'srcObject', undefined, null)

    expect(el.srcObject).toBeNull()
    spyCreateElement.mockRestore()
  })
})
