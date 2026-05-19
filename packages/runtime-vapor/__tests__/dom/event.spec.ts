import { effectScope, ref } from '@vue/reactivity'
import { BindingTypes } from '@vue/compiler-dom'
import { nextTick } from '@vue/runtime-dom'
import {
  defineVaporComponent,
  delegate,
  delegateEvents,
  on,
  onBinding,
  renderEffect,
  setDynamicEvents,
  template,
} from '../../src'
import { compileToVaporRender, makeRender } from '../_utils'

const define = makeRender<any>()

function renderWithElement(fn: (el: HTMLElement) => void): HTMLElement {
  const Comp = defineVaporComponent({
    setup() {
      const n0 = template('<div></div>', 1)() as HTMLElement
      fn(n0)
      return n0
    },
  })
  return define(Comp).render().host.children[0] as HTMLElement
}

describe('dom event', () => {
  delegateEvents('click')

  test('on', () => {
    const handler = vi.fn()
    const el = renderWithElement(el => {
      on(el, 'click', handler)
    })
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

  test('on keeps separate registrations for same handler with different options', () => {
    const handler = vi.fn()
    const el = renderWithElement(el => {
      on(el, 'click', handler, { once: true })
      on(el, 'click', handler, { passive: true })
    })
    el.click()
    expect(handler).toHaveBeenCalledTimes(2)
    el.click()
    expect(handler).toHaveBeenCalledTimes(3)
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
    const handler = vi.fn()
    const el = renderWithElement(el => {
      delegate(el, 'click', handler)
    })
    el.click()
    expect(handler).toHaveBeenCalled()
  })

  test('delegate with stopPropagation', () => {
    const parentHandler = vi.fn()
    const childHandler = vi.fn(e => e.stopPropagation())
    const parent = renderWithElement(parent => {
      const child = document.createElement('div')
      parent.appendChild(child)
      delegate(parent, 'click', parentHandler)
      delegate(child, 'click', childHandler)
    })
    const child = parent.firstChild as HTMLElement
    child.click()
    expect(parentHandler).not.toHaveBeenCalled()
    expect(childHandler).toHaveBeenCalled()
  })

  test('delegate with stopImmediatePropagation', () => {
    const parentHandler = vi.fn()
    const childHandler = vi.fn(e => e.stopImmediatePropagation())
    const parent = renderWithElement(parent => {
      const child = document.createElement('div')
      parent.appendChild(child)
      delegate(parent, 'click', parentHandler)
      delegate(child, 'click', childHandler)
    })
    const child = parent.firstChild as HTMLElement
    child.click()
    expect(parentHandler).not.toHaveBeenCalled()
    expect(childHandler).toHaveBeenCalled()
  })

  test('delegate with multiple handlers', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const el = renderWithElement(el => {
      delegate(el, 'click', handler1)
      delegate(el, 'click', handler2)
    })
    el.click()
    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  test('delegate with multiple handlers + stopImmediatePropagation', () => {
    const handler1 = vi.fn(e => e.stopImmediatePropagation())
    const handler2 = vi.fn()
    const el = renderWithElement(el => {
      delegate(el, 'click', handler1)
      delegate(el, 'click', handler2)
    })
    el.click()
    expect(handler1).toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })

  test('setDynamicEvents', () => {
    const handler = vi.fn()
    const Comp = defineVaporComponent({
      setup() {
        const el = template('<div></div>', 1)() as HTMLElement
        renderEffect(() => {
          setDynamicEvents(el, {
            click: handler,
          })
        })
        return el
      },
    })
    const { host, app } = define(Comp).render()
    const el = host.children[0] as HTMLElement
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
    app.unmount()
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

  test('on with effect cleanup removes wrapped invoker', () => {
    const handler = vi.fn()
    const Comp = defineVaporComponent({
      setup() {
        const el = template('<div></div>', 1)() as HTMLElement
        renderEffect(() => {
          onBinding(el, 'click', handler)
        })
        return el
      },
    })
    const { host, app } = define(Comp).render()
    const el = host.children[0] as HTMLElement
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
    app.unmount()
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('on with array handler cleans up every wrapped invoker', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const Comp = defineVaporComponent({
      setup() {
        const el = template('<div></div>', 1)() as HTMLElement
        renderEffect(() => {
          onBinding(el, 'click', [handler1, handler2])
        })
        return el
      },
    })
    const { host, app } = define(Comp).render()
    const el = host.children[0] as HTMLElement
    el.click()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    app.unmount()
    el.click()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  test('setDynamicEvents replaces old wrapped invokers on update', async () => {
    const event = ref('click')
    const handler = ref(vi.fn())
    const handler1 = handler.value
    const handler2 = vi.fn()
    const Comp = defineVaporComponent({
      setup() {
        const el = template('<div></div>', 1)() as HTMLElement
        renderEffect(() => {
          setDynamicEvents(el, {
            [event.value]: handler.value,
          })
        })
        return el
      },
    })
    const { host, app } = define(Comp).render()
    const el = host.children[0] as HTMLElement

    el.click()
    expect(handler1).toHaveBeenCalledTimes(1)

    handler.value = handler2
    await nextTick()
    el.click()
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)

    event.value = 'mouseup'
    await nextTick()
    el.click()
    expect(handler2).toHaveBeenCalledTimes(1)
    el.dispatchEvent(new MouseEvent('mouseup'))
    expect(handler2).toHaveBeenCalledTimes(2)

    app.unmount()
    el.dispatchEvent(new MouseEvent('mouseup'))
    expect(handler2).toHaveBeenCalledTimes(2)
  })

  test('compiled direct key and non-key modifiers use vapor guard helpers', () => {
    const onKeyup = vi.fn()
    const Comp = defineVaporComponent({
      setup() {
        return { onKeyup }
      },
      render: compileToVaporRender(`<input @keyup.self.enter="onKeyup" />`, {
        bindingMetadata: {
          onKeyup: BindingTypes.SETUP_CONST,
        },
      }),
    })
    const { host } = define(Comp).render()
    const input = host.children[0] as HTMLElement

    input.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }),
    )
    expect(onKeyup).not.toHaveBeenCalled()

    input.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
    )
    expect(onKeyup).toHaveBeenCalledTimes(1)
  })

  test('compiled direct missing handlers do not throw during render', () => {
    const Comp = defineVaporComponent({
      render: compileToVaporRender(
        `<button @click="missing" /><button @click.self="missing" /><input @keyup.enter="missing" /><input @keyup.self.enter="missing" />`,
        {
          bindingMetadata: {
            missing: BindingTypes.SETUP_CONST,
          },
        },
      ),
    })
    const { host } = define(Comp).render()
    const buttons = host.querySelectorAll('button')
    const inputs = host.querySelectorAll('input')

    ;(buttons[0] as HTMLButtonElement).click()
    ;(buttons[1] as HTMLButtonElement).click()
    ;(inputs[0] as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
    )
    ;(inputs[1] as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
    )
    expect(`Property "missing" was accessed during render`).toHaveBeenWarned()
    expect(
      `Invalid value type passed to callWithAsyncErrorHandling(): undefined`,
    ).toHaveBeenWarned()
  })
})
