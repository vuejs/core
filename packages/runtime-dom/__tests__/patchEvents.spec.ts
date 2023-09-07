import { patchProp } from '../src/patchProp'

const timeout = () => new Promise(r => setTimeout(r))

describe(`runtime-dom: events patching`, () => {
  it('should assign event handler', async () => {
    const el = document.createElement('div')
    const fn = vi.fn()
    patchProp(el, 'onClick', null, fn)
    el.dispatchEvent(new Event('click'))
    await timeout()
    el.dispatchEvent(new Event('click'))
    await timeout()
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should update event handler', async () => {
    const el = document.createElement('div')
    const prevFn = vi.fn()
    const nextFn = vi.fn()
    patchProp(el, 'onClick', null, prevFn)
    el.dispatchEvent(new Event('click'))
    patchProp(el, 'onClick', prevFn, nextFn)
    await timeout()
    el.dispatchEvent(new Event('click'))
    await timeout()
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(prevFn).toHaveBeenCalledTimes(1)
    expect(nextFn).toHaveBeenCalledTimes(2)
  })

  it('should support multiple event handlers', async () => {
    const el = document.createElement('div')
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    patchProp(el, 'onClick', null, [fn1, fn2])
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('should unassign event handler', async () => {
    const el = document.createElement('div')
    const fn = vi.fn()
    patchProp(el, 'onClick', null, fn)
    patchProp(el, 'onClick', fn, null)
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn).not.toHaveBeenCalled()
  })

  it('should support event option modifiers', async () => {
    const el = document.createElement('div')
    const fn = vi.fn()
    patchProp(el, 'onClickOnceCapture', null, fn)
    el.dispatchEvent(new Event('click'))
    await timeout()
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should unassign event handler with options', async () => {
    const el = document.createElement('div')
    const fn = vi.fn()
    patchProp(el, 'onClickCapture', null, fn)
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn).toHaveBeenCalledTimes(1)

    patchProp(el, 'onClickCapture', fn, null)
    el.dispatchEvent(new Event('click'))
    await timeout()
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should support native onclick', async () => {
    const el = document.createElement('div')

    // string should be set as attribute
    const fn = ((el as any).spy = vi.fn())
    patchProp(el, 'onclick', null, 'this.spy(1)')
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn).toHaveBeenCalledWith(1)

    const fn2 = vi.fn()
    patchProp(el, 'onclick', 'this.spy(1)', fn2)
    const event = new Event('click')
    el.dispatchEvent(event)
    await timeout()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(event)
  })

  it('should support stopImmediatePropagation on multiple listeners', async () => {
    const el = document.createElement('div')
    const fn1 = vi.fn((e: Event) => {
      e.stopImmediatePropagation()
    })
    const fn2 = vi.fn()
    patchProp(el, 'onClick', null, [fn1, fn2])
    el.dispatchEvent(new Event('click'))
    await timeout()
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(0)
  })

  // #1747
  it('should handle same computed handler function being bound on multiple targets', async () => {
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')

    // const event = new Event('click')
    const prevFn = vi.fn()
    const nextFn = vi.fn()

    patchProp(el1, 'onClick', null, prevFn)
    patchProp(el2, 'onClick', null, prevFn)

    el1.dispatchEvent(new Event('click'))
    el2.dispatchEvent(new Event('click'))
    await timeout()
    expect(prevFn).toHaveBeenCalledTimes(2)
    expect(nextFn).toHaveBeenCalledTimes(0)

    patchProp(el1, 'onClick', prevFn, nextFn)
    patchProp(el2, 'onClick', prevFn, nextFn)

    el1.dispatchEvent(new Event('click'))
    el2.dispatchEvent(new Event('click'))
    await timeout()
    expect(prevFn).toHaveBeenCalledTimes(2)
    expect(nextFn).toHaveBeenCalledTimes(2)

    el1.dispatchEvent(new Event('click'))
    el2.dispatchEvent(new Event('click'))
    await timeout()
    expect(prevFn).toHaveBeenCalledTimes(2)
    expect(nextFn).toHaveBeenCalledTimes(4)
  })

  // vuejs/vue#6566
  it('should not fire handler attached by the event itself', async () => {
    const el = document.createElement('div')
    const child = document.createElement('div')
    el.appendChild(child)
    document.body.appendChild(el)
    const childFn = vi.fn()
    const parentFn = vi.fn()

    patchProp(child, 'onClick', null, () => {
      childFn()
      patchProp(el, 'onClick', null, parentFn)
    })

    await timeout()
    child.dispatchEvent(new Event('click', { bubbles: true }))

    expect(childFn).toHaveBeenCalled()
    expect(parentFn).not.toHaveBeenCalled()
  })

  // #2841
  test('should patch event correctly in web-components', async () => {
    class TestElement extends HTMLElement {
      constructor() {
        super()
      }
    }
    window.customElements.define('test-element', TestElement)
    const testElement = document.createElement('test-element', {
      is: 'test-element',
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    // in webComponents, @foo-bar will patch prop 'onFooBar'
    // and @foobar will patch prop 'onFoobar'

    patchProp(testElement, 'onFooBar', null, fn1)
    testElement.dispatchEvent(new CustomEvent('foo-bar'))
    expect(fn1).toHaveBeenCalledTimes(1)

    patchProp(testElement, 'onFoobar', null, fn2)
    testElement.dispatchEvent(new CustomEvent('foobar'))
    expect(fn2).toHaveBeenCalledTimes(1)
  })
})
