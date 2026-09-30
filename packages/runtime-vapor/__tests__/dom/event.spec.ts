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
import { compileToVaporRender, makeRender, renderParity } from '../_utils'

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

  test('delegate skips disabled direct handlers', () => {
    const handler = vi.fn()

    const Comp = defineVaporComponent({
      setup() {
        const button = template('<button disabled></button>')() as any
        button.$evtclick = handler
        return button
      },
    })

    const { host } = define(Comp).render()
    const button = host.querySelector('button')!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handler).not.toHaveBeenCalled()
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

  test('compiled direct key and non-key modifiers', () => {
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

  test('compiled delegated missing handlers do not throw during render', () => {
    const Comp = defineVaporComponent({
      render: compileToVaporRender(
        `<button @click.delegate="missing" /><button @click.delegate.self="missing" /><input @keyup.delegate.enter="missing" /><input @keyup.delegate.self.enter="missing" />`,
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

  test('compiled child handlers run before parent .stop handlers', () => {
    const calls: string[] = []
    const parent = () => calls.push('parent')
    const child = () => calls.push('child')
    const Comp = defineVaporComponent({
      setup() {
        return { parent, child }
      },
      render: compileToVaporRender(
        `<div @click.stop="parent"><button @click="child" /></div>`,
        {
          bindingMetadata: {
            parent: BindingTypes.SETUP_CONST,
            child: BindingTypes.SETUP_CONST,
          },
        },
      ),
    })
    const { host } = define(Comp).render()

    host.querySelector('button')!.click()

    expect(calls).toEqual(['child', 'parent'])
  })

  test('does not rebind a once handler in dynamic props after firing', async () => {
    const hits = ref(0)
    const onOnce = () => hits.value++
    const Comp = defineVaporComponent({
      setup() {
        return { hits, onOnce }
      },
      render: compileToVaporRender(
        `<button v-bind="{ onClickOnce: onOnce }" /><p>{{ hits }}</p>`,
        {
          bindingMetadata: {
            hits: BindingTypes.SETUP_REF,
            onOnce: BindingTypes.SETUP_CONST,
          },
        },
      ),
    })
    const { host } = define(Comp).render()
    const button = host.querySelector('button')!

    button.click()
    await nextTick()
    button.click()

    expect(hits.value).toBe(1)
  })

  test('does not rebind a once handler in a v-on object after firing', async () => {
    const hits = ref(0)
    const onOnce = () => hits.value++
    const Comp = defineVaporComponent({
      setup() {
        return { hits, onOnce }
      },
      render: compileToVaporRender(
        `<button v-on="{ clickOnce: onOnce }">v-on object once listener</button><p>{{ hits }}</p>`,
        {
          bindingMetadata: {
            hits: BindingTypes.SETUP_REF,
            onOnce: BindingTypes.SETUP_CONST,
          },
        },
      ),
    })
    const { host } = define(Comp).render()
    const button = host.querySelector('button')!

    button.click()
    await nextTick()
    button.click()

    expect(hits.value).toBe(1)
  })

  describe('on* bindings of native elements', () => {
    const fire = (root: HTMLElement, id: string, type = 'click') =>
      root.querySelector(`#${id}`)!.dispatchEvent(new Event(type))

    test('binds listeners like vdom', async () => {
      const logs: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          App: `<template>
            <button id="a" :onClick="data.fn"></button>
            <button id="b" :onClickOnce="data.fn"></button>
            <svg id="c" :onClick="data.fn"></svg>
            <div id="d" :onMyEvent="data.fn"></div>
            <div id="e" :onUpdate:modelValue="data.fn"></div>
            <button id="f" v-once :onClick="data.fn"></button>
          </template>`,
        },
        () => {
          const log: string[] = []
          return ref({
            log,
            fn: (e: Event) => log.push(`fn:${e.type}`),
            swapped: () => log.push('swapped'),
          })
        },
        async (data, root, mode) => {
          fire(root, 'a')
          fire(root, 'b')
          fire(root, 'b')
          fire(root, 'c')
          fire(root, 'd', 'my-event')
          fire(root, 'f')
          data.value.fn = data.value.swapped
          await nextTick()
          fire(root, 'a')
          fire(root, 'f')
          logs[mode] = data.value.log
        },
      )
      expect(logs.vdom).toEqual([
        'fn:click',
        'fn:click',
        'fn:click',
        'fn:my-event',
        'fn:click',
        'swapped',
        'fn:click',
      ])
      expect(logs.vapor).toEqual(logs.vdom)
      expect(vapor.after).toBe(vdom.after)
    })

    test('uses the bound value as the handler like vdom', async () => {
      const logs: Record<string, string[]> = {}
      const errors: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          App: `<template>
            <button id="a" :onClick="data.enabled ? data.save : data.cancel"></button>
            <button id="b" :onClick="[data.save, data.cancel]"></button>
            <button id="c" :onClick="data.pair"></button>
            <button id="d" :onClick="data.create('created')"></button>
            <button id="e" :onClick="data.maybe"></button>
          </template>`,
        },
        () => {
          const log: string[] = []
          const save = () => log.push('save')
          const cancel = () => log.push('cancel')
          return ref({
            log,
            enabled: true,
            save,
            cancel,
            pair: [save, cancel],
            create: (msg: string) => () => log.push(msg),
            maybe: null as null | (() => void),
          })
        },
        async (data, root, mode) => {
          // jsdom reports a throwing listener on window instead of at dispatch
          errors[mode] = []
          const onError = (e: ErrorEvent) => {
            errors[mode].push(e.message)
            e.preventDefault()
          }
          window.addEventListener('error', onError)
          for (const id of ['a', 'b', 'c', 'd', 'e']) fire(root, id)
          data.value.enabled = false
          data.value.maybe = () => data.value.log.push('maybe')
          await nextTick()
          fire(root, 'a')
          fire(root, 'e')
          data.value.maybe = null
          await nextTick()
          fire(root, 'e')
          window.removeEventListener('error', onError)
          logs[mode] = data.value.log
        },
      )
      expect(logs.vdom).toEqual([
        'save',
        'save',
        'cancel',
        'save',
        'cancel',
        'created',
        'cancel',
        'maybe',
      ])
      expect(errors.vdom).toEqual([])
      expect(logs.vapor).toEqual(logs.vdom)
      expect(errors.vapor).toEqual([])
      expect(vapor.after).toBe(vdom.after)
    })

    test('re-adds a once listener after it was removed', async () => {
      const logs: Record<string, string[]> = {}
      await renderParity(
        {
          App: `<template><button v-bind="data.listeners">click</button></template>`,
        },
        () => {
          const log: string[] = []
          return ref({
            log,
            listeners: { onClickOnce: () => log.push('first') },
          })
        },
        async (data, root, mode) => {
          const button = root.querySelector('button')!
          button.click()
          data.value.listeners = {}
          await nextTick()
          data.value.listeners = {
            onClickOnce: () => data.value.log.push('second'),
          }
          await nextTick()
          button.click()
          logs[mode] = data.value.log
        },
      )

      expect(logs.vdom).toEqual(['first', 'second'])
      expect(logs.vapor).toEqual(logs.vdom)
    })

    test('merges with spread and fallthrough listeners like vdom', async () => {
      const logs: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child: `<template><button :onClick="data.own"></button></template>`,
          App: `<template>
            <button id="a" v-bind="{ onClick: data.save }" :onClick="data.save"></button>
            <button id="b" v-bind="{ onClick: data.save }" :onClick="data.own"></button>
            <button id="c" :onClick="data.own" v-bind="{ onClick: data.save }"></button>
            <components.Child id="d" @click="data.save" />
          </template>`,
        },
        () => {
          const log: string[] = []
          return ref({
            log,
            save: () => log.push('save'),
            own: () => log.push('own'),
          })
        },
        (data, root, mode) => {
          for (const id of ['a', 'b', 'c', 'd']) fire(root, id)
          logs[mode] = data.value.log
        },
      )
      // the same function bound twice runs once
      expect(logs.vdom).toEqual([
        'save',
        'save',
        'own',
        'own',
        'save',
        'own',
        'save',
      ])
      expect(logs.vapor).toEqual(logs.vdom)
      expect(vapor.after).toBe(vdom.after)
    })
  })
})
