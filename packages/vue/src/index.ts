// TODO this package will be the "full-build" that includes both the runtime
// and the compiler
export * from '@vue/runtime-dom'

if (__FEATURE_PRODUCTION_TIP__) {
  console[console.info ? 'info' : 'log'](
    `You are running a development build of Vue.\n` +
      `Make sure to use the production build (*.prod.js) when deploying for production.`
  )
}
