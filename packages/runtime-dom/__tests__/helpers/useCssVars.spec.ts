import {
  ref,
  render,
  useCssVars,
  h,
  reactive,
  nextTick,
  ComponentOptions,
  Suspense
} from '@vue/runtime-dom'

describe('useCssVars', () => {
  async function assertCssVars(
    getApp: (state: any) => ComponentOptions,
    scopeId?: string
  ) {
    const state = reactive({ color: 'red' })
    const App = getApp(state)
    const root = document.createElement('div')
    const prefix = scopeId ? `${scopeId.replace(/^data-v-/, '')}-` : ``

    render(h(App), root)
    for (const c of [].slice.call(root.children as any)) {
      expect(
        (c as HTMLElement).style.getPropertyValue(`--${prefix}color`)
      ).toBe(`red`)
    }

    state.color = 'green'
    await nextTick()
    for (const c of [].slice.call(root.children as any)) {
      expect(
        (c as HTMLElement).style.getPropertyValue(`--${prefix}color`)
      ).toBe('green')
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

    const AsyncComp = {
      async setup() {
        return () => h('p', 'default')
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
    // css vars use with fallback tree
    for (const c of [].slice.call(root.children as any)) {
      expect((c as HTMLElement).style.getPropertyValue(`--color`)).toBe(`red`)
    }
    // AsyncComp resolve
    await nextTick()
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

  test('with <style scoped>', async () => {
    const id = 'data-v-12345'

    await assertCssVars(
      state => ({
        __scopeId: id,
        setup() {
          useCssVars(() => state, true)
          return () => h('div')
        }
      }),
      id
    )
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
})
