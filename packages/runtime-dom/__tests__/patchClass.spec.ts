import { patchProp } from '../src/patchProp'
import {
  type ElementWithTransition,
  vtcKey,
} from '../src/components/Transition'
import { svgNS } from '../src/nodeOps'

describe('runtime-dom: class patching', () => {
  test('basics', () => {
    const el = document.createElement('div')
    patchProp(el, 'class', null, 'foo')
    expect(el.className).toBe('foo')
    patchProp(el, 'class', null, null)
    expect(el.className).toBe('')
  })

  test('transition class', () => {
    const el = document.createElement('div') as ElementWithTransition
    el[vtcKey] = new Set(['bar', 'baz'])
    patchProp(el, 'class', null, 'foo')
    expect(el.className).toBe('foo bar baz')
    patchProp(el, 'class', null, null)
    expect(el.className).toBe('bar baz')
    delete el[vtcKey]
    patchProp(el, 'class', null, 'foo')
    expect(el.className).toBe('foo')
  })

  test('svg', () => {
    const el = document.createElementNS(svgNS, 'svg')
    patchProp(el, 'class', null, 'foo', 'svg')
    expect(el.getAttribute('class')).toBe('foo')
  })
})
