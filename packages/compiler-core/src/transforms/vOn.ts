import { DirectiveTransform } from '../transform'
import { createObjectProperty, createExpression, ExpressionNode } from '../ast'
import { capitalize } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import { isSimpleIdentifier } from '../utils'

// v-on without arg is handled directly in ./element.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-on
// *with* args.
export const transformOn: DirectiveTransform = ({ arg, exp, loc }, context) => {
  if (!exp) {
    context.onError(createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc))
  }
  const { content, children, isStatic, loc: argLoc } = arg!
  let eventName: ExpressionNode
  if (isStatic) {
    // static arg
    eventName = createExpression(`on${capitalize(content)}`, true, argLoc)
  } else if (!children) {
    // dynamic arg with no rewrite
    eventName = createExpression(
      `"on" + ${isSimpleIdentifier(content) ? content : `(${content})`}`,
      false,
      argLoc
    )
  } else {
    // dynamic arg with ctx prefixing
    eventName = arg!
    children.unshift(`"on" + `)
  }
  // TODO .once modifier handling since it is platform agnostic
  // other modifiers are handled in compiler-dom
  return {
    props: createObjectProperty(
      eventName,
      exp || createExpression(`() => {}`, false, loc),
      loc
    ),
    needRuntime: false
  }
}
