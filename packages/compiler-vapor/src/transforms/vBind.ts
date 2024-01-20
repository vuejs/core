import {
  ErrorCodes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import { camelize, isReservedProp } from '@vue/shared'
import { IRNodeTypes } from '../ir'
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
  let { arg, exp, loc, modifiers } = dir

  if (!arg) {
    // TODO support v-bind="{}"
    return
  }
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

  let prefix: string | undefined
  if (modifiers.includes('prop')) {
    prefix = injectPrefix(arg, '.')
  }
  if (modifiers.includes('attr')) {
    prefix = injectPrefix(arg, '^')
  }

  if (!exp.content.trim()) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
    )
    context.template += ` ${arg.content}=""`
    return
  }

  context.registerEffect(
    [exp],
    [
      {
        type: IRNodeTypes.SET_PROP,
        loc: dir.loc,
        element: context.reference(),
        key: arg,
        value: exp,
        runtimeCamelize: camel,
        runtimePrefix: prefix,
      },
    ],
  )
}

const injectPrefix = (arg: SimpleExpressionNode, prefix: string) => {
  if (!arg.isStatic) {
    return prefix
  }
  arg.content = prefix + arg.content
}
