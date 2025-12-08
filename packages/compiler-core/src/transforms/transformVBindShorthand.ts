import { camelize } from '@vue/shared'
import {
  NodeTypes,
  type SimpleExpressionNode,
  createSimpleExpression,
} from '../ast'
import type { NodeTransform } from '../transform'
import { ErrorCodes, createCompilerError } from '../errors'
import { validFirstIdentCharRE } from '../utils'

export const transformVBindShorthand: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    for (const prop of node.props) {
      // same-name shorthand - :arg is expanded to :arg="arg"
      if (
        prop.type === NodeTypes.DIRECTIVE &&
        prop.name === 'bind' &&
        (!prop.exp ||
          // #13930 :foo in in-DOM templates will be parsed into :foo="" by browser
          (__BROWSER__ &&
            prop.exp.type === NodeTypes.SIMPLE_EXPRESSION &&
            !prop.exp.content.trim())) &&
        prop.arg
      ) {
        const arg = prop.arg
        if (arg.type !== NodeTypes.SIMPLE_EXPRESSION || !arg.isStatic) {
          // only simple expression is allowed for same-name shorthand
          context.onError(
            createCompilerError(
              ErrorCodes.X_V_BIND_INVALID_SAME_NAME_ARGUMENT,
              arg.loc,
            ),
          )
          prop.exp = createSimpleExpression('', true, arg.loc)
        } else {
          const propName = camelize((arg as SimpleExpressionNode).content)
          if (
            validFirstIdentCharRE.test(propName[0]) ||
            // allow hyphen first char for https://github.com/vuejs/language-tools/pull/3424
            propName[0] === '-'
          ) {
            prop.exp = createSimpleExpression(propName, false, arg.loc)
          }
        }
      }
    }
  }
}
