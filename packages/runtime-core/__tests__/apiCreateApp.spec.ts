import {
  type Plugin,
  createApp,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  nextTick,
  nodeOps,
  onMounted,
  provide,
  ref,
  resolveComponent,
  resolveDirective,
  serializeInner,
  watch,
  withDirectives,
} from '@vue/runtime-test'

describe('api: createApp', () => {
  test('mount', () => {
    const Comp = defineComponent({
      props: {
        count: {
          default: 0,
        },
      },
      setup(props) {
        return () => props.count
      },
    })

    const root1 = nodeOps.createElement('div')
    createApp(Comp).mount(root1)
    expect(serializeInner(root1)).toBe(`0`)
    //#5571 mount multiple apps to the same host element
    createApp(Comp).mount(root1)
    expect(
      `There is already an app instance mounted on the host container`,
    ).toHaveBeenWarned()

    // mount with props
    const root2 = nodeOps.createElement('div')
    const app2 = createApp(Comp, { count: 1 })
    app2.mount(root2)
    expect(serializeInner(root2)).toBe(`1`)

    // remount warning
    const root3 = nodeOps.createElement('div')
    app2.mount(root3)
    expect(serializeInner(root3)).toBe(``)
    expect(`already been mounted`).toHaveBeenWarned()
  })

  test('unmount', () => {
    const Comp = defineComponent({
      props: {
        count: {
          default: 0,
        },
      },
      setup(props) {
        return () => props.count
      },
    })

    const root = nodeOps.createElement('div')
    const app = createApp(Comp)

    // warning
    app.unmount()
    expect(`that is not mounted`).toHaveBeenWarned()

    app.mount(root)

    app.unmount()
    expect(serializeInner(root)).toBe(``)
  })

  test('provide', () => {
    const Root = {
      setup() {
        // test override
        provide('foo', 3)
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        try {
          inject('__proto__')
        } catch (e: any) {}
        return () => `${foo},${bar}`
      },
    }

    const app = createApp(Root)
    app.provide('foo', 1)
    app.provide('bar', 2)

    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(serializeInner(root)).toBe(`3,2`)
    expect('[Vue warn]: injection "__proto__" not found.').toHaveBeenWarned()

    const app2 = createApp(Root)
    app2.provide('bar', 1)
    app2.provide('bar', 2)
    expect(`App already provides property with key "bar".`).toHaveBeenWarned()
  })

  test('runWithContext', () => {
    const app = createApp({
      setup() {
        provide('foo', 'should not be seen')

        // nested createApp
        const childApp = createApp({
          setup() {
            provide('foo', 'foo from child')
          },
        })

        childApp.provide('foo', 2)
        expect(childApp.runWithContext(() => inject('foo'))).toBe(2)

        return () => h('div')
      },
    })
    app.provide('foo', 1)

    expect(app.runWithContext(() => inject('foo'))).toBe(1)
    const root = nodeOps.createElement('div')
    app.mount(root)

    expect(
      app.runWithContext(() => {
        app.runWithContext(() => {})
        return inject('foo')
      }),
    ).toBe(1)

    // ensure the context is restored
    inject('foo')
    expect('inject() can only be used inside setup').toHaveBeenWarned()
  })

  test('component', () => {
    const Root = {
      // local override
      components: {
        BarBaz: () => 'barbaz-local!',
      },
      setup() {
        // resolve in setup
        const FooBar = resolveComponent('foo-bar')
        return () => {
          // resolve in render
          const BarBaz = resolveComponent('bar-baz')
          return h('div', [h(FooBar), h(BarBaz)])
        }
      },
    }

    const app = createApp(Root)

    const FooBar = () => 'foobar!'
    app.component('FooBar', FooBar)
    expect(app.component('FooBar')).toBe(FooBar)

    app.component('BarBaz', () => 'barbaz!')

    app.component('BarBaz', () => 'barbaz!')
    expect(
      'Component "BarBaz" has already been registered in target app.',
    ).toHaveBeenWarnedTimes(1)

    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(serializeInner(root)).toBe(`<div>foobar!barbaz-local!</div>`)
  })

  test('directive', () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const spy3 = vi.fn()

    const Root = {
      // local override
      directives: {
        BarBaz: { mounted: spy3 },
      },
      setup() {
        // resolve in setup
        const FooBar = resolveDirective('foo-bar')
        return () => {
          // resolve in render
          const BarBaz = resolveDirective('bar-baz')
          return withDirectives(h('div'), [[FooBar], [BarBaz]])
        }
      },
    }

    const app = createApp(Root)

    const FooBar = { mounted: spy1 }
    app.directive('FooBar', FooBar)
    expect(app.directive('FooBar')).toBe(FooBar)

    app.directive('BarBaz', {
      mounted: spy2,
    })

    app.directive('BarBaz', {
      mounted: spy2,
    })
    expect(
      'Directive "BarBaz" has already been registered in target app.',
    ).toHaveBeenWarnedTimes(1)

    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(spy1).toHaveBeenCalled()
    expect(spy2).not.toHaveBeenCalled()
    expect(spy3).toHaveBeenCalled()

    app.directive('bind', FooBar)
    expect(
      `Do not use built-in directive ids as custom directive id: bind`,
    ).toHaveBeenWarned()
  })

  test('mixin', () => {
    const calls: string[] = []
    const mixinA = {
      data() {
        return {
          a: 1,
        }
      },
      created(this: any) {
        calls.push('mixinA created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(3)
      },
      mounted() {
        calls.push('mixinA mounted')
      },
    }
    const mixinB = {
      name: 'mixinB',
      data() {
        return {
          b: 2,
        }
      },
      created(this: any) {
        calls.push('mixinB created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(3)
      },
      mounted() {
        calls.push('mixinB mounted')
      },
    }
    const Comp = {
      data() {
        return {
          c: 3,
        }
      },
      created(this: any) {
        calls.push('comp created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(3)
      },
      mounted() {
        calls.push('comp mounted')
      },
      render(this: any) {
        return `${this.a}${this.b}${this.c}`
      },
    }

    const app = createApp(Comp)
    app.mixin(mixinA)
    app.mixin(mixinB)

    app.mixin(mixinA)
    app.mixin(mixinB)
    expect(
      'Mixin has already been applied to target app',
    ).toHaveBeenWarnedTimes(2)
    expect(
      'Mixin has already been applied to target app: mixinB',
    ).toHaveBeenWarnedTimes(1)

    const root = nodeOps.createElement('div')
    app.mount(root)

    expect(serializeInner(root)).toBe(`123`)
    expect(calls).toEqual([
      'mixinA created',
      'mixinB created',
      'comp created',
      'mixinA mounted',
      'mixinB mounted',
      'comp mounted',
    ])
  })

  test('use', () => {
    const PluginA: Plugin = app => app.provide('foo', 1)
    const PluginB: Plugin = {
      install: (app, arg1, arg2) => app.provide('bar', arg1 + arg2),
    }
    class PluginC {
      someProperty = {}
      static install() {
        app.provide('baz', 2)
      }
    }
    const PluginD: any = undefined

    const Root = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        return () => `${foo},${bar}`
      },
    }

    const app = createApp(Root)
    app.use(PluginA)
    app.use(PluginB, 1, 1)
    app.use(PluginC)

    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(serializeInner(root)).toBe(`1,2`)

    app.use(PluginA)
    expect(
      `Plugin has already been applied to target app`,
    ).toHaveBeenWarnedTimes(1)

    app.use(PluginD)
    expect(
      `A plugin must either be a function or an object with an "install" ` +
        `function.`,
    ).toHaveBeenWarnedTimes(1)
  })

  test('onUnmount', () => {
    const cleanup = vi.fn().mockName('plugin cleanup')
    const PluginA: Plugin = app => {
      app.provide('foo', 1)
      app.onUnmount(cleanup)
    }
    const PluginB: Plugin = {
      install: (app, arg1, arg2) => {
        app.provide('bar', arg1 + arg2)
        app.onUnmount(cleanup)
      },
    }

    const app = createApp({
      render: () => `Test`,
    })
    app.use(PluginA)
    app.use(PluginB)

    const root = nodeOps.createElement('div')
    app.mount(root)

    //also can be added after mount
    app.onUnmount(cleanup)

    app.unmount()

    expect(cleanup).toHaveBeenCalledTimes(3)
  })

  test('config.errorHandler', () => {
    const error = new Error()
    const count = ref(0)

    const handler = vi.fn((err, instance, info) => {
      expect(err).toBe(error)
      expect(instance.count).toBe(count.value)
      expect(info).toBe(`render function`)
    })

    const Root = {
      setup() {
        const count = ref(0)
        return {
          count,
        }
      },
      render() {
        throw error
      },
    }

    const app = createApp(Root)
    app.config.errorHandler = handler
    app.mount(nodeOps.createElement('div'))
    expect(handler).toHaveBeenCalled()
  })

  test('config.warnHandler', () => {
    let ctx: any
    const handler = vi.fn((msg, instance, trace) => {
      expect(msg).toMatch(`Component is missing template or render function`)
      expect(instance).toBe(ctx.proxy)
      expect(trace).toMatch(`Hello`)
    })

    const Root = {
      name: 'Hello',
      setup() {
        ctx = getCurrentInstance()
      },
    }

    const app = createApp(Root)
    app.config.warnHandler = handler
    app.mount(nodeOps.createElement('div'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  describe('config.isNativeTag', () => {
    const isNativeTag = vi.fn(tag => tag === 'div')

    test('Component.name', () => {
      const Root = {
        name: 'div',
        render() {
          return null
        },
      }

      const app = createApp(Root)

      Object.defineProperty(app.config, 'isNativeTag', {
        value: isNativeTag,
        writable: false,
      })

      app.mount(nodeOps.createElement('div'))
      expect(
        `Do not use built-in or reserved HTML elements as component id: div`,
      ).toHaveBeenWarned()
    })

    test('Component.components', () => {
      const Root = {
        components: {
          div: () => 'div',
        },
        render() {
          return null
        },
      }

      const app = createApp(Root)
      Object.defineProperty(app.config, 'isNativeTag', {
        value: isNativeTag,
        writable: false,
      })

      app.mount(nodeOps.createElement('div'))
      expect(
        `Do not use built-in or reserved HTML elements as component id: div`,
      ).toHaveBeenWarned()
    })

    test('Component.directives', () => {
      const Root = {
        directives: {
          bind: () => {},
        },
        render() {
          return null
        },
      }

      const app = createApp(Root)
      app.mount(nodeOps.createElement('div'))
      expect(
        `Do not use built-in directive ids as custom directive id: bind`,
      ).toHaveBeenWarned()
    })

    test('register using app.component', () => {
      const app = createApp({
        render() {},
      })

      Object.defineProperty(app.config, 'isNativeTag', {
        value: isNativeTag,
        writable: false,
      })

      app.component('div', () => 'div')
      app.mount(nodeOps.createElement('div'))
      expect(
        `Do not use built-in or reserved HTML elements as component id: div`,
      ).toHaveBeenWarned()
    })
  })

  test('config.optionMergeStrategies', () => {
    let merged: string
    const App = defineComponent({
      render() {},
      mixins: [{ foo: 'mixin' }],
      extends: { foo: 'extends' },
      foo: 'local',
      beforeCreate() {
        merged = this.$options.foo
      },
    })

    const app = createApp(App)
    app.mixin({
      foo: 'global',
    })
    app.config.optionMergeStrategies.foo = (a, b) => (a ? `${a},` : ``) + b

    app.mount(nodeOps.createElement('div'))
    expect(merged!).toBe('global,extends,mixin,local')
  })

  test('config.globalProperties', () => {
    const app = createApp({
      render() {
        return this.foo
      },
    })
    app.config.globalProperties.foo = 'hello'
    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(serializeInner(root)).toBe('hello')
  })

  test('config.throwUnhandledErrorInProduction', () => {
    __DEV__ = false
    try {
      const err = new Error()
      const app = createApp({
        setup() {
          throw err
        },
      })
      app.config.throwUnhandledErrorInProduction = true
      const root = nodeOps.createElement('div')
      expect(() => app.mount(root)).toThrow(err)
    } finally {
      __DEV__ = true
    }
  })

  test('return property "_" should not overwrite "ctx._", __isScriptSetup: false', () => {
    const Comp = defineComponent({
      setup() {
        return {
          _: ref(0), // return property "_" should not overwrite "ctx._"
        }
      },
      render() {
        return h('input', {
          ref: 'input',
        })
      },
    })

    const root1 = nodeOps.createElement('div')
    createApp(Comp).mount(root1)

    expect(
      `setup() return property "_" should not start with "$" or "_" which are reserved prefixes for Vue internals.`,
    ).toHaveBeenWarned()
  })

  test('return property "_" should not overwrite "ctx._", __isScriptSetup: true', () => {
    const Comp = defineComponent({
      setup() {
        return {
          _: ref(0), // return property "_" should not overwrite "ctx._"
          __isScriptSetup: true, // mock __isScriptSetup = true
        }
      },
      render() {
        return h('input', {
          ref: 'input',
        })
      },
    })

    const root1 = nodeOps.createElement('div')
    const app = createApp(Comp).mount(root1)

    // trigger
    app.$refs.input

    expect(
      `TypeError: Cannot read property '__isScriptSetup' of undefined`,
    ).not.toHaveBeenWarned()
  })

  // #10005
  test('flush order edge case on nested createApp', async () => {
    const order: string[] = []
    const App = defineComponent({
      setup(props) {
        const message = ref('m1')
        watch(
          message,
          () => {
            order.push('post watcher')
          },
          { flush: 'post' },
        )
        onMounted(() => {
          message.value = 'm2'
          createApp(() => '').mount(nodeOps.createElement('div'))
        })
        return () => {
          order.push('render')
          return h('div', [message.value])
        }
      },
    })

    createApp(App).mount(nodeOps.createElement('div'))
    await nextTick()
    expect(order).toMatchObject(['render', 'render', 'post watcher'])
  })

  // config.compilerOptions is tested in packages/vue since it is only
  // supported in the full build.
})
