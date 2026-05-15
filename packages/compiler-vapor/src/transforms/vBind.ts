import {
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
  hasDynamicModifier,
  hasStaticModifier,
} from '@vue/compiler-dom'
import { camelize, extend } from '@vue/shared'
import type { DirectiveTransform, TransformContext } from '../transform'
import { resolveExpression } from '../utils'
import { isReservedProp } from './transformElement'

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
  const { loc } = dir
  let { exp } = dir
  let arg = dir.arg!

  if (hasDynamicModifier(dir)) {
    context.options.onError(
      createCompilerError(
        ErrorCodes.X_DYNAMIC_DIRECTIVE_MODIFIER_NOT_SUPPORTED,
        loc,
        undefined,
        ` v-bind only supports static modifiers.`,
      ),
    )
  }

  if (!exp) exp = normalizeBindShorthand(arg, context)
  if (!exp.content.trim()) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
    )
    exp = createSimpleExpression('', true, loc)
  }

  const isComponent = node.tagType === ElementTypes.COMPONENT
  exp = resolveExpression(exp, isComponent)
  arg = resolveExpression(arg)

  if (arg.isStatic && isReservedProp(arg.content)) return

  let camel = false
  if (hasStaticModifier(dir, 'camel')) {
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
    modifier: hasStaticModifier(dir, 'prop')
      ? '.'
      : hasStaticModifier(dir, 'attr')
        ? '^'
        : undefined,
  }
}
