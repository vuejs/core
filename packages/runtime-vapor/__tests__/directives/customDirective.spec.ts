import { effectScope, ref } from '@vue/reactivity'
import {
  type VaporComponent,
  type VaporDirective,
  createComponent,
  defineVaporAsyncComponent,
  defineVaporComponent,
  withVaporDirectives,
} from '../../src'
import {
  currentInstance,
  nextTick,
  onMounted,
  onUpdated,
  watch,
  watchEffect,
  watchPostEffect,
} from '@vue/runtime-dom'
import type { Mock } from 'vite-plus/test'
import { compile, makeRender, renderParity } from '../_utils'
import type { VaporComponentInstance } from '../../src/component'
import type { DynamicFragment } from '../../src/fragment'

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

  it('should warn instead of applying through a slot outlet root', () => {
    const data = ref(null)
    const dir: VaporDirective = vi.fn()
    const Child = compile(`<template><slot /></template>`, data)
    const App = compile(
      `<template><components.Child v-custom><p>content</p></components.Child></template>`,
      data,
      { Child },
    )
    App.directives = { custom: dir }

    const { html } = define(App).render()
    expect(html()).toBe('<p>content</p><!--slot-->')
    expect(dir).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()
  })

  it('should warn and skip vdom object directives', () => {
    const data = ref(null)
    const mounted = vi.fn()
    const fn: VaporDirective = vi.fn()
    const App = compile(`<template><div v-obj v-fn /></template>`, data)
    App.directives = { obj: { mounted }, fn }

    const { html } = define(App).render()
    expect(html()).toBe('<div></div>')
    expect(mounted).not.toHaveBeenCalled()
    expect(fn).toHaveBeenCalledOnce()
    expect(
      'Received a VDOM object directive (hooks: mounted) in a Vapor template',
    ).toHaveBeenWarned()
  })

  it('should pass the argument as a getter', async () => {
    const data = ref({ arg: 'a' })
    const dir: VaporDirective = (el, _value, arg) => {
      watchEffect(() => {
        ;(el as Element).setAttribute('data-arg', arg!())
      })
    }
    const App = compile(
      `<template><div v-custom:[data.arg] /><p v-custom:static /></template>`,
      data,
    )
    App.directives = { custom: dir }

    const { host } = define(App).render()
    const [div, p] = Array.from(host.children)
    expect(div.getAttribute('data-arg')).toBe('a')
    expect(p.getAttribute('data-arg')).toBe('static')

    data.value.arg = 'b'
    await nextTick()
    expect(div.getAttribute('data-arg')).toBe('b')
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

  it('should release the previous component root before it is removed', async () => {
    const data = ref({ show: true })
    const states: string[] = []
    const dir: VaporDirective = el => {
      states.push(`apply:${el.tagName}:${el.isConnected}`)
      return () => states.push(`cleanup:${el.tagName}:${el.isConnected}`)
    }
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

    const { app } = define(App).render()
    data.value.show = false
    await nextTick()
    expect(states).toEqual([
      'apply:DIV:false',
      'cleanup:DIV:true',
      'apply:SPAN:true',
    ])

    app.unmount()
    expect(states[3]).toBe('cleanup:SPAN:true')
  })

  it('should keep the current root when a cached branch updates offscreen', async () => {
    const data = ref({ current: 'CompA', show: true })
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn(() => teardown)
    const CompA = compile(
      `<template><div v-if="data.show" /><span v-else /></template>`,
      data,
    )
    const CompB = compile(`<template><p /></template>`, data)
    const App = compile(
      `<template><KeepAlive><component :is="data.current" v-custom /></KeepAlive></template>`,
      data,
    )
    App.components = { CompA, CompB }
    App.directives = { custom: dir }

    const { host, app } = define(App).render()
    expect(dir).toHaveBeenCalledOnce()

    data.value.current = 'CompB'
    await nextTick()
    expect(dir).toHaveBeenCalledTimes(2)
    expect(teardown).toHaveBeenCalledOnce()

    // the deactivated CompA switches its root while CompB owns the directive
    data.value.show = false
    await nextTick()
    expect(dir).toHaveBeenCalledTimes(2)
    expect(teardown).toHaveBeenCalledOnce()
    expect(host.firstElementChild).toBeInstanceOf(HTMLParagraphElement)

    data.value.current = 'CompA'
    await nextTick()
    expect(dir).toHaveBeenCalledTimes(3)
    expect(teardown).toHaveBeenCalledTimes(2)
    expect((dir as unknown as Mock).mock.calls[2][0]).toBe(
      host.firstElementChild,
    )
    expect(host.firstElementChild).toBeInstanceOf(HTMLSpanElement)

    app.unmount()
  })

  it('should isolate directive errors from the owner render', () => {
    const data = ref(null)
    const error = new Error('directive')
    const dir: VaporDirective = () => {
      throw error
    }
    const App = compile(
      `<template><div><p v-custom /><i>after</i></div></template>`,
      data,
    )
    App.directives = { custom: dir }

    const { app, mount, html } = define(App).create()
    const errorHandler = (app.config.errorHandler = vi.fn())
    mount()
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0][0]).toBe(error)
    expect(html()).toBe('<div><p></p><i>after</i></div>')

    app.unmount()
  })

  it('should isolate directive errors on component root re-application', async () => {
    const data = ref({ show: true })
    const error = new Error('directive')
    const dir: VaporDirective = el => {
      if (el.tagName === 'SPAN') throw error
    }
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

    const { app, mount, html } = define(App).create()
    const errorHandler = (app.config.errorHandler = vi.fn())
    mount()
    data.value.show = false
    await nextTick()
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0][0]).toBe(error)
    expect(html()).toBe('<span></span><!--if-->')

    app.unmount()
  })

  it('should isolate directive cleanup errors', async () => {
    const data = ref({ show: true })
    const error = new Error('cleanup')
    const teardown = vi.fn()
    const failing: VaporDirective = () => () => {
      throw error
    }
    const other: VaporDirective = () => teardown
    const App = compile(
      `<template><div v-if="data.show" v-failing v-other /></template>`,
      data,
    )
    App.directives = { failing, other }

    const { app, mount, html } = define(App).create()
    const errorHandler = (app.config.errorHandler = vi.fn())
    mount()
    data.value.show = false
    await nextTick()
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0][0]).toBe(error)
    expect(teardown).toHaveBeenCalledOnce()
    expect(html()).toBe('<!--if-->')

    app.unmount()
  })

  it('should apply after the element props and children are in place', () => {
    const data = ref({ x: 'X', text: 'T', show: true })
    let seen: Record<string, unknown> | undefined
    const dir: VaporDirective = el => {
      seen = {
        attr: el.getAttribute('data-x'),
        text: el.textContent,
        span: !!el.querySelector('span'),
        child: !!el.querySelector('b'),
        connected: el.isConnected,
      }
    }
    const Child = compile(`<template><b /></template>`, data)
    const App = compile(
      `<template><div v-custom :data-x="data.x">{{ data.text }}<span v-if="data.show" /><components.Child /></div></template>`,
      data,
      { Child },
    )
    App.directives = { custom: dir }

    define(App).render()
    expect(seen).toEqual({
      attr: 'X',
      text: 'T',
      span: true,
      child: true,
      connected: false,
    })
  })

  it('should warn on lifecycle hooks registered inside a directive', () => {
    const data = ref(null)
    const dir: VaporDirective = () => {
      onMounted(() => {})
      onUpdated(() => {})
    }
    const App = compile(`<template><div v-custom /></template>`, data)
    App.directives = { custom: dir }

    const { html } = define(App).render()
    expect(html()).toBe('<div></div>')
    expect(
      'onMounted() was called inside a custom directive',
    ).toHaveBeenWarned()
    expect(
      'onUpdated() was called inside a custom directive',
    ).toHaveBeenWarned()
  })

  it('should observe the inserted element from a post effect', async () => {
    const data = ref({ show: true, extra: false })
    const states: string[] = []
    const dir: VaporDirective = el => {
      watchPostEffect(() => states.push(`${el.tagName}:${el.isConnected}`))
    }
    const Child = compile(
      `<template><div v-if="data.show" /><span v-else /></template>`,
      data,
    )
    const App = compile(
      `<template><components.Child v-custom /><p v-if="data.extra" v-custom /></template>`,
      data,
      { Child },
    )
    App.directives = { custom: dir }

    const { app } = define(App).render()
    expect(states).toEqual(['DIV:true'])

    data.value.show = false
    data.value.extra = true
    await nextTick()
    expect(states).toEqual(['DIV:true', 'P:true', 'SPAN:true'])

    app.unmount()
  })

  it.each([
    ['in a v-for', `<p v-for="i in data.list" :key="i" v-custom />`],
    ['on a component root', `<components.Child v-custom />`],
  ])(
    'should report the cleanup error of a watcher created %s when the owner unmounts',
    (_, template) => {
      const data = ref({ list: [1] })
      const error = new Error('cleanup')
      const dir: VaporDirective = () => {
        watch(
          data,
          (_, __, onCleanup) => {
            onCleanup(() => {
              throw error
            })
          },
          { immediate: true },
        )
      }
      const Child = compile(`<template><div /></template>`, data)
      const App = compile(
        `<template>
          ${template}
        </template>`,
        data,
        { Child },
      )
      App.directives = { custom: dir }

      const { app, mount } = define(App).create()
      const errorHandler = (app.config.errorHandler = vi.fn())
      mount()
      app.unmount()
      expect(errorHandler).toHaveBeenCalledOnce()
      expect(errorHandler.mock.calls[0][0]).toBe(error)
    },
  )
  it('should take over the hooks of the binding it replaces on a kept-alive root chain', async () => {
    const data = ref({ root: true, inner: true })
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn(() => teardown)
    let childInstance!: VaporComponentInstance
    const Child = compile(
      `<script setup vapor>
        const data = _data
        _components.capture()
      </script>
      <template>
        <div v-if="data.inner">a</div>
        <p v-else>b</p>
      </template>`,
      data,
      {
        capture: () =>
          (childInstance = currentInstance as VaporComponentInstance),
      },
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template>
        <KeepAlive>
          <Child v-if="data.root" v-custom />
          <span v-else>plain</span>
        </KeepAlive>
      </template>`,
      data,
      { Child },
    )
    App.directives = { custom: dir }

    const { host, app } = define(App).render()
    const frag = childInstance.block as DynamicFragment
    const hookCounts = () => [
      frag.u!.length,
      frag.bu!.length,
      childInstance.hmrRootHooks!.length,
    ]
    expect(hookCounts()).toEqual([1, 1, 1])

    for (let i = 0; i < 3; i++) {
      data.value.root = false
      await nextTick()
      data.value.root = true
      await nextTick()
    }
    // the binding of each re-entered branch render replaces the previous one
    expect(hookCounts()).toEqual([1, 1, 1])
    const calls = (dir as unknown as Mock).mock.calls.length
    const teardowns = teardown.mock.calls.length

    data.value.inner = false
    await nextTick()
    expect(teardown).toHaveBeenCalledTimes(teardowns + 1)
    expect(dir).toHaveBeenCalledTimes(calls + 1)
    expect((dir as unknown as Mock).mock.calls[calls][0]).toBe(
      host.querySelector('p'),
    )

    app.unmount()
  })

  it('should gain no hook on a branch a nested KeepAlive cached from the bindings disposed meanwhile', async () => {
    const data = ref({ root: true, cached: true, inner: true })
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn(() => teardown)
    let innerInstance!: VaporComponentInstance
    const Inner = compile(
      `<script setup vapor>
        const data = _data
        _components.capture()
      </script>
      <template>
        <div v-if="data.inner">a</div>
        <p v-else>b</p>
      </template>`,
      data,
      {
        capture: () =>
          (innerInstance = currentInstance as VaporComponentInstance),
      },
    )
    const Child = compile(
      `<script setup vapor>
        const data = _data
        const Inner = _components.Inner
      </script>
      <template>
        <KeepAlive>
          <Inner v-if="data.cached" />
          <i v-else>other</i>
        </KeepAlive>
      </template>`,
      data,
      { Inner },
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template>
        <KeepAlive>
          <Child v-if="data.root" v-custom />
          <span v-else>plain</span>
        </KeepAlive>
      </template>`,
      data,
      { Child },
    )
    App.directives = { custom: dir }

    const { host, app } = define(App).render()
    const frag = innerInstance.block as DynamicFragment
    const hookCounts = () => [
      frag.u!.length,
      frag.bu!.length,
      innerInstance.hmrRootHooks!.length,
    ]
    expect(hookCounts()).toEqual([1, 1, 1])

    for (let i = 0; i < 3; i++) {
      // Inner is off the root chain while the outer branch is re-entered
      data.value.cached = false
      await nextTick()
      data.value.root = false
      await nextTick()
      data.value.root = true
      await nextTick()
      data.value.cached = true
      await nextTick()
    }
    expect(hookCounts()).toEqual([1, 1, 1])
    const calls = (dir as unknown as Mock).mock.calls.length
    const teardowns = teardown.mock.calls.length

    data.value.inner = false
    await nextTick()
    expect(teardown).toHaveBeenCalledTimes(teardowns + 1)
    expect(dir).toHaveBeenCalledTimes(calls + 1)
    expect((dir as unknown as Mock).mock.calls[calls][0]).toBe(
      host.querySelector('p'),
    )

    app.unmount()
  })

  describe('through a Transition wrapping a slot', () => {
    // What a component's `v-foo` does per mode: the element it binds, then
    // `-` the element it leaves. `mounted` + `unmounted` in vdom, the
    // directive and its cleanup in vapor.
    async function directiveLog(
      srcs: Record<string, string>,
      makeData = () => ref<any>({}),
      act: (data: any) => void | Promise<void> = () => {},
    ) {
      const log: { vdom: string[]; vapor: string[] } = { vdom: [], vapor: [] }
      let vapor = false
      await renderParity(srcs, makeData, data => act(data.value), {
        // read once as each mode starts, vdom first
        get vFoo() {
          const out = vapor ? log.vapor : log.vdom
          const bind = (el: Element) => void out.push(el.tagName)
          const unbind = (el: Element) => void out.push('-' + el.tagName)
          const dir = vapor
            ? (el: Element) => (bind(el), () => unbind(el))
            : { mounted: bind, unmounted: unbind }
          vapor = true
          return dir
        },
      })
      return log
    }
    const withFoo = (template: string) =>
      `<script setup>
        const data = _data
        const components = _components
        const vFoo = components.vFoo
      </script>
      ${template}`
    const Fade = `<template>
      <Transition :css="false"><slot /></Transition>
    </template>`

    test('applies to the slot content root like vdom', async () => {
      const log = await directiveLog({
        Fade,
        App: withFoo(`<template>
          <components.Fade v-foo>
            <div>x</div>
          </components.Fade>
        </template>`),
      })
      expect(log.vdom).toEqual(['DIV', '-DIV'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('applies a directive written on the Transition itself like vdom', async () => {
      const log = await directiveLog({
        Fade: withFoo(`<template>
          <Transition :css="false" v-foo><slot /></Transition>
        </template>`),
        App: `<template>
          <components.Fade>
            <div>x</div>
          </components.Fade>
        </template>`,
      })
      expect(log.vdom).toEqual(['DIV', '-DIV'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('applies through forwarding wrappers like vdom', async () => {
      const log = await directiveLog({
        Fade,
        Wrap: `<template>
          <components.Fade><slot /></components.Fade>
        </template>`,
        App: withFoo(`<template>
          <components.Wrap v-foo>
            <p>x</p>
          </components.Wrap>
        </template>`),
      })
      expect(log.vdom).toEqual(['P', '-P'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('applies to the root of a component in the slot like vdom', async () => {
      const log = await directiveLog({
        Fade,
        Inner: `<template><section>x</section></template>`,
        App: withFoo(`<template>
          <components.Fade v-foo>
            <components.Inner />
          </components.Fade>
        </template>`),
      })
      expect(log.vdom).toEqual(['SECTION', '-SECTION'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('follows a branch switch of the slot content like vdom', async () => {
      const log = await directiveLog(
        {
          Fade,
          App: withFoo(`<template>
            <components.Fade v-foo>
              <p v-if="data.ok">a</p>
              <span v-else>b</span>
            </components.Fade>
          </template>`),
        },
        () => ref({ ok: true }),
        async data => {
          data.ok = false
          await nextTick()
          data.ok = true
        },
      )
      expect(log.vdom).toEqual(['P', '-P', 'SPAN', '-SPAN', 'P', '-P'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('follows the slot fallback like vdom', async () => {
      const log = await directiveLog(
        {
          Fade: `<template>
            <Transition :css="false">
              <slot><span>fallback</span></slot>
            </Transition>
          </template>`,
          App: withFoo(`<template>
            <components.Fade v-foo>
              <p v-if="data.has">x</p>
            </components.Fade>
          </template>`),
        },
        () => ref({ has: true }),
        async data => {
          data.has = false
          await nextTick()
          data.has = true
        },
      )
      expect(log.vdom).toEqual(['P', '-P', 'SPAN', '-SPAN', 'P', '-P'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('follows content shown after an initial slot fallback like vdom', async () => {
      const log = await directiveLog(
        {
          Fade: `<template>
            <Transition :css="false">
              <slot><span>fallback</span></slot>
            </Transition>
          </template>`,
          App: withFoo(`<template>
            <components.Fade v-foo>
              <p v-if="data.has">x</p>
            </components.Fade>
          </template>`),
        },
        () => ref({ has: false }),
        async data => {
          data.has = true
          await nextTick()
          data.has = false
        },
      )
      expect(log.vdom).toEqual(['SPAN', '-SPAN', 'P', '-P', 'SPAN', '-SPAN'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('follows a dynamic slot source over a slot fallback like vdom', async () => {
      const log = await directiveLog(
        {
          Fade: `<template>
            <Transition :css="false">
              <slot><span>fallback</span></slot>
            </Transition>
          </template>`,
          App: withFoo(`<template>
            <components.Fade v-foo>
              <template v-if="data.has" #default>
                <p>x</p>
              </template>
            </components.Fade>
          </template>`),
        },
        () => ref({ has: false }),
        async data => {
          data.has = true
          await nextTick()
          data.has = false
        },
      )
      expect(log.vdom).toEqual(['SPAN', '-SPAN', 'P', '-P', 'SPAN', '-SPAN'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('leaves a slot fallback replaced by a component with no root element', async () => {
      const data = ref({ has: false })
      const log: string[] = []
      const dir: VaporDirective = el => {
        log.push(el.tagName)
        return () => log.push('-' + el.tagName)
      }
      const Fade = compile(
        `<template>
          <Transition :css="false">
            <slot><span>fallback</span></slot>
          </Transition>
        </template>`,
        data,
      )
      const Empty = compile(`<template><div v-if="false" /></template>`, data)
      const App = compile(
        `<template>
          <components.Fade v-custom>
            <template v-if="data.has" #default>
              <components.Empty />
            </template>
          </components.Fade>
        </template>`,
        data,
        { Fade, Empty },
      )
      App.directives = { custom: dir }

      const { app, html } = define(App).render()
      expect(log).toEqual(['SPAN'])

      data.value.has = true
      await nextTick()
      expect(html()).not.toContain('fallback')
      expect(log).toEqual(['SPAN', '-SPAN'])
      expect(
        'Runtime directive used on component with non-element root node',
      ).toHaveBeenWarned()
      expect(
        'Transition component has no valid child element',
      ).toHaveBeenWarned()

      app.unmount()
    })

    test('stays silent while the slot has nothing to show like vdom', async () => {
      const log = await directiveLog(
        {
          Fade,
          App: withFoo(`<template>
            <components.Fade v-foo>
              <p v-if="data.has">x</p>
            </components.Fade>
          </template>`),
        },
        () => ref({ has: false }),
        async data => {
          data.has = true
          await nextTick()
          data.has = false
        },
      )
      expect(log.vdom).toEqual(['P', '-P'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test('stays silent until the slot fallback enters after an out-in leave like vdom', async () => {
      const log = await directiveLog(
        {
          Fade: `<template>
            <Transition
              :css="false"
              mode="out-in"
              @leave="(el, done) => data.dones.push(done)"
            >
              <slot><span>fallback</span></slot>
            </Transition>
          </template>`,
          App: withFoo(`<template>
            <components.Fade v-foo>
              <p v-if="data.has">x</p>
            </components.Fade>
          </template>`),
        },
        () => ref({ has: true, dones: [] as (() => void)[] }),
        async data => {
          data.has = false
          await nextTick()
          data.dones.forEach((done: () => void) => done())
        },
      )
      expect(log.vdom).toEqual(['P', '-P', 'SPAN', '-SPAN'])
      expect(log.vapor).toEqual(log.vdom)
    })

    test.each([
      [
        'a dynamic slot name',
        `<slot :name="data.slot" />`,
        `<template #one><div /></template>
              <template #two><span /></template>`,
        (data: any) => (data.slot = 'two'),
      ],
      [
        'its fallback',
        `<slot><span>fallback</span></slot>`,
        `<div v-if="data.has" />`,
        (data: any) => (data.has = false),
      ],
    ])(
      'keeps the current root when a cached slot switches to %s',
      async (_, outlet, content, change) => {
        const data = ref({ current: 'CompA', slot: 'one', has: true })
        const log: string[] = []
        const dir: VaporDirective = el => {
          log.push(el.tagName)
          return () => log.push('-' + el.tagName)
        }
        const CompA = compile(
          `<template>
            <Transition :css="false">${outlet}</Transition>
          </template>`,
          data,
        )
        const CompB = compile(`<template><p /></template>`, data)
        const App = compile(
          `<template>
            <KeepAlive>
              <component :is="data.current" v-custom>
                ${content}
              </component>
            </KeepAlive>
          </template>`,
          data,
        )
        App.components = { CompA, CompB }
        App.directives = { custom: dir }

        const { app } = define(App).render()
        data.value.current = 'CompB'
        await nextTick()
        expect(log).toEqual(['DIV', '-DIV', 'P'])

        // the deactivated CompA switches its slot while CompB owns the directive
        change(data.value)
        await nextTick()
        expect(log).toEqual(['DIV', '-DIV', 'P'])

        data.value.current = 'CompA'
        await nextTick()
        expect(log).toEqual(['DIV', '-DIV', 'P', '-P', 'SPAN'])

        app.unmount()
      },
    )

    test('still warns on the slot outlet root of a component in the slot like vdom', async () => {
      const log = await directiveLog({
        Fade,
        Inner: `<template><slot /></template>`,
        App: withFoo(`<template>
          <components.Fade v-foo>
            <components.Inner>
              <p>x</p>
            </components.Inner>
          </components.Fade>
        </template>`),
      })
      expect(log.vdom).toEqual([])
      expect(log.vapor).toEqual(log.vdom)
      expect(
        'Runtime directive used on component with non-element root node',
      ).toHaveBeenWarnedTimes(2)
      expect(
        'Component inside <Transition> renders non-element root node',
      ).toHaveBeenWarned()
    })
  })
})
