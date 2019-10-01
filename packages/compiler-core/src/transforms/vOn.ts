import { DirectiveTransform } from '../transform'
import {
  createObjectProperty,
  createSimpleExpression,
  ExpressionNode,
  NodeTypes,
  createCompoundExpression
} from '../ast'
import { capitalize } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'

// v-on without arg is handled directly in ./element.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-on
// *with* args.
export const transformOn: DirectiveTransform = (dir, context) => {
  const { exp, loc, modifiers } = dir
  const arg = dir.arg!
  if (!exp && !modifiers.length) {
    context.onError(createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc))
  }
  let eventName: ExpressionNode
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      eventName = createSimpleExpression(
        `on${capitalize(arg.content)}`,
        true,
        arg.loc
      )
    } else {
      eventName = createCompoundExpression([`"on" + (`, arg, `)`])
    }
  } else {
    // already a compound epxression.
    eventName = arg
    eventName.children.unshift(`"on" + (`)
    eventName.children.push(`)`)
  }
  // TODO .once modifier handling since it is platform agnostic
  // other modifiers are handled in compiler-dom
  return {
    props: createObjectProperty(
      eventName,
      exp || createSimpleExpression(`() => {}`, false, loc)
    ),
    needRuntime: false
  }
}
