import { patchEvent } from '../../src/modules/events'

const timeout = () => new Promise(r => setTimeout(r))

describe(`events`, () => {
  it('should assign event handler', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = jest.fn()
    patchEvent(el, 'onClick', null, fn, null)
    el.dispatchEvent(event)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should update event handler', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const prevFn = jest.fn()
    const nextFn = jest.fn()
    patchEvent(el, 'onClick', null, prevFn, null)
    el.dispatchEvent(event)
    patchEvent(el, 'onClick', prevFn, nextFn, null)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
    expect(prevFn).toHaveBeenCalledTimes(1)
    expect(nextFn).toHaveBeenCalledTimes(2)
  })

  it('should support multiple event handlers', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    patchEvent(el, 'onClick', null, [fn1, fn2], null)
    el.dispatchEvent(event)
    await timeout()
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('should unassign event handler', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = jest.fn()
    patchEvent(el, 'onClick', null, fn, null)
    patchEvent(el, 'onClick', fn, null, null)
    el.dispatchEvent(event)
    await timeout()
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
    patchEvent(el, 'onClick', null, nextValue, null)
    el.dispatchEvent(event)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
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
    patchEvent(el, 'onClick', null, prevFn, null)
    patchEvent(el, 'onClick', prevFn, nextValue, null)
    el.dispatchEvent(event)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
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
    patchEvent(el, 'onClick', null, nextValue, null)
    patchEvent(el, 'onClick', nextValue, null, null)
    el.dispatchEvent(event)
    await timeout()
    el.dispatchEvent(event)
    await timeout()
    expect(fn).not.toHaveBeenCalled()
  })

  it('should assign native onclick attribute', async () => {
    const el = document.createElement('div')
    const event = new Event('click')
    const fn = ((window as any)._nativeClickSpy = jest.fn())

    patchEvent(el, 'onclick', null, '_nativeClickSpy()' as any)
    el.dispatchEvent(event)
    await timeout()
    expect(fn).toHaveBeenCalledTimes(1)

    const fn2 = jest.fn()
    patchEvent(el, 'onclick', null, fn2)
    el.dispatchEvent(event)
    await timeout()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })
})
