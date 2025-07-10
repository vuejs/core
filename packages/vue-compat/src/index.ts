// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { createCompatVue } from './createCompatVue'
import {
  type CompilerError,
  type CompilerOptions,
  compile,
} from '@vue/compiler-dom'
import {
  type CompatVue,
  type RenderFunction,
  registerRuntimeCompiler,
  warn,
} from '@vue/runtime-dom'
import {
  NOOP,
  extend,
  genCacheKey,
  generateCodeFrame,
  isString,
} from '@vue/shared'
import type { InternalRenderFunction } from 'packages/runtime-core/src/component'
import * as runtimeDom from '@vue/runtime-dom'
import {
  DeprecationTypes,
  warnDeprecation,
} from '../../runtime-core/src/compat/compatConfig'

const compileCache: Record<string, RenderFunction> = Object.create(null)

function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions,
): RenderFunction {
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML
    } else {
      __DEV__ && warn(`invalid template option: `, template)
      return NOOP
    }
  }

  const key = genCacheKey(template, options)
  const cached = compileCache[key]
  if (cached) {
    return cached
  }

  if (template[0] === '#') {
    const el = document.querySelector(template)
    if (__DEV__ && !el) {
      warn(`Template element not found or is empty: ${template}`)
    }
    // __UNSAFE__
    // Reason: potential execution of JS expressions in in-DOM template.
    // The user must make sure the in-DOM template is trusted. If it's rendered
    // by the server, the template should not contain any user data.
    template = el ? el.innerHTML : ``
  }

  if (__DEV__ && !__TEST__ && (!options || !options.whitespace)) {
    warnDeprecation(DeprecationTypes.CONFIG_WHITESPACE, null)
  }

  const { code } = compile(
    template,
    extend(
      {
        hoistStatic: true,
        whitespace: 'preserve',
        onError: __DEV__ ? onError : undefined,
        onWarn: __DEV__ ? e => onError(e, true) : NOOP,
      } as CompilerOptions,
      options,
    ),
  )

  function onError(err: CompilerError, asWarning = false) {
    const message = asWarning
      ? err.message
      : `Template compilation error: ${err.message}`
    const codeFrame =
      err.loc &&
      generateCodeFrame(
        template as string,
        err.loc.start.offset,
        err.loc.end.offset,
      )
    warn(codeFrame ? `${message}\n${codeFrame}` : message)
  }

  // The wildcard import results in a huge object with every export
  // with keys that cannot be mangled, and can be quite heavy size-wise.
  // In the global build we know `Vue` is available globally so we can avoid
  // the wildcard object.
  const render = (
    __GLOBAL__ ? new Function(code)() : new Function('Vue', code)(runtimeDom)
  ) as RenderFunction

  // mark the function as runtime compiled
  ;(render as InternalRenderFunction)._rc = true

  return (compileCache[key] = render)
}

registerRuntimeCompiler(compileToFunction)

const Vue: CompatVue = createCompatVue()
Vue.compile = compileToFunction

export default Vue
