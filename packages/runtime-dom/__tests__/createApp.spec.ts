import {
  Fragment,
  createApp,
  createSSRApp,
  h,
  nextTick,
  ref,
  render,
} from '../src'

describe('createApp for dom', () => {
  test('clears unmanaged siblings when mounting normally', () => {
    const root = document.createElement('div')
    render(h('i', 'old'), root)
    root.append('outside')
    const app = createApp(() => h('b', 'B'))
    app.mount(root)
    expect(root.innerHTML).toBe('<b>B</b>')
    app.unmount()
  })

  test('mounts a fresh root when an SSR app replaces an app during cleanup', () => {
    const root = document.createElement('div')
    const first = createApp(() => h('i', 'A'))
    const replacement = createSSRApp(() => h('b', 'B'))
    first.onUnmount(() => replacement.mount(root))
    first.mount(root)
    first.unmount()
    expect('already an app instance mounted').toHaveBeenWarned()
    expect(root.innerHTML).toBe('<b>B</b>')
    replacement.unmount()
    expect(root.childNodes).toHaveLength(0)
  })

  // #16467
  test('a stale unmount leaves the replacement app in the container', () => {
    const root = document.createElement('div')
    const first = createApp(() => h('span', 'A'))
    const replacement = createApp(() => h('span', 'B'))
    const cleanup = vi.fn()
    first.onUnmount(cleanup)

    first.mount(root)
    first.unmount()
    replacement.mount(root)
    first.unmount()

    expect(root.innerHTML).toBe('<span>B</span>')
    expect(cleanup).toHaveBeenCalledOnce()
    expect('Cannot unmount an app that is not mounted').toHaveBeenWarned()
    replacement.unmount()
    expect(root.childNodes).toHaveLength(0)
  })

  test.each(['beforeUnmount', 'unmounted'] as const)(
    'preserves an app mounted in a component %s hook',
    async hook => {
      const root = document.createElement('div')
      const value = ref('B')
      const replacement = createApp(() => h('span', value.value))
      const mountReplacement = vi.fn().mockImplementationOnce(() => {
        replacement.mount(root)
      })
      const first = createApp({
        [hook]: mountReplacement,
        render: () => h(Fragment, [h('i', 'A'), h('b', 'A')]),
      })

      first.mount(root)
      first.unmount()
      expect(mountReplacement).toHaveBeenCalledOnce()
      expect(root.innerHTML).toBe('<span>B</span>')
      expect('already an app instance mounted').toHaveBeenWarned()

      value.value = 'updated'
      await nextTick()
      expect(root.innerHTML).toBe('<span>updated</span>')
      replacement.unmount()
      expect(root.childNodes).toHaveLength(0)
    },
  )

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
})
