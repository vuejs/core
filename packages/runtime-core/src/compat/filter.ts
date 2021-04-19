import { App, AppContext } from '../apiCreateApp'
import { warn } from '../warning'
import { assertCompatEnabled, DeprecationTypes } from './compatConfig'

export function installGlobalFilterMethod(app: App, context: AppContext) {
  context.filters = {}
  app.filter = (name: string, filter?: Function): any => {
    assertCompatEnabled(DeprecationTypes.FILTERS, null)
    if (!filter) {
      return context.filters![name]
    }
    if (__DEV__ && context.filters![name]) {
      warn(`Filter "${name}" has already been registered.`)
    }
    context.filters![name] = filter
    return app
  }
}
