import {
  Node,
  LVal,
  ObjectProperty,
  ObjectMethod,
  ObjectExpression,
  Expression
} from '@babel/types'
import { BindingTypes, isFunctionType } from '@vue/compiler-dom'
import { ScriptCompileContext } from './context'
import { inferRuntimeType, resolveTypeElements } from './resolveType'
import {
  resolveObjectKey,
  UNKNOWN_TYPE,
  concatStrings,
  isLiteralNode,
  isCallOf,
  unwrapTSNode,
  toRuntimeTypeString
} from './utils'
import { genModelProps } from './defineModel'
import { getObjectOrArrayExpressionKeys } from './analyzeScriptBindings'
import { processPropsDestructure } from './definePropsDestructure'

export const DEFINE_PROPS = 'defineProps'
export const WITH_DEFAULTS = 'withDefaults'

export interface PropTypeData {
  key: string
  type: string[]
  required: boolean
  skipCheck: boolean
}

export type PropsDestructureBindings = Record<
  string, // public prop key
  {
    local: string // local identifier, may be different
    default?: Expression
  }
>

export function processDefineProps(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal
) {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return processWithDefaults(ctx, node, declId)
  }

  if (ctx.hasDefinePropsCall) {
    ctx.error(`duplicate ${DEFINE_PROPS}() call`, node)
  }
  ctx.hasDefinePropsCall = true
  ctx.propsRuntimeDecl = node.arguments[0]

  // register bindings
  if (ctx.propsRuntimeDecl) {
    for (const key of getObjectOrArrayExpressionKeys(ctx.propsRuntimeDecl)) {
      if (!(key in ctx.bindingMetadata)) {
        ctx.bindingMetadata[key] = BindingTypes.PROPS
      }
    }
  }

  // call has type parameters - infer runtime types from it
  if (node.typeParameters) {
    if (ctx.propsRuntimeDecl) {
      ctx.error(
        `${DEFINE_PROPS}() cannot accept both type and non-type arguments ` +
          `at the same time. Use one or the other.`,
        node
      )
    }
    ctx.propsTypeDecl = node.typeParameters.params[0]
  }

  if (declId) {
    // handle props destructure
    if (declId.type === 'ObjectPattern') {
      processPropsDestructure(ctx, declId)
    } else {
      ctx.propsIdentifier = ctx.getString(declId)
    }
  }

  return true
}

function processWithDefaults(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal
): boolean {
  if (!isCallOf(node, WITH_DEFAULTS)) {
    return false
  }
  if (processDefineProps(ctx, node.arguments[0], declId)) {
    if (ctx.propsRuntimeDecl) {
      ctx.error(
        `${WITH_DEFAULTS} can only be used with type-based ` +
          `${DEFINE_PROPS} declaration.`,
        node
      )
    }
    if (ctx.propsDestructureDecl) {
      ctx.error(
        `${WITH_DEFAULTS}() is unnecessary when using destructure with ${DEFINE_PROPS}().\n` +
          `Prefer using destructure default values, e.g. const { foo = 1 } = defineProps(...).`,
        node.callee
      )
    }
    ctx.propsRuntimeDefaults = node.arguments[1]
    if (!ctx.propsRuntimeDefaults) {
      ctx.error(`The 2nd argument of ${WITH_DEFAULTS} is required.`, node)
    }
  } else {
    ctx.error(
      `${WITH_DEFAULTS}' first argument must be a ${DEFINE_PROPS} call.`,
      node.arguments[0] || node
    )
  }
  return true
}

export function genRuntimeProps(ctx: ScriptCompileContext): string | undefined {
  let propsDecls: undefined | string

  if (ctx.propsRuntimeDecl) {
    propsDecls = ctx.getString(ctx.propsRuntimeDecl).trim()
    if (ctx.propsDestructureDecl) {
      const defaults: string[] = []
      for (const key in ctx.propsDestructuredBindings) {
        const d = genDestructuredDefaultValue(ctx, key)
        if (d)
          defaults.push(
            `${key}: ${d.valueString}${
              d.needSkipFactory ? `, __skip_${key}: true` : ``
            }`
          )
      }
      if (defaults.length) {
        propsDecls = `${ctx.helper(
          `mergeDefaults`
        )}(${propsDecls}, {\n  ${defaults.join(',\n  ')}\n})`
      }
    }
  } else if (ctx.propsTypeDecl) {
    propsDecls = genRuntimePropsFromTypes(ctx)
  }

  const modelsDecls = genModelProps(ctx)

  if (propsDecls && modelsDecls) {
    return `${ctx.helper('mergeModels')}(${propsDecls}, ${modelsDecls})`
  } else {
    return modelsDecls || propsDecls
  }
}

function genRuntimePropsFromTypes(ctx: ScriptCompileContext) {
  // this is only called if propsTypeDecl exists
  const props = resolveRuntimePropsFromType(ctx, ctx.propsTypeDecl!)
  if (!props.length) {
    return
  }

  const propStrings: string[] = []
  const hasStaticDefaults = hasStaticWithDefaults(ctx)

  for (const prop of props) {
    propStrings.push(genRuntimePropFromType(ctx, prop, hasStaticDefaults))
    // register bindings
    if (!(prop.key in ctx.bindingMetadata)) {
      ctx.bindingMetadata[prop.key] = BindingTypes.PROPS
    }
  }

  let propsDecls = `{
    ${propStrings.join(',\n    ')}\n  }`

  if (ctx.propsRuntimeDefaults && !hasStaticDefaults) {
    propsDecls = `${ctx.helper('mergeDefaults')}(${propsDecls}, ${ctx.getString(
      ctx.propsRuntimeDefaults
    )})`
  }

  return propsDecls
}

function resolveRuntimePropsFromType(
  ctx: ScriptCompileContext,
  node: Node
): PropTypeData[] {
  const props: PropTypeData[] = []
  const elements = resolveTypeElements(ctx, node)
  for (const key in elements.props) {
    const e = elements.props[key]
    let type = inferRuntimeType(ctx, e)
    let skipCheck = false
    // skip check for result containing unknown types
    if (type.includes(UNKNOWN_TYPE)) {
      if (type.includes('Boolean') || type.includes('Function')) {
        type = type.filter(t => t !== UNKNOWN_TYPE)
        skipCheck = true
      } else {
        type = ['null']
      }
    }
    props.push({
      key,
      required: !e.optional,
      type: type || [`null`],
      skipCheck
    })
  }
  return props
}

function genRuntimePropFromType(
  ctx: ScriptCompileContext,
  { key, required, type, skipCheck }: PropTypeData,
  hasStaticDefaults: boolean
): string {
  let defaultString: string | undefined
  const destructured = genDestructuredDefaultValue(ctx, key, type)
  if (destructured) {
    defaultString = `default: ${destructured.valueString}${
      destructured.needSkipFactory ? `, skipFactory: true` : ``
    }`
  } else if (hasStaticDefaults) {
    const prop = (ctx.propsRuntimeDefaults as ObjectExpression).properties.find(
      node => {
        if (node.type === 'SpreadElement') return false
        return resolveObjectKey(node.key, node.computed) === key
      }
    ) as ObjectProperty | ObjectMethod
    if (prop) {
      if (prop.type === 'ObjectProperty') {
        // prop has corresponding static default value
        defaultString = `default: ${ctx.getString(prop.value)}`
      } else {
        defaultString = `${prop.async ? 'async ' : ''}${
          prop.kind !== 'method' ? `${prop.kind} ` : ''
        }default() ${ctx.getString(prop.body)}`
      }
    }
  }

  if (!ctx.options.isProd) {
    return `${key}: { ${concatStrings([
      `type: ${toRuntimeTypeString(type)}`,
      `required: ${required}`,
      skipCheck && 'skipCheck: true',
      defaultString
    ])} }`
  } else if (
    type.some(
      el =>
        el === 'Boolean' ||
        ((!hasStaticDefaults || defaultString) && el === 'Function')
    )
  ) {
    // #4783 for boolean, should keep the type
    // #7111 for function, if default value exists or it's not static, should keep it
    // in production
    return `${key}: { ${concatStrings([
      `type: ${toRuntimeTypeString(type)}`,
      defaultString
    ])} }`
  } else {
    // production: checks are useless
    return `${key}: ${defaultString ? `{ ${defaultString} }` : `{}`}`
  }
}

/**
 * check defaults. If the default object is an object literal with only
 * static properties, we can directly generate more optimized default
 * declarations. Otherwise we will have to fallback to runtime merging.
 */
function hasStaticWithDefaults(ctx: ScriptCompileContext) {
  return !!(
    ctx.propsRuntimeDefaults &&
    ctx.propsRuntimeDefaults.type === 'ObjectExpression' &&
    ctx.propsRuntimeDefaults.properties.every(
      node =>
        node.type !== 'SpreadElement' &&
        (!node.computed || node.key.type.endsWith('Literal'))
    )
  )
}

function genDestructuredDefaultValue(
  ctx: ScriptCompileContext,
  key: string,
  inferredType?: string[]
):
  | {
      valueString: string
      needSkipFactory: boolean
    }
  | undefined {
  const destructured = ctx.propsDestructuredBindings[key]
  const defaultVal = destructured && destructured.default
  if (defaultVal) {
    const value = ctx.getString(defaultVal)
    const unwrapped = unwrapTSNode(defaultVal)

    if (
      inferredType &&
      inferredType.length &&
      !inferredType.includes(UNKNOWN_TYPE)
    ) {
      const valueType = inferValueType(unwrapped)
      if (valueType && !inferredType.includes(valueType)) {
        ctx.error(
          `Default value of prop "${key}" does not match declared type.`,
          unwrapped
        )
      }
    }

    // If the default value is a function or is an identifier referencing
    // external value, skip factory wrap. This is needed when using
    // destructure w/ runtime declaration since we cannot safely infer
    // whether tje expected runtime prop type is `Function`.
    const needSkipFactory =
      !inferredType &&
      (isFunctionType(unwrapped) || unwrapped.type === 'Identifier')

    const needFactoryWrap =
      !needSkipFactory &&
      !isLiteralNode(unwrapped) &&
      !inferredType?.includes('Function')

    return {
      valueString: needFactoryWrap ? `() => (${value})` : value,
      needSkipFactory
    }
  }
}

// non-comprehensive, best-effort type infernece for a runtime value
// this is used to catch default value / type declaration mismatches
// when using props destructure.
function inferValueType(node: Node): string | undefined {
  switch (node.type) {
    case 'StringLiteral':
      return 'String'
    case 'NumericLiteral':
      return 'Number'
    case 'BooleanLiteral':
      return 'Boolean'
    case 'ObjectExpression':
      return 'Object'
    case 'ArrayExpression':
      return 'Array'
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'Function'
  }
}
