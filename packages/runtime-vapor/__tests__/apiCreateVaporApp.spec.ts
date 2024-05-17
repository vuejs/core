import { type Component, type Plugin, createVaporApp, inject } from '../src'
;``
describe('api: createApp', () => {
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

    const Root: Component = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        return document.createTextNode(`${foo},${bar}`)
      },
    }

    const app = createVaporApp(Root)
    app.use(PluginA)
    app.use(PluginB, 1, 1)
    app.use(PluginC)

    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe(`1,2`)

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
})
