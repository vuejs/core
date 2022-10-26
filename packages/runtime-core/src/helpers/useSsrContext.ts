import { SSRContext } from '@vue/server-renderer'
import { inject } from '../apiInject'
import { warn } from '../warning'

export const ssrContextKey = Symbol(__DEV__ ? `ssrContext` : ``)

export const useSSRContext = <T = SSRContext>() => {
  if (!__GLOBAL__) {
    const ctx = inject<T>(ssrContextKey)
    if (!ctx) {
      warn(
        `Server rendering context not provided. Make sure to only call ` +
          `useSSRContext() conditionally in the server build.`
      )
    }
    return ctx
  } else if (__DEV__) {
    warn(`useSSRContext() is not supported in the global build.`)
  }
}
