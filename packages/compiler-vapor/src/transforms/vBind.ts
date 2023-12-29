import {
  ErrorCodes,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-core'
import { camelize } from '@vue/shared'
import { IRNodeTypes } from '../ir'
import type { DirectiveTransform } from '../transform'

export const transformVBind: DirectiveTransform = (dir, node, context) => {
  let { arg, exp, loc, modifiers } = dir

  if (!arg) {
    // TODO support v-bind="{}"
    return
  }
  if (!exp) {
    // shorthand syntax https://github.com/vuejs/core/pull/9451
    const propName = camelize(arg.content)
    exp = createSimpleExpression(propName, false, arg.loc)
    exp.ast = null
  }

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
      },
    ],
  )
}
