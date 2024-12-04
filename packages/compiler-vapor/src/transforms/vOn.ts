import {
  ElementTypes,
  ErrorCodes,
  createCompilerError,
} from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes, type KeyOverride, type SetEventIRNode } from '../ir'
import { resolveModifiers } from '@vue/compiler-dom'
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
  arg = resolveExpression(arg!)

  const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
    resolveModifiers(
      arg.isStatic ? `on${arg.content}` : arg,
      modifiers,
      null,
      loc,
    )

  let keyOverride: KeyOverride | undefined
  const isStaticClick = arg.isStatic && arg.content.toLowerCase() === 'click'
  const delegate =
    arg.isStatic && !eventOptionModifiers.length && delegatedEvents(arg.content)

  // normalize click.right and click.middle since they don't actually fire
  if (nonKeyModifiers.includes('middle')) {
    if (keyOverride) {
      // TODO error here
    }
    if (isStaticClick) {
      arg = extend({}, arg, { content: 'mouseup' })
    } else if (!arg.isStatic) {
      keyOverride = ['click', 'mouseup']
    }
  }
  if (nonKeyModifiers.includes('right')) {
    if (isStaticClick) {
      arg = extend({}, arg, { content: 'contextmenu' })
    } else if (!arg.isStatic) {
      keyOverride = ['click', 'contextmenu']
    }
  }

  if (isComponent || isSlotOutlet) {
    const handler = exp || EMPTY_EXPRESSION
    return {
      key: arg,
      value: handler,
      handler: true,
    }
  }

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
