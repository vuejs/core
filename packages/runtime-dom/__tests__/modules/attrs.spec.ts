import { patchAttr, xlinkNS } from '../../src/modules/attrs'

describe('attrs', () => {
  test('xlink attributes', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    patchAttr(el, 'xlink:href', 'a', true)
    expect(el.getAttributeNS(xlinkNS, 'href')).toBe('a')
    patchAttr(el, 'xlink:href', null, true)
    expect(el.getAttributeNS(xlinkNS, 'href')).toBe(null)
  })

  test('boolean attributes', () => {
    const el = document.createElement('input')
    patchAttr(el, 'readonly', true, false)
    expect(el.getAttribute('readonly')).toBe('')
    patchAttr(el, 'readonly', false, false)
    expect(el.getAttribute('readonly')).toBe(null)
  })

  test('attributes', () => {
    const el = document.createElement('div')
    patchAttr(el, 'id', 'a', false)
    expect(el.getAttribute('id')).toBe('a')
    patchAttr(el, 'id', null, false)
    expect(el.getAttribute('id')).toBe(null)
  })
})
