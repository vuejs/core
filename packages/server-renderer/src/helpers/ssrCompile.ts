import { ComponentInternalInstance, ComponentOptions, warn } from 'vue'
import { compile } from '@vue/compiler-ssr'
import { extend, generateCodeFrame, isFunction, NO } from '@vue/shared'
import { CompilerError, CompilerOptions } from '@vue/compiler-core'
import { PushFn } from '../render'

import * as Vue from 'vue'
import * as helpers from '../internal'

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
  // TODO: this branch should now work in ESM builds, enable it in a minor
  if (!__NODE_JS__) {
    throw new Error(
      `On-the-fly template compilation is not supported in the ESM build of ` +
        `@vue/server-renderer. All templates must be pre-compiled into ` +
        `render functions.`
    )
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

  const cacheKey = JSON.stringify(
    {
      template,
      compilerOptions: finalCompilerOptions
    },
    (key, value) => {
      return isFunction(value) ? value.toString() : value
    }
  )

  const cached = compileCache[cacheKey]
  if (cached) {
    return cached
  }

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
  const requireMap = {
    vue: Vue,
    'vue/server-renderer': helpers
  }
  const fakeRequire = (id: 'vue' | 'vue/server-renderer') => requireMap[id]
  return (compileCache[cacheKey] = Function('require', code)(fakeRequire))
}
