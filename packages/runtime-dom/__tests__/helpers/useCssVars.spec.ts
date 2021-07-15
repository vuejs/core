import {
  ref,
  render,
  useCssVars,
  createStaticVNode,
  h,
  reactive,
  nextTick,
  ComponentOptions,
  Suspense,
  Transition
} from '@vue/runtime-dom'

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
          color: ctx.color
        }))
        return state
      },
      render() {
        return h('div')
      }
    }))
  })

  test('on fragment root', async () => {
    await assertCssVars(state => ({
      setup() {
        useCssVars(() => state)
        return () => [h('div'), h('div')]
      }
    }))
  })

  test('on HOCs', async () => {
    const Child = () => [h('div'), h('div')]

    await assertCssVars(state => ({
      setup() {
        useCssVars(() => state)
        return () => h(Child)
      }
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
      }
    }

    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h(Suspense, null, {
            default: h(AsyncComp),
            fallback: h('div', 'fallback')
          })
      }
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

  test('with subTree changed', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')

    const App = {
      setup() {
        useCssVars(() => state)
        return () => (value.value ? [h('div')] : [h('div'), h('div')])
      }
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
          h('div')
        ]
      }
    }

    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })

  test('with transition + v-if', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')

    const App = {
      setup() {
        useCssVars(() => state)
        return () =>
          h(Transition, null, {
            default: () => (value.value ? [h('div')] : [h('span')])
          })
      }
    }

    render(h(App), root)
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }

    value.value = false
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe('red')
    }
  })
})
