import { ComponentInternalInstance, ComponentOptions, warn } from 'vue'
import { compile } from '@vue/compiler-ssr'
import { extend, generateCodeFrame, NO } from '@vue/shared'
import { CompilerError, CompilerOptions } from '@vue/compiler-core'
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
  if (!__NODE_JS__) {
    throw new Error(
      `On-the-fly template compilation is not supported in the ESM build of ` +
        `@vue/server-renderer. All templates must be pre-compiled into ` +
        `render functions.`
    )
  }

  // TODO: The cache does not take the compilerOptions into account
  const cached = compileCache[template]
  if (cached) {
    return cached
  }

  // TODO: This is copied from runtime-core/src/component.ts and should probably be refactored
  const Component = instance.type as ComponentOptions
  const { isCustomElement, compilerOptions } = instance.appContext.config
  const { delimiters, compilerOptions: componentCompilerOptions } = Component

  const finalCompilerOptions: CompilerOptions = extend(
    extend(
      {
        isCustomElement,
        delimiters
      },
      compilerOptions
    ),
    componentCompilerOptions
  )

  finalCompilerOptions.isCustomElement =
    finalCompilerOptions.isCustomElement || NO
  finalCompilerOptions.isNativeTag = finalCompilerOptions.isNativeTag || NO

  finalCompilerOptions.onError = (err: CompilerError) => {
    if (__DEV__) {
      const message = `[@vue/server-renderer] Template compilation error: ${err.message}`
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

  const { code } = compile(template, finalCompilerOptions)
  return (compileCache[template] = Function('require', code)(require))
}
