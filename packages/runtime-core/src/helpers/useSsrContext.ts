import { inject } from '../apiInject'
import { warn } from '../warning'

export const ssrContextKey = Symbol(__DEV__ ? `ssrContext` : ``)

export const useSSRContext = <T = Record<string, any>>() => {
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
