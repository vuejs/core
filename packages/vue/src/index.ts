// This package is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { compile as baseCompile, CompilerOptions } from '@vue/compiler-dom'
import { registerCompiler } from '@vue/runtime-dom'

export function compile(template: string, options?: CompilerOptions): Function {
  const { code } = baseCompile(template, options)
  return new Function(`with(this){return ${code}}`)
}

registerCompiler(compile)

export * from '@vue/runtime-dom'

if (__BROWSER__ && __DEV__) {
  console[console.info ? 'info' : 'log'](
    `You are running a development build of Vue.\n` +
      `Make sure to use the production build (*.prod.js) when deploying for production.`
  )
}
