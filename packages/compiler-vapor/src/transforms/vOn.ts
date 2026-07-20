import {
  type CompilerError,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
  isKeyboardEvent,
  isStaticExp,
  resolveModifiers,
} from '@vue/compiler-dom'
import type { DirectiveTransform, TransformContext } from '../transform'
import { IRNodeTypes, type KeyOverride, type SetEventIRNode } from '../ir'
import { extend, makeMap } from '@vue/shared'
import { resolveExpression } from '../utils'
import { EMPTY_EXPRESSION } from './utils'

const delegatedEvents = /*#__PURE__*/ makeMap(
  'beforeinput,click,dblclick,contextmenu,focusin,focusout,input,keydown,' +
    'keyup,mousedown,mousemove,mouseout,mouseover,mouseup,pointerdown,' +
    'pointermove,pointerout,pointerover,pointerup,touchend,touchmove,' +
    'touchstart',
)

export const transformVOn: DirectiveTransform = (dir, node, context) => {
  let { arg, exp, loc, modifiers } = dir
  const isComponent = node.tagType === ElementTypes.COMPONENT
  const isSlotOutlet = node.tag === 'slot'

  if (!exp && !modifiers.length) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc),
    )
  }

  let delegateModifier: SimpleExpressionNode | undefined
  let nonDelegateModifiers: SimpleExpressionNode[] | undefined
  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]
    if (modifier.content === 'delegate') {
      delegateModifier ||= modifier
      nonDelegateModifiers ||= modifiers.slice(0, i)
    } else if (nonDelegateModifiers) {
      nonDelegateModifiers.push(modifier)
    }
  }
  if (nonDelegateModifiers) {
    modifiers = nonDelegateModifiers
  }

  arg = resolveExpression(arg!)

  if (arg.isStatic && arg.content.startsWith('vue:')) {
    arg = extend({}, arg, {
      content: `vnode-${arg.content.slice(4)}`,
    })
  }

  const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
    resolveModifiers(
      arg.isStatic ? `on${arg.content}` : arg,
      modifiers,
      null,
      loc,
    )

  let keyOverride: KeyOverride | undefined
  const isStaticClick = arg.isStatic && arg.content.toLowerCase() === 'click'

  // normalize click.right and click.middle since they don't actually fire
  if (nonKeyModifiers.includes('right')) {
    if (!isStaticClick && !arg.isStatic) {
      keyOverride = ['click', 'contextmenu']
    }
  } else if (nonKeyModifiers.includes('middle')) {
    if (!isStaticClick && !arg.isStatic) {
      keyOverride = ['click', 'mouseup']
    }
  }
  arg = normalizeStaticEventArg(arg, nonKeyModifiers)

  // don't gen keys guard for non-keyboard events
  // if event name is dynamic, always wrap with keys guard
  if (
    keyModifiers.length &&
    isStaticExp(arg) &&
    !isKeyboardEvent(`on${arg.content.toLowerCase()}`)
  ) {
    keyModifiers.length = 0
  }

  if (isComponent || isSlotOutlet) {
    if (delegateModifier) {
      warnDelegate(
        context,
        delegateModifier,
        `.delegate modifier is only supported on native DOM elements. ` +
          `The modifier will be ignored.`,
      )
    }
    const handler = exp || EMPTY_EXPRESSION
    return {
      key: arg,
      value: handler,
      handler: true,
      handlerModifiers: {
        keys: keyModifiers,
        nonKeys: nonKeyModifiers,
        options: eventOptionModifiers,
      },
    }
  }

  const isDelegatableEvent =
    !!delegateModifier && arg.isStatic && delegatedEvents(arg.content)
  const hasStopHandler =
    isDelegatableEvent &&
    !eventOptionModifiers.length &&
    hasStopHandlerForStaticEvent(node, arg.content)

  if (delegateModifier && !arg.isStatic) {
    warnDelegate(
      context,
      delegateModifier,
      `.delegate modifier requires a static event name. ` +
        `The listener will be attached directly.`,
    )
  } else if (delegateModifier && !isDelegatableEvent) {
    warnDelegate(
      context,
      delegateModifier,
      `.delegate modifier is not supported on the "${arg.content}" event. ` +
        `The listener will be attached directly.`,
    )
  }

  // Only delegate if:
  // - no dynamic event name
  // - no event option modifiers (passive, capture, once)
  // - no handlers for the same static event on this element that use .stop
  // - is a delegatable event
  const delegate =
    isDelegatableEvent && !eventOptionModifiers.length && !hasStopHandler

  const operation: SetEventIRNode = {
    type: IRNodeTypes.SET_EVENT,
    element: context.reference(),
    key: arg,
    value: exp,
    modifiers: {
      keys: keyModifiers,
      nonKeys: nonKeyModifiers,
      options: eventOptionModifiers,
    },
    keyOverride,
    delegate,
    effect: !arg.isStatic,
  }

  context.registerEffect([arg], operation)
}

function normalizeStaticEventArg(
  arg: SimpleExpressionNode,
  nonKeyModifiers: string[],
): SimpleExpressionNode {
  if (!arg.isStatic) return arg

  let normalized = arg
  const isStaticClick = arg.content.toLowerCase() === 'click'

  if (nonKeyModifiers.includes('right') && isStaticClick) {
    normalized = extend({}, normalized, { content: 'contextmenu' })
  } else if (nonKeyModifiers.includes('middle') && isStaticClick) {
    normalized = extend({}, normalized, { content: 'mouseup' })
  }

  return normalized
}

function hasStopHandlerForStaticEvent(node: ElementNode, eventName: string) {
  return node.props.some(prop => {
    if (
      prop.type !== NodeTypes.DIRECTIVE ||
      prop.name !== 'on' ||
      !prop.arg ||
      prop.arg.type !== NodeTypes.SIMPLE_EXPRESSION
    ) {
      return false
    }

    const arg = resolveExpression(prop.arg)
    if (!arg.isStatic) return false

    const { nonKeyModifiers } = resolveModifiers(
      `on${arg.content}`,
      prop.modifiers,
      null,
      prop.loc,
    )

    return (
      nonKeyModifiers.includes('stop') &&
      normalizeStaticEventArg(arg, nonKeyModifiers).content === eventName
    )
  })
}

function warnDelegate(
  context: TransformContext<ElementNode>,
  modifier: SimpleExpressionNode,
  message: string,
): void {
  const error = new SyntaxError(message) as CompilerError
  error.loc = modifier.loc
  context.options.onWarn(error)
}
