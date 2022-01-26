import {
  h,
  withDirectives,
  ref,
  render,
  nodeOps,
  DirectiveHook,
  VNode,
  DirectiveBinding,
  nextTick
} from '@vue/runtime-test'
import { currentInstance, ComponentInternalInstance } from '../src/component'

describe('directives', () => {
  it('should work', async () => {
    const count = ref(0)

    function assertBindings(binding: DirectiveBinding) {
      expect(binding.value).toBe(count.value)
      expect(binding.arg).toBe('foo')
      expect(binding.instance).toBe(_instance && _instance.proxy)
      expect(binding.modifiers && binding.modifiers.ok).toBe(true)
    }

    const beforeMount = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should not be inserted yet
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const mounted = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be inserted now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const beforeUpdate = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should not have been updated yet
      expect(el.children[0].text).toBe(`${count.value - 1}`)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(_prevVnode)
    }) as DirectiveHook)

    const updated = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should have been updated
      expect(el.children[0].text).toBe(`${count.value}`)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(_prevVnode)
    }) as DirectiveHook)

    const beforeUnmount = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be removed now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const unmounted = jest.fn(((el, binding, vnode, prevVNode) => {
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
      unmounted
    }

    let _instance: ComponentInternalInstance | null = null
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
            { ok: true }
          ]
        ])
        return _vnode
      }
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

    const fn = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)

      assertBindings(binding)

      expect(vnode).toBe(_vnode)
      expect(prevVNode).toBe(_prevVnode)
    }) as DirectiveHook)

    let _instance: ComponentInternalInstance | null = null
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
            { ok: true }
          ]
        ])
        return _vnode
      }
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

    const beforeMount = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should not be inserted yet
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const mounted = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be inserted now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const beforeUpdate = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should not have been updated yet
      // expect(el.children[0].text).toBe(`${count.value - 1}`)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode!.type).toBe(_prevVnode!.type)
    }) as DirectiveHook)

    const updated = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should have been updated
      expect(el.children[0].text).toBe(`${count.value}`)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode!.type).toBe(_prevVnode!.type)
    }) as DirectiveHook)

    const beforeUnmount = jest.fn(((el, binding, vnode, prevVNode) => {
      expect(el.tag).toBe('div')
      // should be removed now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)

      expect(vnode.type).toBe(_vnode!.type)
      expect(prevVNode).toBe(null)
    }) as DirectiveHook)

    const unmounted = jest.fn(((el, binding, vnode, prevVNode) => {
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
      unmounted
    }

    let _instance: ComponentInternalInstance | null = null
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
            { ok: true }
          ]
        ])
      }
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
      mounted: jest.fn()
    }
    const d2 = {
      mounted: jest.fn()
    }
    const Comp = {
      render() {
        return withDirectives(h('div'), [[d2]])
      }
    }

    const App = {
      name: 'App',
      render() {
        return h('div', [withDirectives(h(Comp), [[d1]])])
      }
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(d1.mounted).toHaveBeenCalled()
    expect(d2.mounted).toHaveBeenCalled()
  })

  test('should disable tracking inside directive lifecycle hooks', async () => {
    const count = ref(0)
    const text = ref('')
    const beforeUpdate = jest.fn(() => count.value++)

    const App = {
      render() {
        return withDirectives(h('p', text.value), [
          [
            {
              beforeUpdate
            }
          ]
        ])
      }
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

  it('directive install hooks', async () => {
    const count = ref(0)
    let d1_installed_created = jest.fn()
    let d1_installed_mounted = jest.fn()
    let d1_installed_beforeMounted = jest.fn()
    let d1_installed_beforeupdate = jest.fn()
    let d1_installed_updated = jest.fn()
    let d1_installed_beforeUnmount = jest.fn()
    let d1_installed_unmounted = jest.fn()

    let mounted_overwritten = jest.fn()

    const d1 = {
      install() {
        return {
          created: d1_installed_created,
          mounted: d1_installed_mounted,
          beforeMount: d1_installed_beforeMounted,
          beforeUpdate: d1_installed_beforeupdate,
          updated: d1_installed_updated,
          beforeUnmount: d1_installed_beforeUnmount,
          unmounted: d1_installed_unmounted
        }
      },
      mounted: mounted_overwritten
    }

    // test that install doesn't override hooks that it does not provide.
    let d2_created = jest.fn()
    let d2_installed_mounted = jest.fn()
    let d2_install = jest
      .fn()
      .mockReturnValue({ mounted: d2_installed_mounted })
    const d2 = {
      install: d2_install,
      created: d2_created
    }

    const Comp = {
      render() {
        return withDirectives(h('div', [count.value]), [[d1], [d2]])
      }
    }

    const App = {
      name: 'App',
      render() {
        return h('div', [h(Comp)])
      }
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    count.value++

    await nextTick()

    // all installed hooks called
    expect(d1_installed_created).toHaveBeenCalled()
    expect(d1_installed_mounted).toHaveBeenCalled()
    expect(d1_installed_beforeMounted).toHaveBeenCalled()
    expect(d1_installed_beforeupdate).toHaveBeenCalled()
    expect(d1_installed_updated).toHaveBeenCalled()

    expect(mounted_overwritten).not.toHaveBeenCalled()

    expect(d2_created).toHaveBeenCalled()
    expect(d2_install).toHaveBeenCalled()
    expect(d2_installed_mounted).toHaveBeenCalled()

    render(null, root)

    expect(d1_installed_beforeUnmount).toHaveBeenCalledTimes(1)
    expect(d1_installed_unmounted).toHaveBeenCalledTimes(1)
  })
})
