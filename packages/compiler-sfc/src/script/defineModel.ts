import { TSType } from '@babel/types'
import { ScriptCompileContext } from './context'
import { inferRuntimeType } from './resolveType'
import { UNKNOWN_TYPE, concatStrings, toRuntimeTypeString } from './utils'

export interface ModelDecl {
  type: TSType | undefined
  options: string | undefined
  identifier: string | undefined
}

export function genModels(ctx: ScriptCompileContext) {
  if (!ctx.hasDefineModelCall) return

  const isProd = !!ctx.options.isProd
  let modelPropsDecl = ''
  for (const [name, { type, options }] of Object.entries(ctx.modelDecls)) {
    let skipCheck = false

    let runtimeTypes = type && inferRuntimeType(type, ctx.declaredTypes)
    if (runtimeTypes) {
      const hasUnknownType = runtimeTypes.includes(UNKNOWN_TYPE)

      runtimeTypes = runtimeTypes.filter(el => {
        if (el === UNKNOWN_TYPE) return false
        return isProd
          ? el === 'Boolean' || (el === 'Function' && options)
          : true
      })
      skipCheck = !isProd && hasUnknownType && runtimeTypes.length > 0
    }

    let runtimeType =
      (runtimeTypes &&
        runtimeTypes.length > 0 &&
        toRuntimeTypeString(runtimeTypes)) ||
      undefined

    const codegenOptions = concatStrings([
      runtimeType && `type: ${runtimeType}`,
      skipCheck && 'skipCheck: true'
    ])

    let decl: string
    if (runtimeType && options) {
      decl = ctx.isTS
        ? `{ ${codegenOptions}, ...${options} }`
        : `Object.assign({ ${codegenOptions} }, ${options})`
    } else {
      decl = options || (runtimeType ? `{ ${codegenOptions} }` : '{}')
    }
    modelPropsDecl += `\n    ${JSON.stringify(name)}: ${decl},`
  }
  return `{${modelPropsDecl}\n  }`
}
