import { effectScope, ref } from '@vue/reactivity'
import {
  type VaporComponent,
  type VaporDirective,
  createComponent,
  defineVaporAsyncComponent,
  defineVaporComponent,
  withVaporDirectives,
} from '../../src'
import { currentInstance, nextTick, watchEffect } from '@vue/runtime-dom'
import type { Mock } from 'vitest'
import { compile, makeRender } from '../_utils'

const define = makeRender()

describe('custom directive', () => {
  it('should work', async () => {
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn((el, source) => {
      watchEffect(() => {
        el.textContent = source()
      })
      return teardown
    })
    const scope = effectScope()
    const el = document.createElement('div')
    const n = ref(1)
    const source = () => n.value
    const modifiers = { mod: true }
    scope.run(() => {
      withVaporDirectives(el, [[dir, source, undefined, modifiers]])
    })
    expect(dir).toHaveBeenCalledWith(el, source, undefined, modifiers)
    expect(teardown).not.toHaveBeenCalled()

    expect(el.textContent).toBe('1')

    n.value = 2
    await nextTick()
    expect(el.textContent).toBe('2')

    scope.stop()
    expect(teardown).toHaveBeenCalledOnce()

    n.value = 3
    await nextTick()
    // should be stopped and not update
    expect(el.textContent).toBe('2')
  })

  it('should apply to a resolved component root synchronously', async () => {
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn((el, source) => {
      watchEffect(() => {
        el.textContent = source()
      })
      return teardown
    })
    const scope = effectScope()
    const n = ref(1)
    const source = () => n.value

    // Child component with single root
    const Child = defineVaporComponent({
      render() {
        const el = document.createElement('div')
        return el
      },
    })

    const root = document.createElement('div')

    scope.run(() => {
      const instance = createComponent(Child)
      withVaporDirectives(instance, [[dir, source]])
      expect(dir).toHaveBeenCalledOnce()
      root.appendChild(instance.block as Node)
    })

    // Should resolve to the div element inside Child
    const el = (dir as unknown as Mock).mock.calls[0][0]
    expect(el).toBeInstanceOf(HTMLDivElement)
    expect(el.textContent).toBe('1')

    n.value = 2
    await nextTick()
    expect(el.textContent).toBe('2')

    scope.stop()
    expect(teardown).toHaveBeenCalledOnce()
  })

  it('should warn on multi-root component', () => {
    const dir: VaporDirective = vi.fn()
    const scope = effectScope()

    // Child component with multiple roots
    const Child = defineVaporComponent({
      render() {
        return [document.createElement('div'), document.createElement('span')]
      },
    })

    scope.run(() => {
      const instance = createComponent(Child)
      withVaporDirectives(instance, [[dir]])
    })

    expect(dir).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()
    scope.stop()
  })

  it('should re-apply to dynamic component root', async () => {
    const teardown = vi.fn()
    const data = ref({ current: 'div' })
    const dir: VaporDirective = vi.fn(el => {
      ;(el as Element).setAttribute('data-custom', '')
      return teardown
    })
    const App = compile(
      `<template><component :is="data.current" v-custom /></template>`,
      data,
    )
    App.directives = { custom: dir }

    const { host, app } = define(App).render()
    const first = host.firstElementChild!

    expect(first).toBeInstanceOf(HTMLDivElement)
    expect(first.getAttribute('data-custom')).toBe('')
    expect(dir).toHaveBeenCalledOnce()
    expect(teardown).not.toHaveBeenCalled()

    data.value.current = 'span'
    await nextTick()

    const second = host.firstElementChild!
    expect(second).toBeInstanceOf(HTMLSpanElement)
    expect(second).not.toBe(first)
    expect(second.getAttribute('data-custom')).toBe('')
    expect(dir).toHaveBeenCalledTimes(2)
    expect(teardown).toHaveBeenCalledOnce()

    app.unmount()
  })

  it('should re-apply with the directive owner when component root changes', async () => {
    const teardown = vi.fn()
    const data = ref({ show: true, value: 'one' })
    const owners: unknown[] = []
    const dir: VaporDirective = vi.fn(el => {
      owners.push(currentInstance)
      watchEffect(() => {
        ;(el as Element).setAttribute('data-value', data.value.value)
      })
      return teardown
    })
    const Child = compile(
      `<template><div v-if="data.show" /><span v-else /></template>`,
      data,
    )
    const App = compile(
      `<template><components.Child v-custom /></template>`,
      data,
      { Child },
    )
    App.directives = { custom: dir }

    const { host, app } = define(App).render()
    const owner = app._instance
    const first = host.firstElementChild!

    expect(first).toBeInstanceOf(HTMLDivElement)
    expect(first.getAttribute('data-value')).toBe('one')
    expect(dir).toHaveBeenCalledOnce()
    expect(owners).toHaveLength(1)
    expect(owners[0]).toBe(owner)
    expect(teardown).not.toHaveBeenCalled()

    data.value.show = false
    await nextTick()

    const second = host.firstElementChild!
    expect(second).toBeInstanceOf(HTMLSpanElement)
    expect(second).not.toBe(first)
    expect(second.getAttribute('data-value')).toBe('one')
    expect(dir).toHaveBeenCalledTimes(2)
    expect(owners).toHaveLength(2)
    expect(owners[1]).toBe(owner)
    expect(teardown).toHaveBeenCalledOnce()

    data.value.value = 'two'
    await nextTick()

    expect(first.getAttribute('data-value')).toBe('one')
    expect(second.getAttribute('data-value')).toBe('two')

    app.unmount()
  })

  it('should apply after async component resolves', async () => {
    let resolve!: (component: VaporComponent) => void
    const data = ref(null)
    const AsyncChild = defineVaporAsyncComponent(
      () =>
        new Promise<VaporComponent>(r => {
          resolve = r
        }),
    )
    const Child = compile(`<template><div /></template>`, data)
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn(el => {
      ;(el as Element).setAttribute('data-custom', '')
      return teardown
    })
    const App = compile(
      `<template><components.AsyncChild v-custom /></template>`,
      data,
      { AsyncChild },
    )
    App.directives = { custom: dir }

    const { host, app } = define(App).render()

    expect(dir).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).not.toHaveBeenWarned()

    resolve(Child)
    await new Promise(r => setTimeout(r))

    const element = host.firstElementChild!
    expect(element).toBeInstanceOf(HTMLDivElement)
    expect(element.getAttribute('data-custom')).toBe('')
    expect(dir).toHaveBeenCalledOnce()
    expect(teardown).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).not.toHaveBeenWarned()

    app.unmount()
    expect(teardown).toHaveBeenCalledOnce()
  })

  it('should warn after async component resolves to multiple roots', async () => {
    let resolve!: (component: VaporComponent) => void
    const data = ref(null)
    const AsyncChild = defineVaporAsyncComponent(
      () =>
        new Promise<VaporComponent>(r => {
          resolve = r
        }),
    )
    const Child = compile(`<template><div /><span /></template>`, data)
    const dir: VaporDirective = vi.fn()
    const App = compile(
      `<template><components.AsyncChild v-custom /></template>`,
      data,
      { AsyncChild },
    )
    App.directives = { custom: dir }

    const { app } = define(App).render()

    expect(dir).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).not.toHaveBeenWarned()

    resolve(Child)
    await new Promise(r => setTimeout(r))

    expect(dir).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()

    app.unmount()
  })

  it('should dispose directives while a dynamic async component is pending', async () => {
    let resolve!: (component: VaporComponent) => void
    const data = ref({ current: 'div', value: 'one' })
    const AsyncChild = defineVaporAsyncComponent(
      () =>
        new Promise<VaporComponent>(r => {
          resolve = r
        }),
    )
    const Child = compile(`<template><span /></template>`, data)
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn(el => {
      watchEffect(() => {
        ;(el as Element).setAttribute('data-value', data.value.value)
      })
      return teardown
    })
    const App = compile(
      `<template><component :is="data.current" v-custom /></template>`,
      data,
    )
    App.components = { AsyncChild }
    App.directives = { custom: dir }

    const { host, app } = define(App).render()
    const first = host.firstElementChild!

    expect(first).toBeInstanceOf(HTMLDivElement)
    expect(first.getAttribute('data-value')).toBe('one')
    expect(dir).toHaveBeenCalledOnce()

    data.value.current = 'AsyncChild'
    await nextTick()

    expect(host.firstElementChild).toBeNull()
    expect(teardown).toHaveBeenCalledOnce()
    expect(dir).toHaveBeenCalledOnce()

    data.value.value = 'two'
    await nextTick()
    expect(first.getAttribute('data-value')).toBe('one')

    resolve(Child)
    await new Promise(r => setTimeout(r))

    const second = host.firstElementChild!
    expect(second).toBeInstanceOf(HTMLSpanElement)
    expect(second).not.toBe(first)
    expect(second.getAttribute('data-value')).toBe('two')
    expect(dir).toHaveBeenCalledTimes(2)
    expect(teardown).toHaveBeenCalledOnce()

    app.unmount()
    expect(teardown).toHaveBeenCalledTimes(2)
  })
})
