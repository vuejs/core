import {
  createApp,
  h,
  nodeOps,
  serializeInner,
  mockWarn,
  provide,
  inject,
  resolveComponent,
  resolveDirective,
  applyDirectives,
  Plugin,
  ref
} from '@vue/runtime-test'

describe('api: createApp', () => {
  mockWarn()

  test('mount', () => {
    const Comp = {
      props: {
        count: {
          default: 0
        }
      },
      render() {
        return this.count
      }
    }

    const root1 = nodeOps.createElement('div')
    createApp().mount(Comp, root1)
    expect(serializeInner(root1)).toBe(`0`)

    // mount with props
    const root2 = nodeOps.createElement('div')
    const app2 = createApp()
    app2.mount(Comp, root2, { count: 1 })
    expect(serializeInner(root2)).toBe(`1`)

    // remount warning
    const root3 = nodeOps.createElement('div')
    app2.mount(Comp, root3)
    expect(serializeInner(root3)).toBe(``)
    expect(`already been mounted`).toHaveBeenWarned()
  })

  test('provide', () => {
    const app = createApp()
    app.provide('foo', 1)
    app.provide('bar', 2)

    const Root = {
      setup() {
        // test override
        provide('foo', 3)
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        return () => `${foo},${bar}`
      }
    }

    const root = nodeOps.createElement('div')
    app.mount(Root, root)
    expect(serializeInner(root)).toBe(`3,2`)
  })

  test('component', () => {
    const app = createApp()
    app.component('FooBar', () => 'foobar!')
    app.component('BarBaz', () => 'barbaz!')

    const Root = {
      // local override
      components: {
        BarBaz: () => 'barbaz-local!'
      },
      setup() {
        // resolve in setup
        const FooBar = resolveComponent('foo-bar') as any
        return () => {
          // resolve in render
          const BarBaz = resolveComponent('bar-baz') as any
          return h('div', [h(FooBar), h(BarBaz)])
        }
      }
    }

    const root = nodeOps.createElement('div')
    app.mount(Root, root)
    expect(serializeInner(root)).toBe(`<div>foobar!barbaz-local!</div>`)
  })

  test('directive', () => {
    const app = createApp()

    const spy1 = jest.fn()
    const spy2 = jest.fn()
    const spy3 = jest.fn()
    app.directive('FooBar', {
      mounted: spy1
    })
    app.directive('BarBaz', {
      mounted: spy2
    })

    const Root = {
      // local override
      directives: {
        BarBaz: { mounted: spy3 }
      },
      setup() {
        // resolve in setup
        const FooBar = resolveDirective('foo-bar') as any
        return () => {
          // resolve in render
          const BarBaz = resolveDirective('bar-baz') as any
          return applyDirectives(h('div'), [[FooBar], [BarBaz]])
        }
      }
    }

    const root = nodeOps.createElement('div')
    app.mount(Root, root)
    expect(spy1).toHaveBeenCalled()
    expect(spy2).not.toHaveBeenCalled()
    expect(spy3).toHaveBeenCalled()
  })

  test('use', () => {
    const PluginA: Plugin = app => app.provide('foo', 1)
    const PluginB: Plugin = {
      install: app => app.provide('bar', 2)
    }

    const app = createApp()
    app.use(PluginA)
    app.use(PluginB)

    const Root = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        return () => `${foo},${bar}`
      }
    }
    const root = nodeOps.createElement('div')
    app.mount(Root, root)
    expect(serializeInner(root)).toBe(`1,2`)
  })

  test('config.errorHandler', () => {
    const app = createApp()

    const error = new Error()
    const count = ref(0)

    const handler = (app.config.errorHandler = jest.fn(
      (err, instance, info) => {
        expect(err).toBe(error)
        expect((instance as any).count).toBe(count.value)
        expect(info).toBe(`render function`)
      }
    ))

    const Root = {
      setup() {
        const count = ref(0)
        return {
          count
        }
      },
      render() {
        throw error
      }
    }

    app.mount(Root, nodeOps.createElement('div'))
    expect(handler).toHaveBeenCalled()
  })

  test('config.warnHandler', () => {
    const app = createApp()

    const handler = (app.config.warnHandler = jest.fn(
      (msg, instance, trace) => {}
    ))

    const Root = {
      setup() {}
    }

    app.mount(Root, nodeOps.createElement('div'))
    expect(handler).toHaveBeenCalled()
  })

  test.todo('mixin')

  test.todo('config.optionsMergeStrategies')
})
