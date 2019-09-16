// This package is the "full-build" that includes both the runtime
// and the compiler. For now we are just exporting everything from the runtome
// AND the compiler.

// TODO hook up the runtime to compile templates on the fly

export * from '@vue/compiler-dom'
export * from '@vue/runtime-dom'

if (__FEATURE_PRODUCTION_TIP__) {
  console[console.info ? 'info' : 'log'](
    `You are running a development build of Vue.\n` +
      `Make sure to use the production build (*.prod.js) when deploying for production.`
  )
}
