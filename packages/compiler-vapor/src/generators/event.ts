import {
  BindingTypes,
  type SimpleExpressionNode,
  isFnExpression,
  isMemberExpression,
} from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import {
  IRNodeTypes,
  type OperationNode,
  type SetDynamicEventsIRNode,
  type SetEventIRNode,
} from '../ir'
import { genExpression } from './expression'
import {
  type CodeFragment,
  DELIMITERS_OBJECT_NEWLINE,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'

export function genSetEvent(
  oper: SetEventIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { element, key, keyOverride, value, modifiers, delegate, effect } = oper

  const name = genName()
  const handler = genEventHandler(context, value, modifiers)
  const eventOptions = genEventOptions()

  if (delegate) {
    // key is static
    context.delegates.add(key.content)
    // if this is the only delegated event of this name on this element,
    // we can generate optimized handler attachment code
    // e.g. n1.$evtclick = () => {}
    if (!context.block.operation.some(isSameDelegateEvent)) {
      return [NEWLINE, `n${element}.$evt${key.content} = `, ...handler]
    }
  }

  return [
    NEWLINE,
    ...genCall(
      helper(delegate ? 'delegate' : 'on'),
      `n${element}`,
      name,
      handler,
      eventOptions,
    ),
  ]

  function genName(): CodeFragment[] {
    const expr = genExpression(key, context)
    if (keyOverride) {
      // TODO unit test
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
    if (!options.length && !effect) return

    return genMulti(
      DELIMITERS_OBJECT_NEWLINE,
      effect && ['effect: true'],
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

export function genEventHandler(
  context: CodegenContext,
  value: SimpleExpressionNode | undefined,
  modifiers: {
    nonKeys: string[]
    keys: string[]
  } = { nonKeys: [], keys: [] },
  // passed as component prop - need additional wrap
  extraWrap: boolean = false,
): CodeFragment[] {
  let handlerExp: CodeFragment[] = [`() => {}`]
  if (value && value.content.trim()) {
    // Determine how the handler should be wrapped so it always reference the
    // latest value when invoked.
    if (isMemberExpression(value, context.options)) {
      // e.g. @click="foo.bar"
      handlerExp = genExpression(value, context)
      if (!isConstantBinding(value, context) && !extraWrap) {
        // non constant, wrap with invocation as `e => foo.bar(e)`
        // when passing as component handler, access is always dynamic so we
        // can skip this
        handlerExp = [`e => `, ...handlerExp, `(e)`]
      }
    } else if (isFnExpression(value, context.options)) {
      // Fn expression: @click="e => foo(e)"
      // no need to wrap in this case
      handlerExp = genExpression(value, context)
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
      handlerExp = [
        referencesEvent ? '$event => ' : '() => ',
        hasMultipleStatements ? '{' : '(',
        ...expr,
        hasMultipleStatements ? '}' : ')',
      ]
    }
  }

  const { keys, nonKeys } = modifiers
  if (nonKeys.length)
    handlerExp = genWithModifiers(context, handlerExp, nonKeys)
  if (keys.length) handlerExp = genWithKeys(context, handlerExp, keys)

  if (extraWrap) handlerExp.unshift(`() => `)
  return handlerExp
}

function genWithModifiers(
  context: CodegenContext,
  handler: CodeFragment[],
  nonKeys: string[],
): CodeFragment[] {
  return genCall(
    context.helper('withModifiers'),
    handler,
    JSON.stringify(nonKeys),
  )
}

function genWithKeys(
  context: CodegenContext,
  handler: CodeFragment[],
  keys: string[],
): CodeFragment[] {
  return genCall(context.helper('withKeys'), handler, JSON.stringify(keys))
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
