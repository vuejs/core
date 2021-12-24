// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { initDev } from './dev'
import { compile, CompilerOptions, CompilerError } from '@vue/compiler-dom'
import { registerRuntimeCompiler, RenderFunction, warn } from '@vue/runtime-dom'
import * as runtimeDom from '@vue/runtime-dom'
import { isString, NOOP, generateCodeFrame, extend } from '@vue/shared'
import { InternalRenderFunction } from 'packages/runtime-core/src/component'

if (__DEV__) {
  initDev()
}

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
    // __UNSAFE__
    // Reason: potential execution of JS expressions in in-DOM template.
    // The user must make sure the in-DOM template is trusted. If it's rendered
    // by the server, the template should not contain any user data.
    template = el ? el.innerHTML : ``
  }

  const { code } = compile(
    template,
    extend(
      {
        hoistStatic: true,
        onError: __DEV__ ? onError : undefined,
        onWarn: __DEV__ ? e => onError(e, true) : NOOP
      } as CompilerOptions,
      options
    )
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
        err.loc.end.offset
      )
    warn(codeFrame ? `${message}\n${codeFrame}` : message)
  }

    // 这是code类型显示
  // 'const _Vue = Vue
  //   const { createVNode: _createVNode, createElementVNode: _createElementVNode } = _Vue
        // 这里放到顶层，因为这个静态数据，不会改变，二次掉用的时候直接调用缓存，内存优化
  //   const _hoisted_1 = /*#__PURE__*/_createElementVNode("h1", null, "i am mixins", -1 /* HOISTED */)

  //   return function render(_ctx, _cache) {
  //     with (_ctx) {
  //       const { createElementVNode: _createElementVNode, resolveComponent: _resolveComponent, createVNode: _createVNode, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock } = _Vue

  //       const _component_mymixins = _resolveComponent("mymixins")

  //       return (_openBlock(), _createElementBlock(_Fragment, null, [
  //         _hoisted_1, // 这里调用顶层的数据
  //         _createVNode(_component_mymixins) // 动态数据，重新加载创建vnode
  //       ], 64 /* STABLE_FRAGMENT */))
  //     }
  //   }'



  // The wildcard import results in a huge object with every export
  // with keys that cannot be mangled, and can be quite heavy size-wise.
  // In the global build we know `Vue` is available globally so we can avoid
  // the wildcard object.
  // __GLOBAL__为true的情况就说明vue在全局中存在，那么就可以通过执行new Function中入参的code，运行code（规定入参为字符串，但在函数内部会自动转成js代码） // 生成了vnode
  const render = (
    __GLOBAL__ ? new Function(code)() : new Function('Vue', code)(runtimeDom) // runtimeDom为了设置全局的环境
  ) as RenderFunction

  // mark the function as runtime compiled
  ;(render as InternalRenderFunction)._rc = true

  return (compileCache[key] = render)
}

registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
export * from '@vue/runtime-dom'
