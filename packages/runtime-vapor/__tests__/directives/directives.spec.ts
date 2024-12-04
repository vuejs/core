import { ref } from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  type DirectiveBinding,
  type DirectiveHook,
  createComponent,
  getCurrentInstance,
  nextTick,
  renderEffect,
  setText,
  template,
  withDirectives,
} from '@vue/runtime-vapor'
import { makeRender } from '../_utils'

const define = makeRender()

describe.todo('directives', () => {
  it('should work', async () => {
    const count = ref(0)

    function assertBindings(binding: DirectiveBinding) {
      expect(binding.value).toBe(count.value)
      expect(binding.arg).toBe('foo')
      expect(binding.instance).toBe(_instance)
      expect(binding.modifiers && binding.modifiers.ok).toBe(true)
    }

    const beforeMount = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should not be inserted yet
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)

      // expect(vnode).toBe(_vnode)
      // expect(prevVNode).toBe(null)
    }) as DirectiveHook<Element>)

    const mounted = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should be inserted now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)
    }) as DirectiveHook<Element>)

    const beforeUpdate = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should not have been updated yet
      expect(el.firstChild?.textContent).toBe(`${count.value - 1}`)

      assertBindings(binding)
    }) as DirectiveHook<Element>)

    const updated = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      // node should have been updated
      expect(el.firstChild?.textContent).toBe(`${count.value}`)

      assertBindings(binding)
    }) as DirectiveHook<Element>)

    const beforeUnmount = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should be removed now
      expect(el.parentNode).toBe(root)
      expect(root.children[0]).toBe(el)

      assertBindings(binding)
    }) as DirectiveHook<Element>)

    const unmounted = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should have been removed
      expect(el.parentNode).toBe(null)
      expect(root.children.length).toBe(0)

      assertBindings(binding)
    }) as DirectiveHook<Element>)

    const dir = {
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      beforeUnmount,
      unmounted,
    }

    let _instance: ComponentInternalInstance | null = null
    const { render } = define({
      setup() {
        _instance = getCurrentInstance()
      },
      render() {
        const n0 = template('<div></div>')()
        renderEffect(() => setText(n0, count.value))
        withDirectives(n0, [
          [
            dir,
            // value
            () => count.value,
            // argument
            'foo',
            // modifiers
            { ok: true },
          ],
        ])
        return n0
      },
    })

    const root = document.createElement('div')

    render(null, root)
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
      expect(binding.instance).toBe(_instance)
      expect(binding.modifiers && binding.modifiers.ok).toBe(true)
    }

    const fn = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(root)

      assertBindings(binding)
    }) as DirectiveHook<Element>)

    let _instance: ComponentInternalInstance | null = null
    const { render } = define({
      setup() {
        _instance = getCurrentInstance()
      },
      render() {
        const n0 = template('<div></div>')()
        renderEffect(() => setText(n0, count.value))
        withDirectives(n0, [
          [
            fn,
            // value
            () => count.value,
            // argument
            'foo',
            // modifiers
            { ok: true },
          ],
        ])
        return n0
      },
    })

    const root = document.createElement('div')
    render(null, root)

    expect(fn).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(2)
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
        const n0 = template('<div></div>')()
        withDirectives(n0, [[d2]])
        return n0
      },
    }

    const { render } = define({
      name: 'App',
      render() {
        const n0 = createComponent(Comp)
        withDirectives(n0, [[d1]])
        return n0
      },
    })

    const root = document.createElement('div')
    render(null, root)
    expect(d1.mounted).toHaveBeenCalled()
    expect(d2.mounted).toHaveBeenCalled()
  })

  test('should disable tracking inside directive lifecycle hooks', async () => {
    const count = ref(0)
    const text = ref('')
    const beforeUpdate = vi.fn(() => count.value++)

    const { render } = define({
      render() {
        const n0 = template('<p></p>')()
        renderEffect(() => setText(n0, text.value))
        withDirectives(n0, [
          [
            {
              beforeUpdate,
            },
          ],
        ])
        return n0
      },
    })

    const root = document.createElement('div')
    render(null, root)
    expect(beforeUpdate).toHaveBeenCalledTimes(0)
    expect(count.value).toBe(0)

    text.value = 'foo'
    await nextTick()
    expect(beforeUpdate).toHaveBeenCalledTimes(1)
    expect(count.value).toBe(1)
  })

  test('should receive exposeProxy for closed instances', async () => {
    let res: string
    const { render } = define({
      setup(_, { expose }) {
        expose({
          msg: 'Test',
        })
      },
      render() {
        const n0 = template('<p>Lore Ipsum</p>')()
        withDirectives(n0, [
          [
            {
              mounted(el, { instance }) {
                res = (instance.exposed as any).msg as string
              },
            },
          ],
        ])
        return n0
      },
    })
    const root = document.createElement('div')
    render(null, root)
    expect(res!).toBe('Test')
  })

  test('should not throw with unknown directive', async () => {
    const d1 = {
      mounted: vi.fn(),
    }
    const { render } = define({
      name: 'App',
      render() {
        const n0 = template('<div></div>')()
        // simulates the code generated on an unknown directive
        withDirectives(n0, [[undefined], [d1]])
        return n0
      },
    })

    const root = document.createElement('div')
    render(null, root)
    expect(d1.mounted).toHaveBeenCalled()
  })
})
