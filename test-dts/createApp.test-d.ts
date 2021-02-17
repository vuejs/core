import { App, Plugin } from './index'

declare const app: App

describe('plugin options', () => {
  interface PluginOptions {
    test: string
    num: number
    config: {
      t: string
    }
    c?: number
  }

  const plugin = {
    install(
      app: App,
      option: PluginOptions,
      other: { a: number; b?: string }
    ) {}
  }

  // @ts-expect-error needs options
  app.use(plugin)
  // @ts-expect-error invalid options provided
  app.use(plugin, {}, {})

  // @ts-expect-error invalid number of options
  app.use(plugin, {
    test: 'x',
    num: 1,
    config: {
      t: ''
    }
  })

  app.use(
    plugin,
    {
      test: 'x',
      num: 1,
      config: {
        t: ''
      }
    },
    { a: 1 }
  )

  //@ts-expect-error invalid option type
  app.use(
    plugin,
    {
      test: 'x',
      num: 1,
      config: {
        t: ''
      }
    },
    { a: '1' }
  )

  app.use(
    //@ts-expect-error invalid number of arguments
    plugin,
    {
      test: 'x',
      num: 1,
      config: {
        t: ''
      }
    },
    { a: 1 },
    'test'
  )
})

describe('plugin function', () => {
  const plugin = (app: App, config: { num: number; url: string }) => {}

  // @ts-expect-error no arguments
  app.use(plugin)

  // @ts-expect-error invalid arguments
  app.use(plugin, {})

  // @ts-expect-error invalid type
  app.use(plugin, {
    num: '',
    url: ''
  })

  app.use(plugin, {
    num: 1,
    url: ''
  })

  app.use(
    // @ts-expect-error too many arguments
    plugin,
    {
      num: 1,
      url: ''
    },
    true
  )
})

describe('no argument', () => {
  const plugin = (app: App) => {}

  app.use(plugin)

  // @ts-expect-error too many arguments
  app.use(plugin, {})
})

describe('using plugin type', () => {
  const plugin = ({} as unknown) as Plugin

  app.use(plugin)
  app.use(plugin, true)
  app.use(plugin, {})
  app.use(plugin, 1, 'string', {}, () => {})
})
