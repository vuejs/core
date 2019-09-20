// This package is the "full-build" that includes both the runtime
// and the compiler. For now we are just exporting everything from the runtome
// AND the compiler.

// TODO hook up the runtime to compile templates on the fly

import { compile as baseCompile, CompilerOptions } from '@vue/compiler-dom'

export function compile(template: string, options?: CompilerOptions): Function {
  const { code } = baseCompile(template, options)
  return new Function(`with(this){return ${code}}`)
}

export * from '@vue/runtime-dom'

if (__BROWSER__ && __DEV__) {
  console[console.info ? 'info' : 'log'](
    `You are running a development build of Vue.\n` +
      `Make sure to use the production build (*.prod.js) when deploying for production.`
  )
}
