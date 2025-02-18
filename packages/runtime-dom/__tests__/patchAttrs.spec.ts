import { patchProp } from '../src/patchProp'
import { xlinkNS } from '../src/modules/attrs'

describe('runtime-dom: attrs patching', () => {
  test('xlink attributes', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    patchProp(el, 'xlink:href', null, 'a', 'svg')
    expect(el.getAttributeNS(xlinkNS, 'href')).toBe('a')
    patchProp(el, 'xlink:href', 'a', null, 'svg')
    expect(el.getAttributeNS(xlinkNS, 'href')).toBe(null)
  })

  test('textContent attributes /w svg', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    patchProp(el, 'textContent', null, 'foo', 'svg')
    expect(el.attributes.length).toBe(0)
    expect(el.innerHTML).toBe('foo')
  })

  test('boolean attributes', () => {
    const el = document.createElement('input')
    patchProp(el, 'readonly', null, true)
    expect(el.getAttribute('readonly')).toBe('')
    patchProp(el, 'readonly', true, false)
    expect(el.getAttribute('readonly')).toBe(null)
    patchProp(el, 'readonly', false, '')
    expect(el.getAttribute('readonly')).toBe('')
    patchProp(el, 'readonly', '', 0)
    expect(el.getAttribute('readonly')).toBe(null)
    patchProp(el, 'readonly', 0, '0')
    expect(el.getAttribute('readonly')).toBe('')
    patchProp(el, 'readonly', '0', false)
    expect(el.getAttribute('readonly')).toBe(null)
    patchProp(el, 'readonly', false, 1)
    expect(el.getAttribute('readonly')).toBe('')
    patchProp(el, 'readonly', 1, undefined)
    expect(el.getAttribute('readonly')).toBe(null)
  })

  test('attributes', () => {
    const el = document.createElement('div')
    patchProp(el, 'foo', null, 'a')
    expect(el.getAttribute('foo')).toBe('a')
    patchProp(el, 'foo', 'a', null)
    expect(el.getAttribute('foo')).toBe(null)
  })

  // #949
  test('onxxx but non-listener attributes', () => {
    const el = document.createElement('div')
    patchProp(el, 'onwards', null, 'a')
    expect(el.getAttribute('onwards')).toBe('a')
    patchProp(el, 'onwards', 'a', null)
    expect(el.getAttribute('onwards')).toBe(null)
  })

  // #10597
  test('should allow setting attribute to symbol', () => {
    const el = document.createElement('div')
    const symbol = Symbol('foo')
    patchProp(el, 'foo', null, symbol)
    expect(el.getAttribute('foo')).toBe(symbol.toString())
  })

  // #10598
  test('should allow setting value to symbol', () => {
    const el = document.createElement('input')
    const symbol = Symbol('foo')
    patchProp(el, 'value', null, symbol)
    expect(el.value).toBe(symbol.toString())
  })

  // #11177
  test('should allow setting value to object, leaving stringification to the element/browser', () => {
    // normal behavior
    const el = document.createElement('div')
    const obj = { toString: () => 'foo' }
    patchProp(el, 'data-test', null, obj)
    expect(el.dataset.test).toBe('foo')

    const el2 = document.createElement('div')
    let testvalue: null | typeof obj = null
    // simulating a web component that implements its own setAttribute handler
    el2.setAttribute = (name, value) => {
      testvalue = value
    }
    patchProp(el2, 'data-test', null, obj)
    expect(el2.dataset.test).toBe(undefined)
    expect(testvalue).toBe(obj)
  })
})
