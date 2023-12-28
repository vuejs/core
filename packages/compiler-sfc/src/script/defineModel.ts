import type { LVal, Node, TSType } from '@babel/types'
import type { ScriptCompileContext } from './context'
import { inferRuntimeType } from './resolveType'
import {
  UNKNOWN_TYPE,
  concatStrings,
  isCallOf,
  toRuntimeTypeString,
} from './utils'
import { BindingTypes, unwrapTSNode } from '@vue/compiler-dom'

export const DEFINE_MODEL = 'defineModel'

export interface ModelDecl {
  type: TSType | undefined
  options: string | undefined
  identifier: string | undefined
}

export function processDefineModel(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal,
): boolean {
  if (!isCallOf(node, DEFINE_MODEL)) {
    return false
  }

  ctx.hasDefineModelCall = true

  const type =
    (node.typeParameters && node.typeParameters.params[0]) || undefined
  let modelName: string
  let options: Node | undefined
  const arg0 = node.arguments[0] && unwrapTSNode(node.arguments[0])
  if (arg0 && arg0.type === 'StringLiteral') {
    modelName = arg0.value
    options = node.arguments[1]
  } else {
    modelName = 'modelValue'
    options = arg0
  }

  if (ctx.modelDecls[modelName]) {
    ctx.error(`duplicate model name ${JSON.stringify(modelName)}`, node)
  }

  let optionsString = options && ctx.getString(options)
  let runtimeOptions = ''
  let transformOptions = ''

  if (options) {
    if (options.type === 'ObjectExpression') {
      for (let i = options.properties.length - 1; i >= 0; i--) {
        const p = options.properties[i]
        if (p.type === 'SpreadElement' || p.computed) {
          runtimeOptions = optionsString!
          break
        }
        if (
          (p.type === 'ObjectProperty' || p.type === 'ObjectMethod') &&
          ((p.key.type === 'Identifier' &&
            (p.key.name === 'get' || p.key.name === 'set')) ||
            (p.key.type === 'StringLiteral' &&
              (p.key.value === 'get' || p.key.value === 'set')))
        ) {
          transformOptions = ctx.getString(p) + ', ' + transformOptions

          // remove transform option from prop options to avoid duplicates
          const offset = p.start! - options.start!
          const next = options.properties[i + 1]
          const end = (next ? next.start! : options.end! - 1) - options.start!
          optionsString =
            optionsString.slice(0, offset) + optionsString.slice(end)
        }
      }
      if (!runtimeOptions && transformOptions) {
        runtimeOptions = `{ ${transformOptions} }`
      }
    } else {
      runtimeOptions = optionsString!
    }
  }

  ctx.modelDecls[modelName] = {
    type,
    options: optionsString,
    identifier:
      declId && declId.type === 'Identifier' ? declId.name : undefined,
  }
  // register binding type
  ctx.bindingMetadata[modelName] = BindingTypes.PROPS

  ctx.s.overwrite(
    ctx.startOffset! + node.start!,
    ctx.startOffset! + node.end!,
    `${ctx.helper('useModel')}(__props, ${JSON.stringify(modelName)}${
      runtimeOptions ? `, ${runtimeOptions}` : ``
    })`,
  )

  return true
}

export function genModelProps(ctx: ScriptCompileContext) {
  if (!ctx.hasDefineModelCall) return

  const isProd = !!ctx.options.isProd
  let modelPropsDecl = ''
  for (const [name, { type, options }] of Object.entries(ctx.modelDecls)) {
    let skipCheck = false

    let runtimeTypes = type && inferRuntimeType(ctx, type)
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
      skipCheck && 'skipCheck: true',
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

    // also generate modifiers prop
    const modifierPropName = JSON.stringify(
      name === 'modelValue' ? `modelModifiers` : `${name}Modifiers`,
    )
    modelPropsDecl += `\n    ${modifierPropName}: {},`
  }
  return `{${modelPropsDecl}\n  }`
}
