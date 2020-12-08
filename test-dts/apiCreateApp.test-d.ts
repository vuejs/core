import { createApp, App } from './index'

describe('plugin params inference', () => {
  const app = createApp({})
  const pluginFunction = (
    app: App,
    param1: number,
    param2: { foo: string[] },
    param3?: boolean
  ) => {}
  const pluginObject = {
    install: (
      app: App,
      param1: number,
      param2: { foo: string[] },
      param3?: boolean
    ) => {}
  }
  class PluginClass {
    static install(
      app: App,
      param1: number,
      param2: { foo: string[] },
      param3?: boolean
    ) {}
  }

  // @ts-expect-error
  app.use(pluginFunction, 123, { foo: [123] })
  // no error
  app.use(pluginFunction, 123, { foo: ['asdf'] })

  // @ts-expect-error
  app.use(pluginObject, 123, { foo: [123] })
  // no error
  app.use(pluginObject, 123, { foo: ['asdf'] })

  // @ts-expect-error
  app.use(PluginClass, 123, { foo: [123] })
  // no error
  app.use(PluginClass, 123, { foo: ['asdf'] })
})
