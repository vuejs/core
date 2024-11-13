import { initCustomFormatter } from '@vue/runtime-dom'

if (__DEV__ && __BROWSER__) {
  /* istanbul ignore if */
  if (!__ESM_BUNDLER__) {
    console.info(
      `You are running a development build of Vue.\n` +
        `Make sure to use the production build (*.prod.js) when deploying for production.`,
    )
  }

  initCustomFormatter()
}

export * from '@vue/runtime-vapor'
