import type { DirectiveTransform } from '../transform'
import {
  type ExpressionNode,
  NodeTypes,
  createObjectProperty,
  createSimpleExpression,
} from '../ast'
import { ErrorCodes, createCompilerError } from '../errors'
import { camelize } from '@vue/shared'
import { CAMELIZE } from '../runtimeHelpers'

// v-bind without arg is handled directly in ./transformElement.ts due to its affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind: DirectiveTransform = (dir, _node, context) => {
  const { modifiers, loc } = dir
  const arg = dir.arg!

  const { exp } = dir

  // handle a missing or empty expression. An empty expression is only an error
  // in non-browser builds (#10280) because :foo in in-DOM templates will be
  // parsed into :foo="" by the browser, and a missing one means the argument
  // could not be used by the same-name shorthand, which
  // transformVBindShorthand has already reported.
  if (
    !exp ||
    (exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim())
  ) {
    if (exp && !__BROWSER__) {
      context.onError(
        createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
      )
    }
    // codegen must always receive an expression, so fall back to an empty one
    return {
      props: [createObjectProperty(arg, createSimpleExpression('', true, loc))],
    }
  }

  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    arg.children.unshift(`(`)
    arg.children.push(`) || ""`)
  } else if (!arg.isStatic) {
    arg.content = arg.content ? `${arg.content} || ""` : `""`
  }

  // .sync is replaced by v-model:arg
  if (modifiers.some(mod => mod.content === 'camel')) {
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
    if (modifiers.some(mod => mod.content === 'prop')) {
      injectPrefix(arg, '.')
    }
    if (modifiers.some(mod => mod.content === 'attr')) {
      injectPrefix(arg, '^')
    }
  }

  return {
    props: [createObjectProperty(arg, exp!)],
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
