import { effectScope, ref } from '@vue/reactivity'
import { nextTick } from '@vue/runtime-dom'
import {
  delegate,
  delegateEvents,
  on,
  onBinding,
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

  test('onBinding', () => {
    const el = document.createElement('div')
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      renderEffect(() => {
        onBinding(el, 'click', handler)
      })
    })
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
    scope.stop()
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('onBinding cleans previous listener on update', async () => {
    const el = document.createElement('div')
    const event = ref('click')
    const clickHandler = vi.fn()
    const mouseupHandler = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      renderEffect(() => {
        onBinding(
          el,
          event.value,
          event.value === 'click' ? clickHandler : mouseupHandler,
        )
      })
    })

    el.click()
    expect(clickHandler).toHaveBeenCalledTimes(1)
    expect(mouseupHandler).not.toHaveBeenCalled()

    event.value = 'mouseup'
    await nextTick()

    el.click()
    expect(clickHandler).toHaveBeenCalledTimes(1)

    el.dispatchEvent(new MouseEvent('mouseup'))
    expect(mouseupHandler).toHaveBeenCalledTimes(1)

    scope.stop()
    el.dispatchEvent(new MouseEvent('mouseup'))
    expect(mouseupHandler).toHaveBeenCalledTimes(1)
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
    expect(handler).toHaveBeenCalledTimes(1)
    scope.stop()
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('setDynamicEvents with multiple handlers', () => {
    const el = document.createElement('div')
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      renderEffect(() => {
        setDynamicEvents(el, {
          click: [handler1, handler2],
        })
      })
    })

    el.click()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)

    scope.stop()
    el.click()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  test('setDynamicEvents accepts narrowed event handlers', () => {
    const el = document.createElement('div')
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      renderEffect(() => {
        setDynamicEvents(el, {
          click: (e: MouseEvent) => handler(e.clientX),
        })
      })
    })

    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
