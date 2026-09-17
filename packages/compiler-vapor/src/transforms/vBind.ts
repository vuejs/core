import {
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import { camelize, extend } from '@vue/shared'
import type { DirectiveTransform, TransformContext } from '../transform'
import { resolveExpression } from '../utils'
import {
  isFoldableBooleanAttr,
  isModelValueProp,
  isReservedProp,
} from './transformElement'

// same-name shorthand - :arg is expanded to :arg="arg"
export function normalizeBindShorthand(
  arg: SimpleExpressionNode,
  context: TransformContext,
): SimpleExpressionNode {
  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION || !arg.isStatic) {
    // only simple expression is allowed for same-name shorthand
    context.options.onError(
      createCompilerError(
        ErrorCodes.X_V_BIND_INVALID_SAME_NAME_ARGUMENT,
        arg.loc,
      ),
    )
    return createSimpleExpression('', true, arg.loc)
  }

  const propName = camelize(arg.content)
  const exp = createSimpleExpression(propName, false, arg.loc)
  exp.ast = null
  return exp
}

export const transformVBind: DirectiveTransform = (dir, node, context) => {
  const { loc, modifiers } = dir
  let { exp } = dir
  let arg = dir.arg!
  const modifiersString = modifiers.map(s => s.content)

  if (!exp) exp = normalizeBindShorthand(arg, context)
  if (!exp.content.trim()) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
    )
    exp = createSimpleExpression('', true, loc)
  }

  arg = resolveExpression(arg)

  // A number literal loses its type as soon as it is stringified into the
  // template, so hold it back wherever the value does not end up there as a
  // string: component, slot outlet and custom element props are passed as raw
  // values, a dynamic key is always applied at runtime, boolean attributes are
  // folded from the type of the value itself, and v-model reads its value
  // props back off the element. `.attr` always goes through `setAttribute`,
  // which stringifies anyway.
  const excludeNumber =
    node.tagType === ElementTypes.COMPONENT ||
    node.tagType === ElementTypes.SLOT ||
    !!context.options.isCustomElement(node.tag) ||
    !arg.isStatic ||
    (!modifiersString.includes('attr') &&
      (isFoldableBooleanAttr(arg.content) ||
        isModelValueProp(node, arg.content)))
  exp = resolveExpression(exp, excludeNumber)

  if (arg.isStatic && isReservedProp(arg.content)) return

  let camel = false
  if (modifiersString.includes('camel')) {
    if (arg.isStatic) {
      arg = extend({}, arg, { content: camelize(arg.content) })
    } else {
      camel = true
    }
  }

  return {
    key: arg,
    value: exp,
    loc,
    runtimeCamelize: camel,
    modifier: modifiersString.includes('prop')
      ? '.'
      : modifiersString.includes('attr')
        ? '^'
        : undefined,
  }
}
