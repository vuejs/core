import { DirectiveTransform, TransformContext } from '../transform'
import {
  createObjectProperty,
  createSimpleExpression,
  ExpressionNode,
  NodeTypes,
  createCompoundExpression,
  SimpleExpressionNode,
  DirectiveNode
} from '../ast'
import { capitalize, fnExpRE } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import { processExpression } from './transformExpression'
import { isMemberExpression } from '../utils'

export const createVOnEventName = (arg: ExpressionNode): ExpressionNode => {
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
    // already a compound expression.
    eventName = arg
    eventName.children.unshift(`"on" + (`)
    eventName.children.push(`)`)
  }
  return eventName
}

export const validateVOnArguments = (
  dir: DirectiveNode,
  context: TransformContext
) => {
  const { loc, modifiers } = dir
  if (!dir.exp && !modifiers.length) {
    context.onError(createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc))
  }
}

// handler processing
export const processVOnHanlder = (
  exp: ExpressionNode,
  context: TransformContext
): ExpressionNode => {
  if (!__BROWSER__ && context.prefixIdentifiers) {
    context.addIdentifiers(`$event`)
    let result = processExpression(exp as SimpleExpressionNode, context)
    context.removeIdentifiers(`$event`)
    return result
  }
  return exp
}

export type VOnDirectiveNode = Omit<DirectiveNode, 'arg' | 'exp'> & {
  // v-on without arg is handled directly in ./element.ts due to it affecting
  // codegen for the entire props object. This transform here is only for v-on
  // *with* args.
  arg: ExpressionNode
  // exp is guaranteed to be a simple expression here because v-on w/ arg is
  // skipped by transformExpression as a special case.
  exp: SimpleExpressionNode | undefined
}
export const transformOn: DirectiveTransform = (
  dir: VOnDirectiveNode,
  node,
  context
) => {
  validateVOnArguments(dir, context)
  let eventName = createVOnEventName(dir.arg)
  // TODO .once modifier handling since it is platform agnostic
  // other modifiers are handled in compiler-dom

  let exp: ExpressionNode | undefined = dir.exp
  if (exp) {
    const isInlineStatement = !(
      isMemberExpression(exp.content) || fnExpRE.test(exp.content)
    )
    exp = processVOnHanlder(exp, context)
    // wrap inline statement in a function expression
    if (isInlineStatement) {
      exp = createCompoundExpression([
        `$event => (`,
        ...(exp.type === NodeTypes.SIMPLE_EXPRESSION ? [exp] : exp.children),
        `)`
      ])
    }
  }
  return {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression(`() => {}`, false, dir.loc)
      )
    ],
    needRuntime: false
  }
}
