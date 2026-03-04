import { effectScope } from '@vue/reactivity'
import {
  delegate,
  delegateEvents,
  on,
  renderEffect,
  setDynamicEvents,
} from '../../src'

describe('dom event', () => {
  delegateEvents('click')

  test('on', () => {
    const el = document.createElement('div')
    const handler = vi.fn()
    on(el, 'click', handler)
    el.click()
    expect(handler).toHaveBeenCalled()
  })

  test('delegate with direct attachment', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const handler = vi.fn()
    ;(el as any).$evtclick = handler
    el.click()
    expect(handler).toHaveBeenCalled()
  })

  test('delegate', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const handler = vi.fn()
    delegate(el, 'click', handler)
    el.click()
    expect(handler).toHaveBeenCalled()
  })

  test('delegate with stopPropagation', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')
    parent.appendChild(child)
    document.body.appendChild(parent)
    const parentHandler = vi.fn()
    delegate(parent, 'click', parentHandler)
    const childHandler = vi.fn(e => e.stopPropagation())
    delegate(child, 'click', childHandler)
    child.click()
    expect(parentHandler).not.toHaveBeenCalled()
    expect(childHandler).toHaveBeenCalled()
  })

  test('delegate with stopImmediatePropagation', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')
    parent.appendChild(child)
    document.body.appendChild(parent)
    const parentHandler = vi.fn()
    delegate(parent, 'click', parentHandler)
    const childHandler = vi.fn(e => e.stopImmediatePropagation())
    delegate(child, 'click', childHandler)
    child.click()
    expect(parentHandler).not.toHaveBeenCalled()
    expect(childHandler).toHaveBeenCalled()
  })

  test('delegate with multiple handlers', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    delegate(el, 'click', handler1)
    delegate(el, 'click', handler2)
    el.click()
    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  test('delegate with multiple handlers + stopImmediatePropagation', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const handler1 = vi.fn(e => e.stopImmediatePropagation())
    const handler2 = vi.fn()
    delegate(el, 'click', handler1)
    delegate(el, 'click', handler2)
    el.click()
    expect(handler1).toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })

  test('setDynamicEvents', () => {
    const el = document.createElement('div')
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      renderEffect(() => {
        setDynamicEvents(el, {
          click: handler,
        })
      })
    })
    el.click()
    expect(handler).toHaveBeenCalled()
    scope.stop()
  })
})
