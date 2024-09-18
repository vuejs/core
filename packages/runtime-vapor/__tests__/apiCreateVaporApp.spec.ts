import {
  type ComponentInternalInstance,
  type Plugin,
  createComponent,
  createTextNode,
  createVaporApp,
  defineComponent,
  getCurrentInstance,
  inject,
  provide,
  resolveComponent,
  resolveDirective,
  withDirectives,
} from '../src'
import { warn } from '../src/warning'
import { makeRender } from './_utils'

const define = makeRender()

describe('api: createVaporApp', () => {
  test('mount', () => {
    const Comp = defineComponent({
      props: {
        count: { default: 0 },
      },
      setup(props) {
        return createTextNode(() => [props.count])
      },
    })

    const root1 = document.createElement('div')
    createVaporApp(Comp).mount(root1)
    expect(root1.innerHTML).toBe(`0`)
    //#5571 mount multiple apps to the same host element
    createVaporApp(Comp).mount(root1)
    expect(
      `There is already an app instance mounted on the host container`,
    ).toHaveBeenWarned()

    // mount with props
    const root2 = document.createElement('div')
    const app2 = createVaporApp(Comp, { count: () => 1 })
    app2.mount(root2)
    expect(root2.innerHTML).toBe(`1`)

    // remount warning
    const root3 = document.createElement('div')
    app2.mount(root3)
    expect(root3.innerHTML).toBe(``)
    expect(`already been mounted`).toHaveBeenWarned()
  })

  test('unmount', () => {
    const Comp = defineComponent({
      props: {
        count: { default: 0 },
      },
      setup(props) {
        return createTextNode(() => [props.count])
      },
    })

    const root = document.createElement('div')
    const app = createVaporApp(Comp)

    // warning
    app.unmount()
    expect(`that is not mounted`).toHaveBeenWarned()

    app.mount(root)

    app.unmount()
    expect(root.innerHTML).toBe(``)
  })

  test('provide', () => {
    const Root = define({
      setup() {
        // test override
        provide('foo', 3)
        return createComponent(Child)
      },
    })

    const Child = defineComponent({
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        try {
          inject('__proto__')
        } catch (e: any) {}
        return createTextNode(() => [`${foo},${bar}`])
      },
    })

    const { app, mount, create, host } = Root.create(null)
    app.provide('foo', 1)
    app.provide('bar', 2)
    mount()
    expect(host.innerHTML).toBe(`3,2`)
    expect('[Vue warn]: injection "__proto__" not found.').toHaveBeenWarned()

    const { app: app2 } = create()
    app2.provide('bar', 1)
    app2.provide('bar', 2)
    expect(`App already provides property with key "bar".`).toHaveBeenWarned()
  })

  test('runWithContext', () => {
    const { app } = define({
      setup() {
        provide('foo', 'should not be seen')
        return document.createElement('div')
      },
    }).create()
    app.provide('foo', 1)

    expect(app.runWithContext(() => inject('foo'))).toBe(1)

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
    const { app, mount, host } = define({
      setup() {
        const FooBar = resolveComponent('foo-bar')
        const BarBaz = resolveComponent('bar-baz')
        // @ts-expect-error TODO support string
        return [createComponent(FooBar), createComponent(BarBaz)]
      },
    }).create()

    const FooBar = () => createTextNode(['foobar!'])
    app.component('FooBar', FooBar)
    expect(app.component('FooBar')).toBe(FooBar)

    app.component('BarBaz', () => createTextNode(['barbaz!']))
    app.component('BarBaz', () => createTextNode(['barbaz!']))
    expect(
      'Component "BarBaz" has already been registered in target app.',
    ).toHaveBeenWarnedTimes(1)

    mount()
    expect(host.innerHTML).toBe(`foobar!barbaz!`)
  })

  test.todo('directive', () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()

    const { app, mount } = define({
      setup() {
        const FooBar = resolveDirective('foo-bar')
        const BarBaz = resolveDirective('bar-baz')
        return withDirectives(document.createElement('div'), [
          [FooBar],
          [BarBaz],
        ])
      },
    }).create()

    const FooBar = { mounted: spy1 }
    app.directive('FooBar', FooBar)
    expect(app.directive('FooBar')).toBe(FooBar)

    app.directive('BarBaz', { mounted: spy2 })
    app.directive('BarBaz', { mounted: spy2 })
    expect(
      'Directive "BarBaz" has already been registered in target app.',
    ).toHaveBeenWarnedTimes(1)

    mount()
    expect(spy1).toHaveBeenCalled()
    expect(spy2).toHaveBeenCalled()

    app.directive('bind', FooBar)
    expect(
      `Do not use built-in directive ids as custom directive id: bind`,
    ).toHaveBeenWarned()
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

    const { app, host, mount } = define({
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        return document.createTextNode(`${foo},${bar}`)
      },
    }).create()

    app.use(PluginA)
    app.use(PluginB, 1, 1)
    app.use(PluginC)

    mount()
    expect(host.innerHTML).toBe(`1,2`)

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

  test('config.errorHandler', () => {
    const error = new Error()
    let instance: ComponentInternalInstance

    const handler = vi.fn((err, _instance, info) => {
      expect(err).toBe(error)
      expect(_instance).toBe(instance)
      expect(info).toBe(`render function`)
    })

    const { app, mount } = define({
      setup() {
        instance = getCurrentInstance()!
      },
      render() {
        throw error
      },
    }).create()
    app.config.errorHandler = handler
    mount()
    expect(handler).toHaveBeenCalled()
  })

  test('config.warnHandler', () => {
    let instance: ComponentInternalInstance

    const handler = vi.fn((msg, _instance, trace) => {
      expect(msg).toMatch(`warn message`)
      expect(_instance).toBe(instance)
      expect(trace).toMatch(`Hello`)
    })

    const { app, mount } = define({
      name: 'Hello',
      setup() {
        instance = getCurrentInstance()!
        warn('warn message')
      },
    }).create()

    app.config.warnHandler = handler
    mount()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  describe('config.isNativeTag', () => {
    const isNativeTag = vi.fn(tag => tag === 'div')

    test('Component.name', () => {
      const { app, mount } = define({
        name: 'div',
        render(): any {},
      }).create()

      Object.defineProperty(app.config, 'isNativeTag', {
        value: isNativeTag,
        writable: false,
      })

      mount()
      expect(
        `Do not use built-in or reserved HTML elements as component id: div`,
      ).toHaveBeenWarned()
    })

    test('register using app.component', () => {
      const { app, mount } = define({
        render(): any {},
      }).create()

      Object.defineProperty(app.config, 'isNativeTag', {
        value: isNativeTag,
        writable: false,
      })

      app.component('div', () => createTextNode(['div']))
      mount()
      expect(
        `Do not use built-in or reserved HTML elements as component id: div`,
      ).toHaveBeenWarned()
    })
  })

  describe('config.performance', () => {
    afterEach(() => {
      window.performance.clearMeasures()
    })

    test('with performance enabled', () => {
      const { app, mount } = define({}).create()

      app.config.performance = true
      mount()
      expect(window.performance.getEntries()).lengthOf(2)
    })

    test('with performance disabled', () => {
      const { app, mount } = define({}).create()

      app.config.performance = false
      mount()
      expect(window.performance.getEntries()).lengthOf(0)
    })
  })

  test('config.globalProperty', () => {
    const { app, mount, html } = define({
      render() {
        const instance = getCurrentInstance()!
        return createTextNode([instance.appContext.config.globalProperties.msg])
      },
    }).create()
    app.config.globalProperties.msg = 'hello world'
    mount()
    expect(html()).toBe('hello world')
  })
})
