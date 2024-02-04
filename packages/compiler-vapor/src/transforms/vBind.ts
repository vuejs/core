import {
  ErrorCodes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import { camelize, isReservedProp } from '@vue/shared'
import type { DirectiveTransform } from '../transform'

export function normalizeBindShorthand(
  arg: SimpleExpressionNode,
): SimpleExpressionNode {
  // shorthand syntax https://github.com/vuejs/core/pull/9451
  const propName = camelize(arg.content)
  const exp = createSimpleExpression(propName, false, arg.loc)
  exp.ast = null
  return exp
}

export const transformVBind: DirectiveTransform = (dir, node, context) => {
  let { exp, loc, modifiers } = dir
  const arg = dir.arg!

  if (arg.isStatic && isReservedProp(arg.content)) return

  if (!exp) exp = normalizeBindShorthand(arg)

  let camel = false
  if (modifiers.includes('camel')) {
    if (arg.isStatic) {
      arg.content = camelize(arg.content)
    } else {
      camel = true
    }
  }

  if (!exp.content.trim()) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
    )
    context.template += ` ${arg.content}=""`
    return
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
