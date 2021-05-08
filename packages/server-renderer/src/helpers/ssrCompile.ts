import { ComponentInternalInstance, warn } from 'vue'
import { compile } from '@vue/compiler-ssr'
import { generateCodeFrame, NO } from '@vue/shared'
import { CompilerError } from '@vue/compiler-core'
import { PushFn } from '../render'

type SSRRenderFunction = (
  context: any,
  push: PushFn,
  parentInstance: ComponentInternalInstance
) => void

const compileCache: Record<string, SSRRenderFunction> = Object.create(null)

export function ssrCompile(
  template: string,
  instance: ComponentInternalInstance
): SSRRenderFunction {
  const cached = compileCache[template]
  if (cached) {
    return cached
  }

  const { code } = compile(template, {
    isCustomElement:
      instance.appContext.config.compilerOptions.isCustomElement || NO,
    isNativeTag: instance.appContext.config.isNativeTag || NO,
    onError(err: CompilerError) {
      if (__DEV__) {
        const message = `[@vue/server-renderer] Template compilation error: ${
          err.message
        }`
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
    }
  })
  return (compileCache[template] = Function('require', code)(require))
}
