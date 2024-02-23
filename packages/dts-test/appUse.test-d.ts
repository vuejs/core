import { type App, type Plugin, createApp, defineComponent } from 'vue'

const app = createApp({})

// Plugin without types accept anything
const PluginWithoutType: Plugin = {
  install(app: App) {},
}

app.use(PluginWithoutType)
app.use(PluginWithoutType, 2)
app.use(PluginWithoutType, { anything: 'goes' }, true)

type PluginOptions = {
  option1?: string
  option2: number
  option3: boolean
}

const PluginWithObjectOptions = {
  install(app: App, options: PluginOptions) {
    options.option1
    options.option2
    options.option3
  },
}

for (const Plugin of [
  PluginWithObjectOptions,
  PluginWithObjectOptions.install,
]) {
  // @ts-expect-error: no params
  app.use(Plugin)

  // @ts-expect-error option2 and option3 (required) missing
  app.use(Plugin, {})
  // @ts-expect-error type mismatch
  app.use(Plugin, undefined)
  // valid options
  app.use(Plugin, { option2: 1, option3: true })
  app.use(Plugin, { option1: 'foo', option2: 1, option3: true })
}

const PluginNoOptions = {
  install(app: App) {},
}

for (const Plugin of [PluginNoOptions, PluginNoOptions.install]) {
  // no args
  app.use(Plugin)
  // @ts-expect-error unexpected plugin option
  app.use(Plugin, {})
  // @ts-expect-error only no options is valid
  app.use(Plugin, undefined)
}

const PluginMultipleArgs = {
  install: (app: App, a: string, b: number) => {},
}

for (const Plugin of [PluginMultipleArgs, PluginMultipleArgs.install]) {
  // @ts-expect-error: 2 arguments expected
  app.use(Plugin, 'hey')
  app.use(Plugin, 'hey', 2)
}

const PluginOptionalOptions = {
  install(
    app: App,
    options: PluginOptions = { option2: 2, option3: true, option1: 'foo' },
  ) {
    options.option1
    options.option2
    options.option3
  },
}

for (const Plugin of [PluginOptionalOptions, PluginOptionalOptions.install]) {
  // both version are valid
  app.use(Plugin)
  app.use(Plugin, undefined)

  // @ts-expect-error option2 and option3 (required) missing
  app.use(Plugin, {})
  // valid options
  app.use(Plugin, { option2: 1, option3: true })
  app.use(Plugin, { option1: 'foo', option2: 1, option3: true })
}

// still valid but it's better to use the regular function because this one can accept an optional param
const PluginTyped: Plugin<PluginOptions> = (app, options) => {}

// @ts-expect-error: needs options
app.use(PluginTyped)
app.use(PluginTyped, { option2: 2, option3: true })

// vuetify usage
const key: string = ''
const aliases: Record<string, any> = {}
app.component(
  key,
  defineComponent({
    ...aliases[key],
    name: key,
    aliasName: aliases[key].name,
  }),
)
