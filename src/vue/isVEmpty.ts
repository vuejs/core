import { App } from 'vue'
import { isEmpty } from '../utils/isEmpty'
import { IsEmptyOptions, IsVEmptyPlugin } from '../types'

export const IsVEmptyPlugin: IsVEmptyPlugin = {
  install(app: App, options: IsEmptyOptions = {}) {
    // Add global property
    app.config.globalProperties.$isEmpty = (value: any) => isEmpty(value, options)

    // Add directive
    app.directive('empty', {
      mounted(el, binding) {
        const value = binding.value
        el.dataset.empty = String(isEmpty(value, options))
      },
      updated(el, binding) {
        const value = binding.value
        el.dataset.empty = String(isEmpty(value, options))
      }
    })
  }
}
