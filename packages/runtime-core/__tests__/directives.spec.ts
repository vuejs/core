import {
  type DirectiveBinding,
  type DirectiveHook,
  Suspense,
  type VNode,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  ref,
  render,
  withDirectives,
} from '@vue/runtime-test'
import {
  type GenericComponentInstance,
  currentInstance,
} from '../src/component'

describe('directives', () => {
  it('should work', async () => {
    const count = ref(0)

    function assertBindings(binding: DirectiveBinding) {
      expect(binding.value).toBe(count.value)
      expect(binding.arg).toBe('foo')
      expect(binding.instance).toBe(_instance && _instance.proxy)
      expect(binding.modifiers && binding.modifiers.ok).toBe(true)
    }

    const beforeMount = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should not be inserted yet
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const mounted = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be inserted now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const beforeUpdate = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should not have been updated yet
      expect(el.children[0].text).toBe(`${count.value - 1}`)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(_prevVnode)
    }) as DirectiveHook)

    const updated = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should have been updated
      expect(el.children[0].text).toBe(`${count.value}`)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(_prevVnode)
    }) as DirectiveHook)

    const beforeUnmount = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be removed now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const unmounted = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should have been removed
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const dir = {
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      beforeUnmount,
      unmounted,
    }

    let _instance: GenericComponentInstance | null = null
    let _vnode: VNode | null = null
    let _prevVnode: VNode | null = null
    const Comp = {
      setup() {
        _instance = currentInstance
      },
      render() {
        _prevVnode = _vnode
        _vnode = withDirectives(h('div', count.value), [
          [
            dir,
            // value
            count.value,
            // argument
            'foo',
            // modifiers
            { ok: true },
          ],
        ])
        return _vnode
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(mounted).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(beforeUpdate).toHaveBeenCalledTimes(1)
    expect(updated).toHaveBeenCalledTimes(1)

    render(null, root)
    expect(beforeUnmount).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  it('should work with a function directive', async () => {
    const count = ref(0)

    function assertBindings(binding: DirectiveBinding) {
      expect(binding.value).toBe(count.value)
      expect(binding.arg).toBe('foo')
      expect(binding.instance).toBe(_instance && _instance.proxy)
      expect(binding.modifiers && binding.modifiers.ok).toBe(true)
    }

    const fn = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(_prevVnode)
    }) as DirectiveHook)

    let _instance: GenericComponentInstance | null = null
    let _vnode: VNode | null = null
    let _prevVnode: VNode | null = null
    const Comp = {
      setup() {
        _instance = currentInstance
      },
      render() {
        _prevVnode = _vnode
        _vnode = withDirectives(h('div', count.value), [
          [
            fn,
            // value
            count.value,
            // argument
            'foo',
            // modifiers
            { ok: true },
          ],
        ])
        return _vnode
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(fn).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should work on component vnode', async () => {
    const count = ref(0)

    function assertBindings(binding: DirectiveBinding) {
      expect(binding.value).toBe(count.value)
      expect(binding.arg).toBe('foo')
      expect(binding.instance).toBe(_instance && _instance.proxy)
      expect(binding.modifiers && binding.modifiers.ok).toBe(true)
    }

    const beforeMount = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should not be inserted yet
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const mounted = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be inserted now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const beforeUpdate = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should not have been updated yet
      expect(el.children[0].text).toBe(`${count.value - 1}`)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode!.type).toBe(_prevVnode!.type)
    }) as DirectiveHook)

    const updated = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should have been updated
      expect(el.children[0].text).toBe(`${count.value}`)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode!.type).toBe(_prevVnode!.type)
    }) as DirectiveHook)

    const beforeUnmount = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be removed now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const unmounted = vi.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should have been removed
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const dir = {
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      beforeUnmount,
      unmounted,
    }

    let _instance: GenericComponentInstance | null = null
    let _vnode: VNode | null = null
    let _prevVnode: VNode | null = null

    const Child = (props: { count: number }) => {
      _prevVnode = _vnode
      _vnode = h('div', props.count)
      return _vnode
    }

    const Comp = {
      setup() {
        _instance = currentInstance
      },
      render() {
        return withDirectives(h(Child, { count: count.value }), [
          [
            dir,
            // value
            count.value,
            // argument
            'foo',
            // modifiers
            { ok: true },
          ],
        ])
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(mounted).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(beforeUpdate).toHaveBeenCalledTimes(1)
    expect(updated).toHaveBeenCalledTimes(1)

    render(null, root)
    expect(beforeUnmount).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  // #2298
  it('directive merging on component root', () => {
    const d1 = {
      mounted: vi.fn(),
    }
    const d2 = {
      mounted: vi.fn(),
    }
    const Comp = {
      render() {
        return withDirectives(h('div'), [[d2]])
      },
    }

    const App = {
      name: 'App',
      render() {
        return h('div', [withDirectives(h(Comp), [[d1]])])
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(d1.mounted).toHaveBeenCalled()
    expect(d2.mounted).toHaveBeenCalled()
  })

  test('should disable tracking inside directive lifecycle hooks', async () => {
    const count = ref(0)
    const text = ref('')
    const beforeUpdate = vi.fn(() => count.value++)

    const App = {
      render() {
        return withDirectives(h('p', text.value), [
          [
            {
              beforeUpdate,
            },
          ],
        ])
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(beforeUpdate).toHaveBeenCalledTimes(0)
    expect(count.value).toBe(0)

    text.value = 'foo'
    await nextTick()
    expect(beforeUpdate).toHaveBeenCalledTimes(1)
    expect(count.value).toBe(1)
  })

  test('should receive exposeProxy for closed instances', async () => {
    let res: string
    const App = defineComponent({
      setup(_, { expose }) {
        expose({
          msg: 'Test',
        })

        return () =>
          withDirectives(h('p', 'Lore Ipsum'), [
            [
              {
                mounted(el, { instance }) {
                  res = (instance as any).msg as string
                },
              },
            ],
          ])
      },
    })
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(res!).toBe('Test')
  })

  test('should not throw with unknown directive', async () => {
    const d1 = {
      mounted: vi.fn(),
    }
    const App = {
      name: 'App',
      render() {
        // simulates the code generated on an unknown directive
        return withDirectives(h('div'), [[undefined], [d1]])
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(d1.mounted).toHaveBeenCalled()
  })

  // #12460
  test('mounted hook receives the latest binding after an update in the same flush', async () => {
    const calls: string[] = []
    const dir = {
      beforeUpdate(_: any, { value, oldValue }: DirectiveBinding) {
        calls.push(`beforeUpdate ${value} ${oldValue}`)
      },
      mounted(_: any, { value, oldValue }: DirectiveBinding, vnode: VNode) {
        calls.push(`mounted ${value} ${oldValue} ${vnode.props!.id}`)
      },
      updated(_: any, { value, oldValue }: DirectiveBinding) {
        calls.push(`updated ${value} ${oldValue}`)
      },
    }
    const show = ref(false)
    const count = ref(0)
    // an event emitted from setup updates the parent while it is mounting
    const Child = {
      emits: ['setup'],
      setup(_: any, { emit }: any) {
        emit('setup')
        return () => null
      },
    }
    const App = {
      render: () =>
        show.value
          ? [
              withDirectives(h('div', { id: count.value }), [
                [dir, count.value],
              ]),
              h(Child, { onSetup: () => count.value++ }),
            ]
          : null,
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    show.value = true
    await nextTick()
    expect(calls).toEqual([
      'beforeUpdate 1 0',
      'mounted 1 undefined 1',
      'updated 1 0',
    ])
  })

  test('mounted hook deferred by a pending Suspense receives the latest binding', async () => {
    const calls: string[] = []
    const dir = {
      beforeUpdate(_: any, { value, oldValue }: DirectiveBinding) {
        calls.push(`beforeUpdate ${value} ${oldValue}`)
      },
      mounted(_: any, { value, oldValue }: DirectiveBinding, vnode: VNode) {
        calls.push(`mounted ${value} ${oldValue} ${vnode.props!.id}`)
      },
      updated(_: any, { value, oldValue }: DirectiveBinding) {
        calls.push(`updated ${value} ${oldValue}`)
      },
    }
    let resolve: () => void
    const Async = {
      async setup() {
        await new Promise<void>(r => (resolve = r))
        return () => h('span')
      },
    }
    const count = ref(0)
    const App = {
      render: () =>
        h(Suspense, null, {
          default: () =>
            h('div', [
              withDirectives(h('p', { id: count.value }), [[dir, count.value]]),
              h(Async),
            ]),
        }),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    // the pending branch re-renders before it is revealed
    count.value++
    await nextTick()
    expect(calls).toEqual(['beforeUpdate 1 0'])

    count.value++
    await nextTick()
    expect(calls).toEqual(['beforeUpdate 1 0', 'beforeUpdate 2 1'])

    resolve!()
    await new Promise(r => setTimeout(r))
    expect(calls).toEqual([
      'beforeUpdate 1 0',
      'beforeUpdate 2 1',
      'mounted 2 undefined 2',
      'updated 1 0',
      'updated 2 1',
    ])
  })

  test('pending mounted hooks use the vnode of their own component root', async () => {
    const mounted = vi.fn()
    const dir = { mounted }
    const editing = ref(true)
    const count = ref(0)
    const Child = {
      render: () => h(editing.value ? 'input' : 'span', { id: count.value }),
    }
    let resolve: () => void
    const Async = {
      async setup() {
        await new Promise<void>(r => (resolve = r))
        return () => h('p')
      },
    }
    const App = {
      render: () =>
        h(Suspense, null, {
          default: () =>
            h('div', [withDirectives(h(Child), [[dir, 'value']]), h(Async)]),
        }),
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    editing.value = false
    await nextTick()
    count.value++
    await nextTick()
    resolve!()
    await new Promise(r => setTimeout(r))

    expect(
      mounted.mock.calls.map(([el, binding, vnode]) => [
        el.tag,
        vnode.type,
        vnode.props.id,
        binding.oldValue,
      ]),
    ).toEqual([
      ['input', 'input', 0, undefined],
      ['span', 'span', 1, undefined],
    ])
  })
})
