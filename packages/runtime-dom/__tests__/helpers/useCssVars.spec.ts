import {
  type ComponentOptions,
  type FunctionalComponent,
  Suspense,
  Teleport,
  Transition,
  createStaticVNode,
  createVNode,
  defineComponent,
  defineCustomElement,
  getCurrentInstance,
  h,
  nextTick,
  onMounted,
  onUpdated,
  reactive,
  ref,
  render,
  renderSlot,
  useCssVars,
  withCtx,
} from '@vue/runtime-dom'
import { compile } from '@vue/compiler-dom'
import * as runtimeDom from '@vue/runtime-dom'

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

  // #7312
  test.each([
    { disabled: false, defer: false },
    { disabled: true, defer: false },
    { disabled: false, defer: true },
    { disabled: true, defer: true },
  ])(
    'with teleport and transition (disabled: $disabled, defer: $defer)',
    async ({ disabled, defer }) => {
      document.body.innerHTML = ''
      const state = reactive({ color: 'red', width: '375px' })
      const show = ref(false)
      const root = document.createElement('div')
      const target = document.body
      target.appendChild(root)
      const App = {
        setup() {
          useCssVars(() => state)
          return () =>
            h('div', [
              h(Teleport, { to: target, disabled, defer }, [
                h(
                  Transition,
                  { css: false },
                  {
                    default: withCtx(() =>
                      show.value ? [h('div', { class: 'modal' })] : [],
                    ),
                  },
                ),
              ]),
            ])
        },
      }

      render(h(App), root)
      await nextTick()
      const container = disabled ? root : target
      expect(container.querySelector('.modal')).toBeNull()

      try {
        for (let i = 0; i < 2; i++) {
          show.value = true
          await nextTick()
          const modal = container.querySelector<HTMLElement>('.modal')!
          expect(modal).not.toBeNull()
          expect(modal.hasAttribute('data-v-owner')).toBe(true)
          expect(modal.style.getPropertyValue('--color')).toBe(state.color)
          expect(modal.style.getPropertyValue('--width')).toBe('375px')

          state.color = 'green'
          await nextTick()
          expect(modal.style.getPropertyValue('--color')).toBe('green')

          show.value = false
          await nextTick()
          expect(container.querySelector('.modal')).toBeNull()
        }
      } finally {
        render(null, root)
        root.remove()
      }
    },
  )

  test.each([
    { defer: false, ownerReadsOpen: false },
    { defer: true, ownerReadsOpen: false },
    { defer: false, ownerReadsOpen: true },
    { defer: true, ownerReadsOpen: true },
  ])(
    'applies css vars on first opening with a compiled teleport (defer: $defer, owner reads open: $ownerReadsOpen)',
    async ({ defer, ownerReadsOpen }) => {
      document.body.innerHTML = ''
      const root = document.createElement('div')
      document.body.appendChild(root)
      const open = ref(false)
      const width = ref('375px')
      const color = ref('red')
      const updated = vi.fn()
      let ownerId = ''
      // Stable compiled slots keep parent and transition updates independent.
      const { code } = compile(
        `<div>
          ${ownerReadsOpen ? '<p>{{ open }}</p>' : ''}
          <Teleport to="body"${defer ? ' defer' : ''}>
            <Transition :css="false">
              <div v-if="open" class="modal" />
            </Transition>
          </Teleport>
        </div>`,
        { prefixIdentifiers: true },
      )
      const App = {
        setup() {
          useCssVars(() => ({ width: width.value, color: color.value }))
          ownerId = String(getCurrentInstance()!.uid)
          onUpdated(updated)
          return { open }
        },
        render: new Function('Vue', code)(runtimeDom),
      }

      render(h(App), root)
      try {
        await nextTick()
        expect(document.body.querySelector('.modal')).toBeNull()
        let previous: HTMLElement | null = null
        for (let i = 0; i < 3; i++) {
          updated.mockClear()
          open.value = true
          await nextTick()
          const modal = document.body.querySelector<HTMLElement>('.modal')!
          expect(modal).not.toBeNull()
          expect(modal).not.toBe(previous)
          expect(modal.getAttribute('data-v-owner')).toBe(ownerId)
          expect(modal.style.getPropertyValue('--width')).toBe('375px')
          expect(modal.style.getPropertyValue('--color')).toBe('red')
          expect(updated).toHaveBeenCalledTimes(ownerReadsOpen ? 1 : 0)

          previous = modal
          open.value = false
          await nextTick()
          expect(document.body.querySelector('.modal')).toBeNull()
        }
      } finally {
        render(null, root)
        root.remove()
      }
    },
  )

  test('with teleport and a conditional slot root', async () => {
    document.body.innerHTML = ''
    const state = reactive({ color: 'red' })
    const show = ref(false)
    const root = document.createElement('div')
    const Child = defineComponent({
      render() {
        return renderSlot(this.$slots, 'default')
      },
    })
    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h('div', [
            h(Teleport, { to: document.body }, [
              h(Child, null, {
                default: withCtx(() =>
                  show.value ? [h('div', { class: 'slot-root' })] : [],
                ),
              }),
            ]),
          ])
      },
    }

    render(h(App), root)
    try {
      show.value = true
      await nextTick()
      const el = document.body.querySelector<HTMLElement>('.slot-root')!
      expect(el).not.toBeNull()
      expect(el.style.getPropertyValue('--color')).toBe('red')
    } finally {
      render(null, root)
    }
  })

  test('with teleport component roots after changing target and disabled', async () => {
    document.body.innerHTML = ''
    const root = document.createElement('div')
    const firstTarget = document.createElement('div')
    const secondTarget = document.createElement('div')
    document.body.append(root, firstTarget, secondTarget)
    const target = ref(firstTarget)
    const disabled = ref(false)
    const show = ref(false)
    const tag = ref('div')
    const state = reactive({ color: 'red' })
    const Inner = () => (show.value ? h(tag.value, { class: 'modal' }) : null)
    const Outer = () => [h(Inner)]
    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h('div', [
            h(Teleport, { to: target.value, disabled: disabled.value }, [
              h(Outer),
            ]),
          ])
      },
    }

    render(h(App), root)
    try {
      show.value = true
      await nextTick()
      expect(
        firstTarget
          .querySelector<HTMLElement>('.modal')!
          .style.getPropertyValue('--color'),
      ).toBe('red')

      target.value = secondTarget
      await nextTick()
      expect(firstTarget.querySelector('.modal')).toBeNull()
      tag.value = 'section'
      await nextTick()
      expect(
        secondTarget
          .querySelector<HTMLElement>('section')!
          .style.getPropertyValue('--color'),
      ).toBe('red')

      disabled.value = true
      await nextTick()
      expect(secondTarget.querySelector('.modal')).toBeNull()
      tag.value = 'article'
      await nextTick()
      expect(
        root
          .querySelector<HTMLElement>('article')!
          .style.getPropertyValue('--color'),
      ).toBe('red')

      disabled.value = false
      await nextTick()
      tag.value = 'aside'
      await nextTick()
      state.color = 'green'
      await nextTick()
      expect(
        secondTarget
          .querySelector<HTMLElement>('aside')!
          .style.getPropertyValue('--color'),
      ).toBe('green')
    } finally {
      render(null, root)
      root.remove()
      firstTarget.remove()
      secondTarget.remove()
    }
  })

  test('with an empty teleport', async () => {
    document.body.innerHTML = ''
    const root = document.createElement('div')
    const App = {
      setup() {
        useCssVars(() => ({ color: 'red' }))
        return () => createVNode(Teleport, { to: document.body })
      },
    }

    try {
      render(h(App), root)
      await nextTick()
      expect(document.body.querySelector('[data-v-owner]')).toBeNull()
    } finally {
      render(null, root)
    }
  })

  test('with teleport and suspense component roots', async () => {
    document.body.innerHTML = ''
    const root = document.createElement('div')
    const show = ref(true)
    const state = reactive({ color: 'red' })
    let resolve!: () => void
    const pending = new Promise<void>(r => {
      resolve = r
    })
    const asyncSetup = pending.then(
      () => () => (show.value ? h('div', { class: 'modal' }) : null),
    )
    const Async = { setup: () => asyncSetup }
    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h('div', [
            h(Teleport, { to: document.body }, [
              h(Suspense, null, { default: withCtx(() => h(Async)) }),
            ]),
          ])
      },
    }

    render(h(App), root)
    try {
      resolve()
      await asyncSetup.then(() => {})
      await nextTick()
      expect(
        document.body
          .querySelector<HTMLElement>('.modal')!
          .style.getPropertyValue('--color'),
      ).toBe('red')

      show.value = false
      await nextTick()
      expect(document.body.querySelector('.modal')).toBeNull()
      show.value = true
      await nextTick()
      expect(
        document.body
          .querySelector<HTMLElement>('.modal')!
          .style.getPropertyValue('--color'),
      ).toBe('red')
    } finally {
      render(null, root)
    }
  })

  test('does not refresh teleport css vars after the owner unmounts', async () => {
    document.body.innerHTML = ''
    const root = document.createElement('div')
    const show = ref(false)
    const getter = vi.fn(() => ({ color: 'red' }))
    const Child = {
      setup() {
        onUpdated(() => {
          render(null, root)
          getter.mockClear()
        })
        return () => (show.value ? h('div') : null)
      },
    }
    const App = {
      setup() {
        useCssVars(getter)
        return () => h('div', [h(Teleport, { to: document.body }, [h(Child)])])
      },
    }

    render(h(App), root)
    try {
      show.value = true
      await nextTick()
      expect(root.innerHTML).toBe('')
      expect(getter).not.toHaveBeenCalled()
    } finally {
      render(null, root)
    }
  })

  test.each([false, true])(
    'only refreshes teleport css vars when component roots change (fragment: %s)',
    async fragment => {
      document.body.innerHTML = ''
      const root = document.createElement('div')
      const target = document.createElement('div')
      document.body.appendChild(target)
      const text = ref('before')
      const tag = ref('div')
      const Child = () =>
        fragment
          ? [h(tag.value, text.value), h('b', 'stable')]
          : h(tag.value, text.value)
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () =>
            h('div', [
              h(Teleport, { to: target }, [h(Child)]),
              h(Teleport, { to: target }, [h(Child)]),
            ])
        },
      }

      render(h(App), root)
      await nextTick()
      const query = vi.spyOn(document, 'querySelectorAll')
      try {
        text.value = 'after'
        await nextTick()
        expect(target.textContent).toBe(
          fragment ? 'afterstableafterstable' : 'afterafter',
        )
        expect(query).not.toHaveBeenCalled()

        tag.value = 'span'
        await nextTick()
        const children = target.querySelectorAll('span')
        expect(children.length).toBe(2)
        for (const child of children) {
          expect(child.style.getPropertyValue('--color')).toBe('red')
        }
      } finally {
        query.mockRestore()
        render(null, root)
        target.remove()
      }
    },
  )

  test('does not refresh css vars again after teleport patches a new root', async () => {
    const root = document.createElement('div')
    const target = document.body.appendChild(document.createElement('div'))
    const text = ref('before')
    const tag = ref('div')
    const Child = defineComponent({
      props: { text: String },
      setup(props) {
        return () => h(tag.value, props.text)
      },
    })
    const App = {
      setup() {
        useCssVars(() => ({ color: 'red' }))
        return () =>
          h('div', [
            h(Teleport, { to: target }, [h(Child, { text: text.value })]),
          ])
      },
    }

    render(h(App), root)
    await nextTick()
    const oldRoot = target.querySelector('div')!
    const owner = oldRoot.getAttribute('data-v-owner')
    const query = vi.spyOn(document, 'querySelectorAll')
    try {
      text.value = 'after'
      tag.value = 'span'
      await nextTick()

      const newRoot = target.querySelector('span')!
      expect(newRoot).not.toBe(oldRoot)
      expect(newRoot.textContent).toBe('after')
      expect(newRoot.getAttribute('data-v-owner')).toBe(owner)
      expect(newRoot.style.getPropertyValue('--color')).toBe('red')
      // Teleport's patch and the owner's post-update refresh each query once.
      const ownerQueries = query.mock.calls.filter(
        ([selector]) => selector === `[data-v-owner="${owner}"]`,
      )
      expect(ownerQueries).toHaveLength(2)
    } finally {
      query.mockRestore()
      render(null, root)
      target.remove()
    }
  })

  test.each([false, true])(
    'with teleport transition after repeated toggles (initial: %s)',
    async initial => {
      document.body.innerHTML = ''
      const root = document.createElement('div')
      const show = ref(initial)
      const App = {
        setup() {
          useCssVars(() => ({ color: 'red' }))
          return () => [
            h(Teleport, { to: document.body }, [
              h(
                Transition,
                { css: false },
                {
                  default: withCtx(() =>
                    show.value ? [h('div', { class: 'modal' })] : [],
                  ),
                },
              ),
            ]),
          ]
        },
      }

      render(h(App), root)
      try {
        for (let i = 0; i < 4; i++) {
          show.value = !show.value
          await nextTick()
          const modal = document.body.querySelector<HTMLElement>('.modal')
          if (show.value) {
            expect(modal).not.toBeNull()
            expect(modal!.style.getPropertyValue('--color')).toBe('red')
          } else {
            expect(modal).toBeNull()
          }
        }
      } finally {
        render(null, root)
      }
    },
  )

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
