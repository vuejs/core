import type {
  ArrayExpression,
  Expression,
  LVal,
  Node,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
} from '@babel/types'
import { BindingTypes, isFunctionType, unwrapTSNode } from '@vue/compiler-dom'
import type { ScriptCompileContext } from './context'
import {
  type TypeResolveContext,
  inferRuntimeType,
  resolveTypeElements,
} from './resolveType'
import {
  UNKNOWN_TYPE,
  concatStrings,
  getEscapedPropName,
  isCallOf,
  isLiteralNode,
  resolveObjectKey,
  toRuntimeTypeString,
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

interface PropExtraData {
  // the object property node in the extra argument, for error reporting
  node: ObjectProperty
  values?: ArrayExpression
  validator?: ObjectProperty | ObjectMethod
}

type PropExtras = Record<string, PropExtraData>

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
  declId?: LVal,
  isWithDefaults = false,
): boolean {
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
        node,
      )
    }
    ctx.propsTypeDecl = node.typeParameters.params[0]
  }

  // handle props destructure
  if (!isWithDefaults && declId && declId.type === 'ObjectPattern') {
    processPropsDestructure(ctx, declId)
  }

  ctx.propsCall = node
  ctx.propsDecl = declId

  return true
}

function processWithDefaults(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal,
): boolean {
  if (!isCallOf(node, WITH_DEFAULTS)) {
    return false
  }
  if (
    !processDefineProps(
      ctx,
      node.arguments[0],
      declId,
      true /* isWithDefaults */,
    )
  ) {
    ctx.error(
      `${WITH_DEFAULTS}' first argument must be a ${DEFINE_PROPS} call.`,
      node.arguments[0] || node,
    )
  }

  if (ctx.propsRuntimeDecl) {
    ctx.error(
      `${WITH_DEFAULTS} can only be used with type-based ` +
        `${DEFINE_PROPS} declaration.`,
      node,
    )
  }
  if (declId && declId.type === 'ObjectPattern') {
    ctx.warn(
      `${WITH_DEFAULTS}() is unnecessary when using destructure with ${DEFINE_PROPS}().\n` +
        `Reactive destructure will be disabled when using withDefaults().\n` +
        `Prefer using destructure default values, e.g. const { foo = 1 } = defineProps(...). `,
      node.callee,
    )
  }
  ctx.propsRuntimeDefaults = node.arguments[1]
  if (!ctx.propsRuntimeDefaults) {
    ctx.error(`The 2nd argument of ${WITH_DEFAULTS} is required.`, node)
  }
  const extra = node.arguments[2]
  if (extra) {
    ctx.propsRuntimeExtra = extra
    validateWithDefaultsExtra(ctx, unwrapTSNode(extra))
  }
  ctx.propsCall = node

  return true
}

function validateWithDefaultsExtra(
  ctx: ScriptCompileContext,
  extra: Node,
): void {
  if (extra.type !== 'ObjectExpression') {
    ctx.error(
      `The 3rd argument of ${WITH_DEFAULTS} must be an object literal ` +
        `mapping props to "values" / "validator" options.`,
      extra,
    )
  }
  for (const prop of (extra as ObjectExpression).properties) {
    if (prop.type === 'SpreadElement') {
      ctx.error(
        `Spread elements are not allowed in the 3rd argument of ${WITH_DEFAULTS}.`,
        prop,
      )
    }
    const key = resolveObjectKey(prop.key, prop.computed)
    if (!key) {
      ctx.error(
        `Dynamic keys are not allowed in the 3rd argument of ${WITH_DEFAULTS}.`,
        prop,
      )
    }
    if (prop.type !== 'ObjectProperty') {
      ctx.error(
        `The extra option for prop "${key}" must be an object literal ` +
          `with "values" and/or "validator".`,
        prop,
      )
    }
    const value = unwrapTSNode(prop.value)
    if (value.type !== 'ObjectExpression') {
      ctx.error(
        `The extra option for prop "${key}" must be an object literal ` +
          `with "values" and/or "validator".`,
        value,
      )
    }
    for (const option of (value as ObjectExpression).properties) {
      if (option.type === 'SpreadElement') {
        ctx.error(
          `Spread elements are not allowed in extra options for prop "${key}".`,
          option,
        )
      }
      const optionKey = resolveObjectKey(option.key, option.computed)
      if (!optionKey) {
        ctx.error(
          `Dynamic keys are not allowed in extra options for prop "${key}".`,
          option,
        )
      }
      if (optionKey === 'values') {
        if (option.type !== 'ObjectProperty') {
          ctx.error(
            `"values" for prop "${key}" must be an array literal of literals.`,
            option,
          )
        }
        const values = unwrapTSNode(option.value)
        if (values.type !== 'ArrayExpression') {
          ctx.error(
            `"values" for prop "${key}" must be an array literal of literals.`,
            option.value,
          )
        }
        for (const el of values.elements) {
          const element = el && unwrapTSNode(el)
          if (
            !element ||
            !isLiteralNode(element) ||
            (element.type === 'TemplateLiteral' &&
              element.expressions.length > 0)
          ) {
            ctx.error(
              `"values" for prop "${key}" must only contain literal values.`,
              el || option.value,
            )
          }
        }
      } else if (optionKey === 'validator') {
        if (option.type === 'ObjectMethod') {
          if (option.kind !== 'method') {
            ctx.error(
              `"validator" for prop "${key}" must be a function or method ` +
                `shorthand.`,
              option,
            )
          }
        } else {
          const fn = unwrapTSNode(option.value)
          if (
            fn.type !== 'ArrowFunctionExpression' &&
            fn.type !== 'FunctionExpression'
          ) {
            ctx.error(
              `"validator" for prop "${key}" must be an inline function.`,
              option.value,
            )
          }
        }
      } else {
        ctx.error(
          `Unknown option "${optionKey}" in extra options for prop "${key}". ` +
            `Only "values" and "validator" are allowed.`,
          option,
        )
      }
    }
  }
}

export function genRuntimeProps(ctx: ScriptCompileContext): string | undefined {
  let propsDecls: undefined | string

  if (ctx.propsRuntimeDecl) {
    propsDecls = ctx.getString(ctx.propsRuntimeDecl).trim()
    if (ctx.propsDestructureDecl) {
      const defaults: string[] = []
      for (const key in ctx.propsDestructuredBindings) {
        const d = genDestructuredDefaultValue(ctx, key)
        const finalKey = getEscapedPropName(key)
        if (d)
          defaults.push(
            `${finalKey}: ${d.valueString}${
              d.needSkipFactory ? `, __skip_${finalKey}: true` : ``
            }`,
          )
      }
      if (defaults.length) {
        propsDecls = `/*@__PURE__*/${ctx.helper(
          `mergeDefaults`,
        )}(${propsDecls}, {\n  ${defaults.join(',\n  ')}\n})`
      }
    }
  } else if (ctx.propsTypeDecl) {
    propsDecls = extractRuntimeProps(ctx)
  }

  const modelsDecls = genModelProps(ctx)

  if (propsDecls && modelsDecls) {
    return `/*@__PURE__*/${ctx.helper(
      'mergeModels',
    )}(${propsDecls}, ${modelsDecls})`
  } else {
    return modelsDecls || propsDecls
  }
}

export function extractRuntimeProps(
  ctx: TypeResolveContext,
): string | undefined {
  // this is only called if propsTypeDecl exists
  const props = resolveRuntimePropsFromType(ctx, ctx.propsTypeDecl!)
  if (!props.length) {
    return
  }

  const propStrings: string[] = []
  const hasStaticDefaults = hasStaticWithDefaults(ctx)
  const extras = getPropExtras(ctx)
  if (extras) {
    const knownKeys = new Set(props.map(p => p.key))
    for (const key in extras) {
      if (!knownKeys.has(key)) {
        ctx.error(
          `Extra option key "${key}" has no corresponding prop declaration.`,
          extras[key].node,
        )
      }
    }
  }

  for (const prop of props) {
    propStrings.push(
      genRuntimePropFromType(ctx, prop, hasStaticDefaults, extras),
    )
    // register bindings
    if ('bindingMetadata' in ctx && !(prop.key in ctx.bindingMetadata)) {
      ctx.bindingMetadata[prop.key] = BindingTypes.PROPS
    }
  }

  let propsDecls = `{
    ${propStrings.join(',\n    ')}\n  }`

  if (ctx.propsRuntimeDefaults && !hasStaticDefaults) {
    propsDecls = `/*@__PURE__*/${ctx.helper(
      'mergeDefaults',
    )}(${propsDecls}, ${ctx.getString(ctx.propsRuntimeDefaults)})`
  }

  return propsDecls
}

function resolveRuntimePropsFromType(
  ctx: TypeResolveContext,
  node: Node,
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
      skipCheck,
    })
  }
  return props
}

function genRuntimePropFromType(
  ctx: TypeResolveContext,
  { key, required, type, skipCheck }: PropTypeData,
  hasStaticDefaults: boolean,
  extras?: PropExtras,
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
      },
    ) as ObjectProperty | ObjectMethod
    if (prop) {
      if (prop.type === 'ObjectProperty') {
        // prop has corresponding static default value
        defaultString = `default: ${ctx.getString(prop.value)}`
      } else {
        defaultString = `${prop.async ? 'async ' : ''}${
          prop.kind !== 'method' ? `${prop.kind} ` : ''
        }default(${getFunctionParamsSource(ctx, prop)}) ${ctx.getString(prop.body)}`
      }
    }
  }

  // validators are dev-only runtime checks - stripped in production
  const extra = extras && extras[key]
  const validatorString =
    extra && !ctx.options.isProd ? genValidatorString(ctx, extra) : undefined

  const finalKey = getEscapedPropName(key)
  if (!ctx.options.isProd) {
    return `${finalKey}: { ${concatStrings([
      `type: ${toRuntimeTypeString(type)}`,
      `required: ${required}`,
      skipCheck && 'skipCheck: true',
      defaultString,
      validatorString,
    ])} }`
  } else if (
    type.some(
      el =>
        el === 'Boolean' ||
        ((!hasStaticDefaults || defaultString) && el === 'Function'),
    )
  ) {
    // #4783 for boolean, should keep the type
    // #7111 for function, if default value exists or it's not static, should keep it
    // in production
    return `${finalKey}: { ${concatStrings([
      `type: ${toRuntimeTypeString(type)}`,
      defaultString,
    ])} }`
  } else {
    // #8989 for custom element, should keep the type
    if (ctx.isCE) {
      if (defaultString) {
        return `${finalKey}: ${`{ ${defaultString}, type: ${toRuntimeTypeString(
          type,
        )} }`}`
      } else {
        return `${finalKey}: {type: ${toRuntimeTypeString(type)}}`
      }
    }

    // production: checks are useless
    return `${finalKey}: ${defaultString ? `{ ${defaultString} }` : `{}`}`
  }
}

/**
 * check defaults. If the default object is an object literal with only
 * static properties, we can directly generate more optimized default
 * declarations. Otherwise we will have to fallback to runtime merging.
 */
function hasStaticWithDefaults(ctx: TypeResolveContext) {
  return !!(
    ctx.propsRuntimeDefaults &&
    ctx.propsRuntimeDefaults.type === 'ObjectExpression' &&
    ctx.propsRuntimeDefaults.properties.every(
      node =>
        node.type !== 'SpreadElement' &&
        (!node.computed || node.key.type.endsWith('Literal')),
    )
  )
}

/**
 * Collect validated `values` / `validator` options per prop key from the
 * 3rd argument of `withDefaults`. The structure has already been validated by
 * `validateWithDefaultsExtra`; invalid shapes are skipped defensively for
 * non-SFC callers of `extractRuntimeProps`.
 */
function getPropExtras(ctx: TypeResolveContext): PropExtras | undefined {
  if (!ctx.propsRuntimeExtra) return
  const extras: PropExtras = Object.create(null)
  for (const prop of (unwrapTSNode(ctx.propsRuntimeExtra) as ObjectExpression)
    .properties) {
    if (prop.type !== 'ObjectProperty') continue
    const key = resolveObjectKey(prop.key, prop.computed)
    if (!key) continue
    const value = unwrapTSNode(prop.value)
    if (value.type !== 'ObjectExpression') continue
    const entry: PropExtraData = { node: prop }
    for (const option of value.properties) {
      if (option.type === 'SpreadElement') continue
      const optionKey = resolveObjectKey(option.key, option.computed)
      if (optionKey === 'values' && option.type === 'ObjectProperty') {
        const values = unwrapTSNode(option.value)
        if (values.type === 'ArrayExpression') {
          entry.values = values
        }
      } else if (optionKey === 'validator') {
        entry.validator = option as ObjectProperty | ObjectMethod
      }
    }
    extras[key] = entry
  }
  return extras
}

/**
 * Generate the `validator` runtime option for a prop from its extra options.
 *
 * - `values` only: `validator: v => [...values].includes(v)`
 * - `validator` only: inlined as-is (method shorthand becomes a method)
 * - both: AND-merged via `&& (fn)(v, p)`, forwarding the `props` argument
 *   the runtime passes as the validator's second argument
 */
function genValidatorString(
  ctx: TypeResolveContext,
  extra: PropExtraData,
): string | undefined {
  const { values, validator } = extra
  if (!values && !validator) return

  const valuesString = values ? ctx.getString(values) : undefined

  if (validator) {
    if (validator.type === 'ObjectMethod') {
      const paramsString = getFunctionParamsSource(ctx, validator)
      if (valuesString) {
        const fnString = `${validator.async ? 'async ' : ''}(${paramsString}) => ${ctx.getString(validator.body)}`
        return `validator: (v, p) => ${valuesString}.includes(v) && (${fnString})(v, p)`
      }
      return `${validator.async ? 'async ' : ''}validator(${paramsString}) ${ctx.getString(validator.body)}`
    }
    const fnString = ctx.getString(unwrapTSNode(validator.value))
    if (valuesString) {
      return `validator: (v, p) => ${valuesString}.includes(v) && (${fnString})(v, p)`
    }
    return `validator: ${fnString}`
  }

  return `validator: v => ${valuesString}.includes(v)`
}

function getFunctionParamsSource(
  ctx: TypeResolveContext,
  fn: ObjectMethod,
): string {
  if (fn.params.length) {
    const start = fn.params[0].start
    const end = fn.params[fn.params.length - 1].end
    return ctx.getString({ start, end } as Node)
  }
  return ''
}

function genDestructuredDefaultValue(
  ctx: TypeResolveContext,
  key: string,
  inferredType?: string[],
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

    if (inferredType && inferredType.length && !inferredType.includes('null')) {
      const valueType = inferValueType(unwrapped)
      if (valueType && !inferredType.includes(valueType)) {
        ctx.error(
          `Default value of prop "${key}" does not match declared type.`,
          unwrapped,
        )
      }
    }

    // If the default value is a function or is an identifier referencing
    // external value, skip factory wrap. This is needed when using
    // destructure w/ runtime declaration since we cannot safely infer
    // whether the expected runtime prop type is `Function`.
    const needSkipFactory =
      !inferredType &&
      (isFunctionType(unwrapped) || unwrapped.type === 'Identifier')

    const needFactoryWrap =
      !needSkipFactory &&
      !isLiteralNode(unwrapped) &&
      !inferredType?.includes('Function')

    return {
      valueString: needFactoryWrap ? `() => (${value})` : value,
      needSkipFactory,
    }
  }
}

// non-comprehensive, best-effort type inference for a runtime value
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
