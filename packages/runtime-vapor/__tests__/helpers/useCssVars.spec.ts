import {
  createComponent,
  createIf,
  createPlainElement,
  defineVaporComponent,
  defineVaporCustomElement,
  renderEffect,
  setStyle,
  template,
  useVaporCssVars,
} from '@vue/runtime-vapor'
import { nextTick, onMounted, reactive, ref } from '@vue/runtime-core'
import { makeRender } from '../_utils'
import type { VaporComponent } from '../../src/component'

const define = makeRender()

describe('useVaporCssVars', () => {
  async function assertCssVars(getApp: (state: any) => VaporComponent) {
    const state = reactive({ color: 'red' })
    const App = getApp(state)
    const root = document.createElement('div')

    define(App).render({}, root)
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
    const t0 = template('<div></div>')
    await assertCssVars(state => ({
      setup() {
        useVaporCssVars(() => state)
        const n0 = t0()
        return n0
      },
    }))
  })

  test('on multiple root', async () => {
    const t0 = template('<div></div>')
    await assertCssVars(state => ({
      setup() {
        useVaporCssVars(() => state)
        const n0 = t0()
        const n1 = t0()
        return [n0, n1]
      },
    }))
  })

  test('on HOCs', async () => {
    const t0 = template('<div></div>')
    const Child = defineVaporComponent({
      setup() {
        const n0 = t0()
        return n0
      },
    })
    await assertCssVars(state => ({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(Child)
      },
    }))
  })

  test.todo('on suspense root', async () => {})

  test.todo('with v-if & async component & suspense', async () => {})

  test('with subTree changes', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')
    const t0 = template('<div></div>')

    define({
      setup() {
        useVaporCssVars(() => state)
        const n0 = createIf(
          () => value.value,
          () => {
            const n2 = t0()
            return n2
          },
          () => {
            const n4 = t0()
            const n5 = t0()
            return [n4, n5]
          },
        )
        return n0
      },
    }).render({}, root)

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

  test('with subTree change inside HOC', async () => {
    const state = reactive({ color: 'red' })
    const value = ref(true)
    const root = document.createElement('div')

    const Child = defineVaporComponent({
      setup(_, { slots }) {
        return slots.default!()
      },
    })

    const t0 = template('<div></div>')
    define({
      setup() {
        useVaporCssVars(() => state)
        return createComponent(Child, null, {
          default: () => {
            return createIf(
              () => value.value,
              () => {
                const n2 = t0()
                return n2
              },
              () => {
                const n4 = t0()
                const n5 = t0()
                return [n4, n5]
              },
            )
          },
        })
      },
    }).render({}, root)

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

  test.todo('with teleport', async () => {})

  test.todo('with teleport in child slot', async () => {})

  test('with teleport(change subTree)', async () => {})

  test('with teleport(disabled)', async () => {})

  test('with string style', async () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    const disabled = ref(false)
    const t0 = template('<h1></h1>')

    define({
      setup() {
        useVaporCssVars(() => state)
        const n0 = t0() as any
        renderEffect(() =>
          setStyle(n0, state.color ? 'pointer-events: none' : undefined),
        )
        return n0
      },
    }).render({}, root)

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

    const Child = defineVaporComponent({
      setup() {
        onMounted(() => {
          const childEl = root.children[0]
          expect(getComputedStyle(childEl!).getPropertyValue(`--color`)).toBe(
            `red`,
          )
        })
        return template('<div id="childId"></div>')()
      },
    })

    define({
      setup() {
        useVaporCssVars(() => state)
        return createIf(
          () => value.value,
          () => createComponent(Child),
          () => template('<div></div>')(),
        )
      },
    }).render({}, root)

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

  test('with custom element', async () => {
    const state = reactive({ color: 'red' })
    const CE = defineVaporCustomElement({
      setup() {
        useVaporCssVars(() => state)
        return template('<div>hello</div>', true)()
      },
    })

    customElements.define('css-vars-ce', CE)

    const { html } = define({
      setup() {
        return createPlainElement('css-vars-ce', null, null, true)
      },
    }).render()

    expect(html()).toBe('<css-vars-ce style="--color: red;"></css-vars-ce>')

    state.color = 'green'
    await nextTick()
    expect(html()).toBe('<css-vars-ce style="--color: green;"></css-vars-ce>')
  })

  test('should set vars before child component onMounted hook', () => {
    const state = reactive({ color: 'red' })
    const root = document.createElement('div')
    let colorInOnMount

    define({
      setup() {
        useVaporCssVars(() => state)
        onMounted(() => {
          colorInOnMount = (
            root.children[0] as HTMLElement
          ).style.getPropertyValue(`--color`)
        })
        return template('<div></div>')()
      },
    }).render({}, root)

    expect(colorInOnMount).toBe(`red`)
  })
})
