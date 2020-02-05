// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { compile, CompilerOptions, CompilerError } from '@vue/compiler-dom'
import { registerRuntimeCompiler, RenderFunction, warn } from '@vue/runtime-dom'
import * as runtimeDom from '@vue/runtime-dom'
import { isString, NOOP, generateCodeFrame } from '@vue/shared'

const compileCache: Record<string, RenderFunction> = Object.create(null)

function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions
): RenderFunction {
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML
    } else {
      __DEV__ && warn(`invalid template option: `, template)
      return NOOP
    }
  }

  const key = template
  const cached = compileCache[key]
  if (cached) {
    return cached
  }

  if (template[0] === '#') {
    const el = document.querySelector(template)
    if (__DEV__ && !el) {
      warn(`Template element not found or is empty: ${template}`)
    }
    template = el ? el.innerHTML : ``
  }

  const { code } = compile(template, {
    hoistStatic: true,
    onError(err: CompilerError) {
      if (__DEV__) {
        const message = `Template compilation error: ${err.message}`
        const codeFrame =
          err.loc &&
          generateCodeFrame(
            template as string,
            err.loc.start.offset,
            err.loc.end.offset
          )
        warn(codeFrame ? `${message}\n${codeFrame}` : message)
      } else {
        throw err
      }
    },
    ...options
  })

  const render = new Function('Vue', code)(runtimeDom) as RenderFunction
  return (compileCache[key] = render)
}

registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
export * from '@vue/runtime-dom'

import './devCheck'
