import {
  KeepAlive,
  Transition,
  createApp,
  h,
  nextTick,
  onDeactivated,
  onUnmounted,
  ref,
} from '../src'

describe('createApp for dom', () => {
  // #2926
  test('mount to SVG container', () => {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    createApp({
      render() {
        return h('g')
      },
    }).mount(root)
    expect(root.children.length).toBe(1)
    expect(root.children[0]).toBeInstanceOf(SVGElement)
  })

  // #4398
  test('should not mutate original root component options object', () => {
    const originalObj = {
      data() {
        return {
          counter: 0,
        }
      },
    }

    const handler = vi.fn(msg => {
      expect(msg).toMatch(`Component is missing template or render function`)
    })

    const Root = { ...originalObj }

    const app = createApp(Root)
    app.config.warnHandler = handler
    app.mount(document.createElement('div'))

    // ensure mount is based on a copy of Root object rather than Root object itself
    expect(app._component).not.toBe(Root)

    // ensure no mutation happened to Root object
    expect(originalObj).toMatchObject(Root)
  })

  test('Transition + KeepAlive', async () => {
    const deactivated = vi.fn()
    const unmounted = vi.fn()
    const CompA = {
      name: 'CompA',
      setup() {
        return () => h('h1', 'CompA')
      },
    }
    const CompB = {
      name: 'CompB',
      setup() {
        onDeactivated(deactivated)
        onUnmounted(unmounted)
        return () => h('h1', 'CompB')
      },
    }

    const current = ref('CompA')
    const cacheList = ref(['CompA', 'CompB'])
    const App = createApp({
      setup() {
        return () =>
          h(
            Transition,
            { mode: 'out-in' },
            {
              default: () => [
                h(
                  KeepAlive,
                  {
                    include: cacheList.value,
                  },
                  [current.value === 'CompA' ? h(CompA) : h(CompB)],
                ),
              ],
            },
          )
      },
    })
    App.mount(document.createElement('div'))
    current.value = 'CompB'
    await new Promise(resolve => setTimeout(resolve, 500))
    await nextTick()
    cacheList.value.splice(1)
    current.value = 'CompA'
    await nextTick()
    expect(deactivated).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
  })
})
