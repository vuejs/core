import {
  type DirectiveBinding,
  type DirectiveHook,
  createComponent,
  defineComponent,
  nextTick,
  ref,
  renderEffect,
  setText,
  template,
  withDirectives,
} from '../src'
import {
  type Component,
  type ComponentInternalInstance,
  currentInstance,
} from '../src/component'
import { makeRender } from './_utils'

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
      expect(host.children.length).toBe(0)

      assertBindings(binding)

      expect(el).toBe(_node)
    }) as DirectiveHook)

    const mounted = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should be inserted now
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      assertBindings(binding)
    }) as DirectiveHook)

    const beforeUpdate = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      // node should not have been updated yet
      expect(el.childNodes[0].textContent).toBe(`${count.value - 1}`)

      assertBindings(binding)
    }) as DirectiveHook)

    const updated = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      // node should have been updated
      expect(el.childNodes[0].textContent).toBe(`${count.value}`)

      assertBindings(binding)
    }) as DirectiveHook)

    const beforeUnmount = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should be removed now
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      assertBindings(binding)
    }) as DirectiveHook)

    const unmounted = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should have been removed
      expect(el.parentNode).toBe(null)
      expect(host.children.length).toBe(0)

      assertBindings(binding)
    }) as DirectiveHook)

    const dir = {
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      beforeUnmount,
      unmounted,
    }

    let _instance: ComponentInternalInstance | null = null
    let _node: Node | null = null

    const { host, render } = define({
      setup() {
        _instance = currentInstance
      },
      render() {
        _node = template('<div>')()
        renderEffect(() => {
          setText(_node!, count.value)
        })
        withDirectives(_node, [
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
        return _node
      },
    })
    const { app } = render()

    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(mounted).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(beforeUpdate).toHaveBeenCalledTimes(1)
    expect(updated).toHaveBeenCalledTimes(1)

    app.unmount()
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
      expect(el.parentNode).toBe(host)

      assertBindings(binding)
    }) as DirectiveHook)

    let _instance: ComponentInternalInstance | null = null
    let _node: Node | null = null
    const Comp = {
      setup() {
        _instance = currentInstance
      },
      render() {
        _node = template('<div>')()
        renderEffect(() => {
          setText(_node!, count.value)
        })
        withDirectives(_node, [
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
        return _node
      },
    }

    const { host, render } = define(Comp)
    render()

    expect(fn).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should work on components', async () => {
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
      expect(host.children.length).toBe(0)

      assertBindings(binding)
    }) as DirectiveHook)

    const mounted = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should be inserted now
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      assertBindings(binding)
    }) as DirectiveHook)

    const beforeUpdate = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      // node should not have been updated yet
      expect(el.childNodes[0].textContent).toBe(`${count.value - 1}`)

      assertBindings(binding)
    }) as DirectiveHook)

    const updated = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      // node should have been updated
      expect(el.childNodes[0].textContent).toBe(`${count.value}`)

      assertBindings(binding)
    }) as DirectiveHook)

    const beforeUnmount = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should be removed now
      expect(el.parentNode).toBe(host)
      expect(host.children[0]).toBe(el)

      assertBindings(binding)
    }) as DirectiveHook)

    const unmounted = vi.fn(((el, binding) => {
      expect(el.tagName).toBe('DIV')
      // should have been removed
      expect(el.parentNode).toBe(null)
      expect(host.children.length).toBe(0)

      assertBindings(binding)
    }) as DirectiveHook)

    const dir = {
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      beforeUnmount,
      unmounted,
    }

    let _instance: ComponentInternalInstance | null = null
    let _node: Node | null = null

    const Child = (props: { count: number }) => {
      _node = template('<div>')()
      renderEffect(() => {
        setText(_node!, props.count)
      })
      return _node
    }

    const Comp = {
      setup() {
        _instance = currentInstance
      },
      render() {
        _node = template('<div>')()
        return withDirectives(
          createComponent(Child, { count: () => count.value }),
          [
            [
              dir,
              // value
              () => count.value,
              // argument
              'foo',
              // modifiers
              { ok: true },
            ],
          ],
        )
      },
    }

    const { host, render } = define(Comp)
    render()

    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(mounted).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(beforeUpdate).toHaveBeenCalledTimes(1)
    expect(updated).toHaveBeenCalledTimes(1)

    render(null, host)
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
    const Comp: Component = {
      render() {
        return withDirectives(template('<div>')(), [[d2]])
      },
    }

    const App = {
      name: 'App',
      render() {
        return withDirectives(createComponent(Comp), [[d1]])
      },
    }

    define(App).render()
    expect(d1.mounted).toHaveBeenCalled()
    expect(d2.mounted).toHaveBeenCalled()
  })

  test('should disable tracking inside directive lifecycle hooks', async () => {
    const count = ref(0)
    const text = ref('')
    const beforeUpdate = vi.fn(() => count.value++)

    const App = {
      render() {
        const node = template('<p>')()
        renderEffect(() => {
          setText(node, text.value)
        })
        return withDirectives(node, [
          [
            {
              beforeUpdate,
            },
          ],
        ])
      },
    }

    define(App).render()
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

        return withDirectives(template('<p>')(), [
          [
            {
              mounted(el, { instance }) {
                res = instance.exposed!.msg
              },
            },
          ],
        ])
      },
    })
    define(App).render()
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
        return withDirectives(template('<div>')(), [[undefined], [d1]])
      },
    }

    define(App).render()
    expect(d1.mounted).toHaveBeenCalled()
  })
})
