import {
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import { camelize, isVaporReservedProp } from '@vue/shared'
import type { DirectiveTransform, TransformContext } from '../transform'
import { resolveExpression } from '../utils'

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

  if (!exp) exp = normalizeBindShorthand(arg, context)
  if (!exp.content.trim()) {
    if (!__BROWSER__) {
      // #10280 only error against empty expression in non-browser build
      // because :foo in in-DOM templates will be parsed into :foo="" by the
      // browser
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
      )
    }
    exp = createSimpleExpression('', true, loc)
  }

  exp = resolveExpression(exp)
  arg = resolveExpression(arg)

  if (arg.isStatic && isVaporReservedProp(arg.content)) return
  let camel = false
  if (modifiers.includes('camel')) {
    if (arg.isStatic) {
      arg.content = camelize(arg.content)
    } else {
      camel = true
    }
  }

  return {
    key: arg,
    value: exp,
    loc,
    runtimeCamelize: camel,
    modifier: modifiers.includes('prop')
      ? '.'
      : modifiers.includes('attr')
        ? '^'
        : undefined,
  }
}
