import { patchProp } from '../src/patchProp'
import { xlinkNS } from '../src/modules/attrs'

describe('runtime-dom: attrs patching', () => {
  test('xlink attributes', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    patchProp(el, 'xlink:href', null, 'a', true)
    expect(el.getAttributeNS(xlinkNS, 'href')).toBe('a')
    patchProp(el, 'xlink:href', 'a', null, true)
    expect(el.getAttributeNS(xlinkNS, 'href')).toBe(null)
  })

  test('textContent attributes /w svg', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    patchProp(el, 'textContent', null, 'foo', true)
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

  test('camelCase attribute name properly hyphenated', () => {
    const el = document.createElement('div')
    patchProp(el, 'customAttribute', null, 'a')
    expect(el.getAttribute('custom-attribute')).toBe('a')
    patchProp(el, 'custom-attribute', 'a', null)
    expect(el.getAttribute('custom-attribute')).toBe(null)
  })
})
