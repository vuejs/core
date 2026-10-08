import {
  BindingTypes,
  type SimpleExpressionNode,
  TS_NODE_TYPES,
  isFnExpression,
  isMemberExpression,
} from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import {
  type IREffect,
  IRNodeTypes,
  type IRProp,
  type OperationNode,
  type SetDynamicEventsIRNode,
  type SetEventIRNode,
} from '../ir'
import { genExpression, genVarName } from './expression'
import {
  type CodeFragment,
  DELIMITERS_OBJECT_NEWLINE,
  NEWLINE,
  buildCodeFragment,
  genCall,
  genMulti,
} from './utils'
import { isArray } from '@vue/shared'

export function genSetEvent(
  oper: SetEventIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { element, key, keyOverride, value, modifiers, delegate, effect } = oper

  let handler: CodeFragment[] | undefined

  if (delegate) {
    // key is static
    context.delegates.add(key.content)
    // if this is the only delegated event of this name on this element,
    // we can generate optimized handler attachment code
    // e.g. n1.$evtclick = () => {}
    if (!context.block.operation.some(isSameDelegateEvent)) {
      return [
        NEWLINE,
        `n${element}.$evt${key.content} = `,
        ...genDirectHandler(),
      ]
    }
  }

  const name = genName()
  const eventOptions = genEventOptions()
  return [
    NEWLINE,
    ...genCall(
      helper(effect ? 'onBinding' : delegate ? 'delegate' : 'on'),
      `n${element}`,
      name,
      genHandler(),
      eventOptions,
    ),
  ]

  function genHandler(): CodeFragment[] {
    return (handler ||= genEventHandler(context, [value], modifiers, {
      hoisted: oper,
    }))
  }

  function genInvoker(): CodeFragment[] {
    return [`${helper('createInvoker')}(`, ...genHandler(), `)`]
  }

  function genDirectHandler(): CodeFragment[] {
    return modifiers.keys.length || modifiers.nonKeys.length
      ? genEventHandler(context, [value], modifiers, {
          modifierHelper: 'vapor',
        })
      : genInvoker()
  }

  function genName(): CodeFragment[] {
    const expr = genExpression(key, context)
    if (keyOverride) {
      const find = JSON.stringify(keyOverride[0])
      const replacement = JSON.stringify(keyOverride[1])
      const wrapped: CodeFragment[] = ['(', ...expr, ')']
      return [...wrapped, ` === ${find} ? ${replacement} : `, ...wrapped]
    } else {
      return genExpression(key, context)
    }
  }

  function genEventOptions(): CodeFragment[] | undefined {
    let { options } = modifiers
    if (!options.length) return

    return genMulti(
      DELIMITERS_OBJECT_NEWLINE,
      ...options.map((option): CodeFragment[] => [`${option}: true`]),
    )
  }

  function isSameDelegateEvent(op: OperationNode) {
    if (
      op.type === IRNodeTypes.SET_EVENT &&
      op !== oper &&
      op.delegate &&
      op.element === oper.element &&
      op.key.content === key.content
    ) {
      return true
    }
  }
}

export function genSetDynamicEvents(
  oper: SetDynamicEventsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  return [
    NEWLINE,
    ...genCall(
      helper('setDynamicEvents'),
      `n${oper.element}`,
      genExpression(oper.event, context),
    ),
  ]
}

const hoistedHandlers = new WeakMap<IRProp | SetEventIRNode, string>()

// a handler bound inside a render effect (merged into its dynamic props, or
// under a dynamic event name) runs on its event, not on render, so it is
// declared ahead of the effect, which would otherwise put the values it caches
// into the handler body. #15725
export function genHoistedHandlers(
  effects: IREffect[],
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const declare = (
    node: IRProp | SetEventIRNode,
    key: SimpleExpressionNode,
    values: (SimpleExpressionNode | undefined)[],
    modifiers: SetEventIRNode['modifiers'] | undefined,
  ) => {
    const name = getUniqueHandlerName(
      context,
      `_on_${key.content.replace(/-/g, '_')}`,
    )
    hoistedHandlers.set(node, name)
    push(
      NEWLINE,
      `const ${name} = `,
      ...genEventHandler(context, values, modifiers),
    )
  }
  for (const { operations } of effects) {
    for (const oper of operations) {
      if (oper.type === IRNodeTypes.SET_EVENT) {
        declare(oper, oper.key, [oper.value], oper.modifiers)
      } else if (oper.type === IRNodeTypes.SET_DYNAMIC_PROPS) {
        for (const props of oper.props) {
          if (!isArray(props)) continue
          for (const prop of props) {
            if (prop.handler) {
              declare(prop, prop.key, prop.values, prop.handlerModifiers)
            }
          }
        }
      }
    }
  }
  return frag
}

export function getUniqueHandlerName(
  context: CodegenContext,
  name: string,
): string {
  return context.getUniqueLocalName(genVarName(name))
}

interface GenEventHandlerOptions {
  // Generate handler expressions suitable for passing as component props
  // (avoid wrapping member expressions with invocation).
  asComponentProp?: boolean
  // Wrap the result in a getter function `() => ...`.
  extraWrap?: boolean
  // Direct delegated assignments use Vapor guard helpers because the guard
  // helper owns the event invoker wrapper.
  modifierHelper?: 'runtime' | 'vapor'
  // The prop or event whose handler may be declared by genHoistedHandlers.
  hoisted?: IRProp | SetEventIRNode
}

export function genEventHandler(
  context: CodegenContext,
  values: (SimpleExpressionNode | undefined)[] | undefined,
  modifiers: {
    nonKeys: string[]
    keys: string[]
  } = { nonKeys: [], keys: [] },
  options: GenEventHandlerOptions = {},
): CodeFragment[] {
  const {
    asComponentProp = false,
    extraWrap = false,
    modifierHelper = 'runtime',
    hoisted,
  } = options
  const hoistedName = hoisted && hoistedHandlers.get(hoisted)
  if (hoistedName) return [hoistedName]
  const useVaporModifierHelper = modifierHelper === 'vapor'
  let handlerExp: CodeFragment[] = []
  if (values) {
    values.forEach((value, index) => {
      let exp: CodeFragment[] = []
      if (value && value.content.trim()) {
        // Determine how the handler should be wrapped so it always reference the
        // latest value when invoked.
        if (isMemberExpression(value, context.options)) {
          // e.g. @click="foo.bar"
          exp = genExpression(value, context)
          if (!isConstantBinding(value, context) && !asComponentProp) {
            // non constant, wrap with invocation as `e => foo.bar(e)`
            // when passing as component handler, access is always dynamic so we
            // can skip this
            const isTSNode = value.ast && TS_NODE_TYPES.includes(value.ast.type)
            exp = [
              `e => `,
              isTSNode ? '(' : '',
              ...exp,
              isTSNode ? ')' : '',
              `(e)`,
            ]
          }
        } else if (isFnExpression(value, context.options)) {
          // Fn expression: @click="e => foo(e)"
          // no need to wrap in this case
          exp = genExpression(value, context)
        } else {
          // inline statement
          // @click="foo($event)" ---> $event => foo($event)
          const referencesEvent = value.content.includes('$event')
          const hasMultipleStatements = value.content.includes(`;`)
          const expr = referencesEvent
            ? context.withId(() => genExpression(value, context), {
                $event: null,
              })
            : genExpression(value, context)
          exp = [
            referencesEvent ? '$event => ' : '() => ',
            hasMultipleStatements ? '{' : '(',
            ...expr,
            hasMultipleStatements ? '}' : ')',
          ]
        }
        handlerExp = handlerExp.concat([index !== 0 ? ', ' : '', ...exp])
      }
    })

    if (values.length > 1) {
      handlerExp = ['[', ...handlerExp, ']']
    }
  }

  if (handlerExp.length === 0) handlerExp = ['() => {}']
  const { keys, nonKeys } = modifiers
  if (nonKeys.length)
    handlerExp = genWithModifiers(
      context,
      handlerExp,
      nonKeys,
      useVaporModifierHelper && !keys.length,
    )
  if (keys.length)
    handlerExp = genWithKeys(context, handlerExp, keys, useVaporModifierHelper)

  if (extraWrap) handlerExp.unshift(`() => `)
  return handlerExp
}

function genWithModifiers(
  context: CodegenContext,
  handler: CodeFragment[],
  nonKeys: string[],
  useVaporHelper: boolean = false,
): CodeFragment[] {
  return genCall(
    context.helper(useVaporHelper ? 'withVaporModifiers' : 'withModifiers'),
    handler,
    JSON.stringify(nonKeys),
  )
}

function genWithKeys(
  context: CodegenContext,
  handler: CodeFragment[],
  keys: string[],
  useVaporHelper: boolean = false,
): CodeFragment[] {
  return genCall(
    context.helper(useVaporHelper ? 'withVaporKeys' : 'withKeys'),
    handler,
    JSON.stringify(keys),
  )
}

function isConstantBinding(
  value: SimpleExpressionNode,
  context: CodegenContext,
) {
  if (value.ast === null) {
    const bindingType = context.options.bindingMetadata[value.content]
    if (bindingType === BindingTypes.SETUP_CONST) {
      return true
    }
  }
}
