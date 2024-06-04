import type { DirectiveTransform, TransformContext } from '../transform'
import {
  type DirectiveNode,
  type ExpressionNode,
  NodeTypes,
  type SimpleExpressionNode,
  createObjectProperty,
  createSimpleExpression,
} from '../ast'
import { ErrorCodes, createCompilerError } from '../errors'
import { camelize } from '@vue/shared'
import { CAMELIZE } from '../runtimeHelpers'
import { processExpression } from './transformExpression'

// v-bind without arg is handled directly in ./transformElements.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind: DirectiveTransform = (dir, _node, context) => {
  const { modifiers, loc } = dir
  const arg = dir.arg!

  let { exp } = dir

  // handle empty expression
  if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim()) {
    if (!__BROWSER__) {
      // #10280 only error against empty expression in non-browser build
      // because :foo in in-DOM templates will be parsed into :foo="" by the
      // browser
      context.onError(
        createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
      )
      return {
        props: [
          createObjectProperty(arg, createSimpleExpression('', true, loc)),
        ],
      }
    } else {
      exp = undefined
    }
  }

  // same-name shorthand - :arg is expanded to :arg="arg"
  if (!exp) {
    if (arg.type !== NodeTypes.SIMPLE_EXPRESSION || !arg.isStatic) {
      // only simple expression is allowed for same-name shorthand
      context.onError(
        createCompilerError(
          ErrorCodes.X_V_BIND_INVALID_SAME_NAME_ARGUMENT,
          arg.loc,
        ),
      )
      return {
        props: [
          createObjectProperty(arg, createSimpleExpression('', true, loc)),
        ],
      }
    }

    transformBindShorthand(dir, context)
    exp = dir.exp!
  }

  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    arg.children.unshift(`(`)
    arg.children.push(`) || ""`)
  } else if (!arg.isStatic) {
    arg.content = `${arg.content} || ""`
  }

  // .sync is replaced by v-model:arg
  if (modifiers.includes('camel')) {
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      if (arg.isStatic) {
        arg.content = camelize(arg.content)
      } else {
        arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`
      }
    } else {
      arg.children.unshift(`${context.helperString(CAMELIZE)}(`)
      arg.children.push(`)`)
    }
  }

  if (!context.inSSR) {
    if (modifiers.includes('prop')) {
      injectPrefix(arg, '.')
    }
    if (modifiers.includes('attr')) {
      injectPrefix(arg, '^')
    }
  }

  return {
    props: [createObjectProperty(arg, exp)],
  }
}

export const transformBindShorthand = (
  dir: DirectiveNode,
  context: TransformContext,
) => {
  const arg = dir.arg!

  const propName = camelize((arg as SimpleExpressionNode).content)
  dir.exp = createSimpleExpression(propName, false, arg.loc)
  if (!__BROWSER__) {
    dir.exp = processExpression(dir.exp, context)
  }
}

const injectPrefix = (arg: ExpressionNode, prefix: string) => {
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      arg.content = prefix + arg.content
    } else {
      arg.content = `\`${prefix}\${${arg.content}}\``
    }
  } else {
    arg.children.unshift(`'${prefix}' + (`)
    arg.children.push(`)`)
  }
}
