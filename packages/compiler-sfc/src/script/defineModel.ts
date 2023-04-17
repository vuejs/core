import { LVal, Node, ObjectProperty, TSType } from '@babel/types'
import { ScriptCompileContext } from './context'
import { inferRuntimeType } from './resolveType'
import {
  UNKNOWN_TYPE,
  concatStrings,
  isCallOf,
  toRuntimeTypeString,
  unwrapTSNode
} from './utils'
import { BindingTypes } from '@vue/compiler-dom'

export const DEFINE_MODEL = 'defineModel'

export interface ModelDecl {
  type: TSType | undefined
  options: string | undefined
  identifier: string | undefined
}

function doDefineModel(
  ctx: ScriptCompileContext,
  node: Node,
  type: TSType | undefined,
  modelName: string,
  options: Node | undefined,
  runtimeOptionsArray: string[],
  declId?: LVal
) {
  if (!ctx.options.defineModel || !isCallOf(node, DEFINE_MODEL)) {
    return false
  }
  if (ctx.modelDecls[modelName])
    ctx.error(`duplicate model name ${JSON.stringify(modelName)}`, node)

  const optionsString = options && ctx.getString(options)

  ctx.modelDecls[modelName] = {
    type,
    options: optionsString,
    identifier: declId && declId.type === 'Identifier' ? declId.name : undefined
  }
  // register binding type
  ctx.bindingMetadata[modelName] = BindingTypes.PROPS

  let runtimeOptions = ''
  if (options) {
    if (options.type === 'ObjectExpression') {
      const local = options.properties.find(
        p =>
          p.type === 'ObjectProperty' &&
          ((p.key.type === 'Identifier' && p.key.name === 'local') ||
            (p.key.type === 'StringLiteral' && p.key.value === 'local'))
      ) as ObjectProperty

      if (local) {
        runtimeOptions = `{ ${ctx.getString(local)} }`
      } else {
        for (const p of options.properties) {
          if (p.type === 'SpreadElement' || p.computed) {
            runtimeOptions = optionsString!
            break
          }
        }
      }
    } else {
      runtimeOptions = optionsString!
    }
  }

  if (runtimeOptions.length > 0) runtimeOptionsArray.push(runtimeOptions)
}

export function processDefineModel(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal
): boolean {
  if (!ctx.options.defineModel || !isCallOf(node, DEFINE_MODEL)) {
    return false
  }
  ctx.hasDefineModelCall = true
  const type =
    (node.typeParameters && node.typeParameters.params[0]) || undefined
  let modelName: string[] = []
  let options: Node[] = []
  const arg0 = node.arguments[0] && unwrapTSNode(node.arguments[0])
  let isArray = false

  if (arg0 && arg0.type === 'StringLiteral') {
    modelName.push(arg0.value)
    options.push(node.arguments[1])
  } else if (arg0 && arg0.type === 'ArrayExpression') {
    for (const e of arg0.elements) {
      if (e && e.type === 'StringLiteral') {
        modelName.push(e.value)
      }
    }
    options =
      node.arguments[1] && node.arguments[1].type === 'ArrayExpression'
        ? (node.arguments[1].elements as Node[])
        : options
    isArray = true
  } else {
    modelName.push('modelValue')
    options.push(arg0)
  }

  const runtimeOptionsArray: string[] = []

  for (let i = 0; i < modelName.length; i++) {
    if (ctx.modelDecls[modelName[i]])
      ctx.error(`duplicate model name ${JSON.stringify(modelName)}`, node)
    doDefineModel(
      ctx,
      node,
      type,
      modelName[i],
      options[i],
      runtimeOptionsArray,
      declId
    )
  }

  const optionStr = runtimeOptionsArray.join(',')

  ctx.s.overwrite(
    ctx.startOffset! + node.start!,
    ctx.startOffset! + node.end!,
    `${ctx.helper('useModel')}(__props, ${
      isArray ? JSON.stringify(modelName) : JSON.stringify(modelName[0])
    }${
      optionStr.length > 0
        ? isArray
          ? `[${optionStr}]`
          : `, ${optionStr}`
        : ''
    })`
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
