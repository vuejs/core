import { DirectiveTransform } from '../transform'
import {
  createObjectProperty,
  createSimpleExpression,
  ExpressionNode,
  NodeTypes,
  createCompoundExpression,
  SimpleExpressionNode
} from '../ast'
import { capitalize } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import { processExpression } from './transformExpression'

const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function(?:\s+[\w$]+)?\s*\(/
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/

// v-on without arg is handled directly in ./element.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-on
// *with* args.
export const transformOn: DirectiveTransform = (dir, context) => {
  const { loc, modifiers } = dir
  const arg = dir.arg!
  if (!dir.exp && !modifiers.length) {
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
    // already a compound expression.
    eventName = arg
    eventName.children.unshift(`"on" + (`)
    eventName.children.push(`)`)
  }
  // TODO .once modifier handling since it is platform agnostic
  // other modifiers are handled in compiler-dom

  // handler processing
  if (dir.exp) {
    // exp is guaranteed to be a simple expression here because v-on w/ arg is
    // skipped by transformExpression as a special case.
    let exp: ExpressionNode = dir.exp as SimpleExpressionNode
    const isInlineStatement = !(
      simplePathRE.test(exp.content) || fnExpRE.test(exp.content)
    )
    // process the expression since it's been skipped
    if (!__BROWSER__ && context.prefixIdentifiers) {
      context.addIdentifiers(`$event`)
      exp = processExpression(exp, context)
      context.removeIdentifiers(`$event`)
    }
    if (isInlineStatement) {
      // wrap inline statement in a function expression
      exp = createCompoundExpression([
        `$event => (`,
        ...(exp.type === NodeTypes.SIMPLE_EXPRESSION ? [exp] : exp.children),
        `)`
      ])
    }
    dir.exp = exp
  }

  return {
    props: createObjectProperty(
      eventName,
      dir.exp || createSimpleExpression(`() => {}`, false, loc)
    ),
    needRuntime: false
  }
}
