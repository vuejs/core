import {
  type ComponentOptions,
  type FunctionalComponent,
  KeepAlive,
  Suspense,
  Teleport,
  Transition,
  createStaticVNode,
  defineCustomElement,
  h,
  nextTick,
  onMounted,
  reactive,
  ref,
  render,
  renderSlot,
  useCssVars,
  useShadowRoot,
  withMemo,
} from '@vue/runtime-dom'
import { TELEPORT_KEY } from '../../src/helpers/useCssVars'

describe('useCssVars', () => {
  async function assertCssVars(getApp: (state: any) => ComponentOptions) {
    const state = reactive({ color: 'red' })
    const App = getApp(state)
    const root = document.createElement('div')

    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('green')
    }
  }

  test('basic', async () => {
    await assertCssVars(state => ({
      setup() {
        // test receiving render context
        useCssVars((ctx: any) => ({
          color: ctx.color,
        }))
        return state
      },
      render() {
        return h('div')
      },
    }))
  })

  test('on fragment root', async () => {
    await assertCssVars(state => ({
      setup() {
        useCssVars(() => state)
        return () => [h('div'), h('div')]
      },
    }))
  })

  test('on HOCs', async () => {
    const Child = () => [h('div'), h('div')]

    await assertCssVars(state => ({
      setup() {
        useCssVars(() => state)
        return () => h(Child)
      },
    }))
  })

  test('on suspense root', async () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')

    let resolveAsync: any
    let asyncPromise: any

    const AsyncComp = {
      setup() {
        asyncPromise = new Promise(r => {
          resolveAsync = () => {
            r(() => h('p', 'default'))
          }
        })
        return asyncPromise
      },
    }

    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h(Suspense, null, {
            default: h(AsyncComp),
            fallback: h('div', 'fallback'),
          })
      },
    }

    render(h(App), root)
    await nextTick()
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }
    // AsyncComp resolve
    resolveAsync()
    await asyncPromise.then(() => {})
    // Suspense effects flush
    await nextTick()
    // css vars use with default tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('green')
    }
  })

  test('with v-if & async component & suspense', async () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const show = ref(false)
    let resolveAsync: any
    let asyncPromise: any

    const AsyncComp = {
      setup() {
        useCssVars(() => state)
        asyncPromise = new Promise(r => {
          resolveAsync = () => {
            r(() => h('p', 'default'))
          }
        })
        return asyncPromise
      },
    }

    const App = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h('div', {}, show.value ? h(AsyncComp) : h('p')),
          })
      },
    }

    render(h(App), root)
    await nextTick()
    // AsyncComp resolve
    show.value = true
    await nextTick()
    resolveAsync()
    await asyncPromise.then(() => {})
    // Suspense effects flush
    await nextTick()
    // css vars use with default tree
    for (const c of [].slice.call(root.children as any)) {
      expect(
        ((c as any).children[0] as HTMLElement).style.getPropertyValue(
          `--color`,
        ),
      ).toBe(`red`)
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect(
        ((c as any).children[0] as HTMLElement).style.getPropertyValue(
          `--color`,
        ),
      ).toBe('green')
    }
  })

  test('with subTree changed', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')

    const App = {
      setup() {
        useCssVars(() => state)
        return () => (value.value ? [h('div')] : [h('div'), h('div')])
      },
    }

    render(h(App), root)
    await nextTick()
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    value.value = false
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  // #3894
  test('with subTree change inside HOC', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')

    const Child: FunctionalComponent = (_, { slots }) => slots.default!()

    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h(Child, null, () =>
            value.value ? [h('div')] : [h('div'), h('div')],
          )
      },
    }

    render(h(App), root)
    await nextTick()
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    value.value = false
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with createStaticVNode', async () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')

    const App = {
      setup() {
        useCssVars(() => state)
        return () => [
          h('div'),
          createStaticVNode('<div>1</div><div><span>2</span></div>', 2),
          h('div'),
        ]
      },
    }

    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with teleport', async () => {
    document.body.innerHTML = ''
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const target = document.body

    const App = {
      setup() {
        useCssVars(() => state)
        return () => [h(Teleport, { to: target }, [h('div')])]
      },
    }

    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with teleport in child slot', async () => {
    document.body.innerHTML = ''
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const target = document.body

    const Child: FunctionalComponent = (_, { slots }) => {
      return h('div', slots.default && slots.default())
    }

    const App = {
      setup() {
        useCssVars(() => state)
        return () => h(Child, () => [h(Teleport, { to: target }, [h('div')])])
      },
    }

    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with teleport(change subTree)', async () => {
    document.body.innerHTML = ''
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const target = document.body
    const toggle = ref(false)

    const App = {
      setup() {
        useCssVars(() => state)
        return () => [
          h(Teleport, { to: target }, [
            h('div'),
            toggle.value ? h('div') : null,
          ]),
        ]
      },
    }

    render(h(App), root)
    await nextTick()
    expect(target.children.length).toBe(1)
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }

    toggle.value = true
    await nextTick()
    expect(target.children.length).toBe(2)
    for (const c of [].slice.call(target.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with teleport(disabled)', async () => {
    document.body.innerHTML = ''
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const target = document.body

    const App = {
      setup() {
        useCssVars(() => state)
        return () => [h(Teleport, { to: target, disabled: true }, [h('div')])]
      },
    }

    expect(() => render(h(App), root)).not.toThrow(TypeError)
    await nextTick()
    expect(target.children.length).toBe(0)
    expect(root.children[0].outerHTML.includes('data-v-owner')).toBe(true)
  })

  // #7312
  describe('teleport content replaced without patching the teleport', () => {
    const colorOf = (el: Element | null) =>
      (el as HTMLElement).style.getPropertyValue('--color')
    let root: HTMLElement
    const addTargets = () =>
      document.body.insertAdjacentHTML(
        'afterbegin',
        `<div id="a"></div><div id="b"></div>`,
      )

    beforeEach(() => {
      document.body.innerHTML = ''
      root = document.body.appendChild(document.createElement('div'))
    })

    afterEach(() => {
      render(null, root)
      vi.restoreAllMocks()
    })

    test.each([
      { disabled: false, defer: false },
      { disabled: true, defer: false },
      { disabled: false, defer: true },
    ])(
      'transition child (disabled: $disabled, defer: $defer)',
      async ({ disabled, defer }) => {
        const state = reactive({ color: 'red' })
        const show = ref(false)
        const App = {
          setup() {
            useCssVars(() => state)
            return () =>
              h('div', [
                h(Teleport, { to: 'body', disabled, defer }, [
                  h(Transition, { css: false }, () =>
                    show.value ? h('div', { class: 'modal' }) : null,
                  ),
                ]),
              ])
          },
        }

        render(h(App), root)
        await nextTick()

        show.value = true
        await nextTick()
        const modal = document.querySelector('.modal')
        expect(modal!.hasAttribute('data-v-owner')).toBe(true)
        expect(colorOf(modal)).toBe('red')

        state.color = 'green'
        await nextTick()
        expect(colorOf(modal)).toBe('green')

        show.value = false
        await nextTick()
        expect(document.querySelector('.modal')).toBeNull()

        show.value = true
        await nextTick()
        expect(colorOf(document.querySelector('.modal'))).toBe('green')
      },
    )

    test('slot outlet child', async () => {
      const show = ref(false)
      const Outlet: FunctionalComponent = (_, { slots }) =>
        renderSlot(slots, 'default')
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () =>
            h('div', [
              h(Teleport, { to: 'body' }, [
                h(Outlet, null, () =>
                  show.value ? [h('div', { class: 'modal' })] : [],
                ),
              ]),
            ])
        },
      }

      render(h(App), root)
      await nextTick()

      show.value = true
      await nextTick()
      expect(colorOf(document.querySelector('.modal'))).toBe('red')
    })

    test('child replacing its own root, across target and disabled changes', async () => {
      addTargets()
      const to = ref('#a')
      const disabled = ref(false)
      const tag = ref('div')
      const Child = () => h(tag.value, { class: 'modal' })
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () =>
            h('div', [
              h(Teleport, { to: to.value, disabled: disabled.value }, [
                h(Child),
              ]),
            ])
        },
      }

      render(h(App), root)
      await nextTick()

      tag.value = 'span'
      await nextTick()
      expect(colorOf(document.querySelector('#a > span.modal'))).toBe('red')

      to.value = '#b'
      await nextTick()
      tag.value = 'p'
      await nextTick()
      expect(colorOf(document.querySelector('#b > p.modal'))).toBe('red')

      disabled.value = true
      await nextTick()
      tag.value = 'section'
      await nextTick()
      expect(colorOf(root.querySelector('section.modal'))).toBe('red')

      disabled.value = false
      await nextTick()
      tag.value = 'article'
      await nextTick()
      expect(colorOf(document.querySelector('#b > article.modal'))).toBe('red')
    })

    test('suspense resolving inside the teleport', async () => {
      let resolve!: () => void
      const pending = new Promise<void>(r => (resolve = r))
      const Async = {
        async setup() {
          await pending
          return () => h('div', { class: 'modal' })
        },
      }
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () =>
            h('div', [
              h(Teleport, { to: 'body' }, [
                h(Suspense, null, {
                  default: () => h(Async),
                  fallback: () => h('i'),
                }),
              ]),
            ])
        },
      }

      render(h(App), root)
      await nextTick()

      resolve()
      await new Promise(r => setTimeout(r))
      expect(colorOf(document.querySelector('.modal'))).toBe('red')
    })

    test('kept-alive child reactivated after the vars changed', async () => {
      const state = reactive({ color: 'red' })
      const active = ref('A')
      const A = { render: () => h('div', { class: 'a' }) }
      const B = { render: () => h('div', { class: 'b' }) }
      const Switch = () =>
        h(KeepAlive, null, () => h(active.value === 'A' ? A : B))
      const App = {
        setup() {
          useCssVars(() => state)
          return () => h('div', [h(Teleport, { to: 'body' }, [h(Switch)])])
        },
      }

      render(h(App), root)
      await nextTick()
      expect(colorOf(document.querySelector('.a'))).toBe('red')

      active.value = 'B'
      await nextTick()
      state.color = 'green'
      await nextTick()
      expect(colorOf(document.querySelector('.b'))).toBe('green')

      active.value = 'A'
      await nextTick()
      expect(colorOf(document.querySelector('.a'))).toBe('green')
    })

    test('disabled teleport moved by KeepAlive', async () => {
      const show = ref(true)
      const tag = ref('div')
      const Child = () => h(tag.value, { class: 'modal' })
      const Owner = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () => h(Teleport, { to: 'body', disabled: true }, [h(Child)])
        },
      }
      const App = () => h(KeepAlive, null, () => (show.value ? h(Owner) : null))

      render(h(App), root)
      await nextTick()

      show.value = false
      await nextTick()
      show.value = true
      await nextTick()

      tag.value = 'span'
      await nextTick()
      expect(colorOf(root.querySelector('span.modal'))).toBe('red')
    })

    test.each([false, true])(
      'content inserted after the owner unmounted (pending suspense: %s)',
      async suspended => {
        const show = ref(true)
        const pending = ref(false)
        const getter = vi.fn(() => ({ color: 'red' }))
        const Owner = {
          setup() {
            useCssVars(getter)
            return () =>
              h('div', { class: 'owner' }, [
                h(Teleport, { to: 'body', disabled: true }, [h('span')]),
              ])
          },
        }
        // the leave never finishes, keeping the unmounted owner's root in place
        const Leaving = () =>
          h(
            Transition,
            { css: false, onLeave(_el: Element, _done: () => void) {} },
            () => (show.value ? h(Owner) : null),
          )
        const Async = {
          async setup() {
            await new Promise(() => {})
            return () => null
          },
        }
        const App = () =>
          suspended
            ? h(Suspense, null, {
                default: () =>
                  pending.value ? h(Async) : h('p', [h(Leaving)]),
              })
            : h(Leaving)

        render(h(App), root)
        await nextTick()

        // a pending suspense holds back the post effects of the retained
        // branch, including the one that flags the owner as unmounted
        pending.value = true
        await nextTick()
        show.value = false
        await nextTick()
        const el = root.querySelector('.owner')!
        getter.mockClear()

        const added = el.insertBefore(document.createElement('i'), el.lastChild)
        await nextTick()
        expect(getter).not.toHaveBeenCalled()
        expect(added.hasAttribute('data-v-owner')).toBe(false)
      },
    )

    test.each([false, true])(
      'root of a nested owner keeps its owner (moved by KeepAlive: %s)',
      async moved => {
        const state = reactive({ color: 'red' })
        const tag = ref('div')
        const show = ref(true)
        const Inner = {
          setup() {
            useCssVars(() => state)
            const cache: any[] = []
            return () =>
              withMemo(
                [tag.value],
                () =>
                  h(Teleport, { to: 'body', disabled: true }, [
                    h(tag.value, { class: 'modal' }),
                  ]),
                cache,
                0,
              )
          },
        }
        const Outer = {
          setup() {
            useCssVars(() => ({ size: '1px' }))
            return () =>
              h(Teleport, { to: 'body', disabled: moved }, [h(Inner)])
          },
        }
        const App = () =>
          h(KeepAlive, null, () => (show.value ? h(Outer) : null))

        render(h(App), root)
        await nextTick()
        tag.value = 'p'
        await nextTick()

        if (moved) {
          show.value = false
          await nextTick()
          show.value = true
          await nextTick()
        }

        state.color = 'green'
        await nextTick()
        expect(colorOf(document.querySelector('p.modal'))).toBe('green')
      },
    )

    test('looks the owner up once for roots replaced together', async () => {
      const show = ref(false)
      const Child = () => (show.value ? h('div', { class: 'modal' }) : null)
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () =>
            h('div', [
              h(Teleport, { to: 'body' }, [h(Child)]),
              h(Teleport, { to: 'body' }, [h(Child)]),
              h(Teleport, { to: 'body' }, [h(Child)]),
            ])
        },
      }

      render(h(App), root)
      await nextTick()
      const query = vi.spyOn(document, 'querySelectorAll')

      show.value = true
      await nextTick()
      const modals = document.querySelectorAll('.modal')
      expect(modals.length).toBe(3)
      modals.forEach(modal => expect(colorOf(modal)).toBe('red'))
      expect(
        query.mock.calls.filter(([selector]) =>
          selector.startsWith('[data-v-owner'),
        ).length,
      ).toBe(1)
    })

    test('stops observing a container once its teleports are gone', async () => {
      const target = document.body.appendChild(document.createElement('div'))
      const observe = vi.spyOn(MutationObserver.prototype, 'observe')
      const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
      const show = ref(true)
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () =>
            h('div', [
              show.value ? h(Teleport, { to: target }, [h('div')]) : null,
            ])
        },
      }

      render(h(App), root)
      await nextTick()
      const observer =
        observe.mock.contexts[
          observe.mock.calls.findIndex(([node]) => node === target)
        ]
      expect(observer).toBeDefined()

      show.value = false
      await nextTick()
      expect(disconnect.mock.contexts).toContain(observer)
    })

    test('an unmounted owner is not reachable from the anchors left in the dom', async () => {
      const show = ref(true)
      const Owner = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () => h(Teleport, { to: 'body', disabled: true }, [h('span')])
        },
      }
      // the anchors stay in the removed element, which outside code can hold
      const App = () =>
        show.value ? h('div', { class: 'kept' }, [h(Owner)]) : null

      render(h(App), root)
      await nextTick()
      const anchor = root.querySelector('.kept')!.firstChild as any
      const holdsFunction = (value: any, depth = 2): boolean =>
        typeof value === 'function' ||
        (depth > 0 &&
          value !== null &&
          typeof value === 'object' &&
          !(value instanceof Node) &&
          Object.values(value).some(v => holdsFunction(v, depth - 1)))
      expect(holdsFunction(anchor[TELEPORT_KEY])).toBe(true)

      show.value = false
      await nextTick()
      expect(holdsFunction(anchor[TELEPORT_KEY])).toBe(false)
    })

    test('observers of different owners share a callback that captures neither', async () => {
      const Original = MutationObserver
      const callbacks = new Map<Node, MutationCallback>()
      globalThis.MutationObserver = class extends Original {
        constructor(private callback: MutationCallback) {
          super(callback)
        }
        observe(target: Node, options?: MutationObserverInit) {
          callbacks.set(target, this.callback)
          super.observe(target, options)
        }
      }
      try {
        addTargets()
        const Owner = {
          props: ['to'],
          setup(props: { to: string }) {
            useCssVars(() => ({ color: 'red' }))
            return () => h('div', [h(Teleport, { to: props.to }, [h('span')])])
          },
        }

        render(h('div', [h(Owner, { to: '#a' }), h(Owner, { to: '#b' })]), root)
        await nextTick()
        const a = callbacks.get(document.querySelector('#a')!)
        expect(a).toBeDefined()
        expect(callbacks.get(document.querySelector('#b')!)).toBe(a)
      } finally {
        globalThis.MutationObserver = Original
      }
    })

    test('memoized teleport into the shadow root of a custom element', async () => {
      const state = reactive({ color: 'red' })
      const CE = defineCustomElement({
        setup() {
          useCssVars(() => state)
          const shadowRoot = useShadowRoot()!
          const cache: any[] = []
          return () =>
            h('div', [
              state.color,
              withMemo(
                [],
                () => h(Teleport, { to: shadowRoot }, [h('span')]),
                cache,
                0,
              ),
            ])
        },
      })
      customElements.define('css-vars-teleport-ce', CE)
      const el = document.body.appendChild(
        document.createElement('css-vars-teleport-ce'),
      )
      await nextTick()
      const teleported = el.shadowRoot!.querySelector('span')
      expect(colorOf(el)).toBe('red')

      state.color = 'green'
      await nextTick()
      expect(colorOf(el)).toBe('green')
      // out of reach for the owner lookup, so it has to keep inheriting from
      // the host
      expect(colorOf(teleported)).toBe('')

      el.remove()
      await nextTick()
      await nextTick()
    })
  })

  test('with string style', async () => {
    document.body.innerHTML = ''
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const disabled = ref(false)

    const App = {
      setup() {
        useCssVars(() => state)
        return () => [
          h(
            'div',
            { style: disabled.value ? 'pointer-events: none' : undefined },
            'foo',
          ),
        ]
      },
    }
    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
    disabled.value = true
    await nextTick()

    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with delay mount child', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(false)
    const root = document.createElement('div')

    const Child = {
      setup() {
        onMounted(() => {
          const childEl = root.children[0]
          expect(getComputedStyle(childEl!).getPropertyValue(`--color`)).toBe(
            `red`,
          )
        })
        return () => h('div', { id: 'childId' })
      },
    }
    const App = {
      setup() {
        useCssVars(() => state)
        return () => (value.value ? h(Child) : [h('span')])
      },
    }

    render(h(App), root)
    await nextTick()
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    // mount child
    value.value = true
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }
  })

  // #8826
  test('with custom element', async () => {
    const state = reactive({ color: 'red' })
    const container = document.createElement('div')
    const App = defineCustomElement({
      styles: [`div { color: red; }`],
      setup() {
        useCssVars(() => state)
        return () => {
          return h('div', 'hello')
        }
      },
    })
    customElements.define('css-vars-ce', App)
    container.innerHTML = `<css-vars-ce></css-vars-ce>`
    document.body.appendChild(container)
    await nextTick()
    expect(container.innerHTML).toBe(
      `<css-vars-ce style="--color: red;"></css-vars-ce>`,
    )
  })

  test('should set vars before child component onMount hook', () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    let colorInOnMount

    const App = {
      setup() {
        useCssVars(() => state)
        onMounted(() => {
          colorInOnMount = (
            root.children[0] as HTMLElement
          ).style.getPropertyValue(`--color`)
        })
        return () => h('div')
      },
    }

    render(h(App), root)
    expect(colorInOnMount).toBe(`red`)
  })

  test('should set vars as `initial` for nullish values', async () => {
    // `getPropertyValue` cannot reflect the real value for white spaces and JSDOM also
    // doesn't 100% reflect the real behavior of browsers, so we only keep the test for
    // `initial` value here.
    // The value normalization is tested in packages/shared/__tests__/cssVars.spec.ts.
    const state = reactive<Record<string, unknown>>({
      foo: undefined,
      bar: null,
    })
    const root = document.createElement('div')
    const App = {
      setup() {
        useCssVars(() => state)
        return () => h('div')
      },
    }
    render(h(App), root)
    await nextTick()
    const style = (root.children[0] as HTMLElement).style
    expect(style.getPropertyValue('--foo')).toBe('initial')
    expect(style.getPropertyValue('--bar')).toBe('initial')
  })
})
