// This package is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { compile, CompilerOptions } from '@vue/compiler-dom'
import { registerRuntimeCompiler, RenderFunction, warn } from '@vue/runtime-dom'
import * as runtimeDom from '@vue/runtime-dom'
import { isString, NOOP } from '@vue/shared'

const idToTemplateCache = Object.create(null)

function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions
): RenderFunction {
  if (isString(template)) {
    if (template[0] === '#') {
      if (template in idToTemplateCache) {
        template = idToTemplateCache[template]
      } else {
        const el = document.querySelector(template)
        if (__DEV__ && !el) {
          warn(`Template element not found or is empty: ${template}`)
        }
        template = idToTemplateCache[template] = el ? el.innerHTML : ``
      }
    }
  } else if (template.nodeType) {
    template = template.innerHTML
  } else {
    __DEV__ && warn(`invalid template option: `, template)
    return NOOP
  }

  const { code } = compile(template as string, {
    hoistStatic: true,
    cacheHandlers: true,
    ...options
  })

  return new Function('Vue', code)(runtimeDom) as RenderFunction
}

registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
export * from '@vue/runtime-dom'

if (__BROWSER__ && __DEV__) {
  console[console.info ? 'info' : 'log'](
    `You are running a development build of Vue.\n` +
      `Make sure to use the production build (*.prod.js) when deploying for production.`
  )
}
