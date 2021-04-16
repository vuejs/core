import { DirectiveTransform } from '../transform'
import { createObjectProperty, createSimpleExpression, NodeTypes } from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { camelize } from '@vue/shared'
import { CAMELIZE } from '../runtimeHelpers'
import {
  checkCompatEnabled,
  CompilerDeprecationTypes
} from '../compat/compatConfig'

// v-bind without arg is handled directly in ./transformElements.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind: DirectiveTransform = (dir, _node, context) => {
  const { exp, modifiers, loc } = dir
  const arg = dir.arg!

  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    arg.children.unshift(`(`)
    arg.children.push(`) || ""`)
  } else if (!arg.isStatic) {
    arg.content = `${arg.content} || ""`
  }

  // .prop is no longer necessary due to new patch behavior
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

  if (__COMPAT__) {
    if (modifiers.includes('prop')) {
      checkCompatEnabled(
        CompilerDeprecationTypes.COMPILER_V_BIND_PROP,
        context,
        loc
      )
    }
    // .sync handling is performed directly in the parse phase to transform
    // it into v-model:arg equivalent.
  }

  if (
    !exp ||
    (exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim())
  ) {
    context.onError(createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc))
    return {
      props: [createObjectProperty(arg!, createSimpleExpression('', true, loc))]
    }
  }

  return {
    props: [createObjectProperty(arg!, exp)]
  }
}
