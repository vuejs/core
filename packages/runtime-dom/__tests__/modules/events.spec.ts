import { patchEvent } from '../../src/modules/events'
import { nextTick } from '@vue/runtime-dom'

describe(`events`, () => {
  it('should assign event handler', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = jest.fn()
    patchEvent(el, 'click', null, fn, null)
    el.dispatchEvent(event)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should update event handler', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const prevFn = jest.fn()
    const nextFn = jest.fn()
    patchEvent(el, 'click', null, prevFn, null)
    el.dispatchEvent(event)
    patchEvent(el, 'click', prevFn, nextFn, null)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    expect(prevFn).toHaveBeenCalledTimes(1)
    expect(nextFn).toHaveBeenCalledTimes(2)
  })

  it('should support multiple event handlers', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    patchEvent(el, 'click', null, [fn1, fn2], null)
    el.dispatchEvent(event)
    await nextTick()
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('should unassign event handler', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = jest.fn()
    patchEvent(el, 'click', null, fn, null)
    patchEvent(el, 'click', fn, null, null)
    el.dispatchEvent(event)
    await nextTick()
    expect(fn).not.toHaveBeenCalled()
  })

  it('should support event options', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = jest.fn()
    const nextValue = {
      handler: fn,
      options: {
        once: true
      }
    }
    patchEvent(el, 'click', null, nextValue, null)
    el.dispatchEvent(event)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should support varying event options', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const prevFn = jest.fn()
    const nextFn = jest.fn()
    const nextValue = {
      handler: nextFn,
      options: {
        once: true
      }
    }
    patchEvent(el, 'click', null, prevFn, null)
    patchEvent(el, 'click', prevFn, nextValue, null)
    el.dispatchEvent(event)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    expect(prevFn).not.toHaveBeenCalled()
    expect(nextFn).toHaveBeenCalledTimes(1)
  })

  it('should unassign event handler with options', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = jest.fn()
    const nextValue = {
      handler: fn,
      options: {
        once: true
      }
    }
    patchEvent(el, 'click', null, nextValue, null)
    patchEvent(el, 'click', nextValue, null, null)
    el.dispatchEvent(event)
    await nextTick()
    el.dispatchEvent(event)
    await nextTick()
    expect(fn).not.toHaveBeenCalled()
  })
})
