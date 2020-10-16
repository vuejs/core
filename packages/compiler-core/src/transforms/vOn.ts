import { DirectiveTransform, DirectiveTransformResult } from '../transform'
import {
  DirectiveNode,
  createObjectProperty,
  createSimpleExpression,
  ExpressionNode,
  NodeTypes,
  createCompoundExpression,
  SimpleExpressionNode,
  ElementTypes
} from '../ast'
import { capitalize, camelize } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import { processExpression } from './transformExpression'
import { validateBrowserExpression } from '../validateExpression'
import { isMemberExpression, hasScopeRef } from '../utils'
import { CAPITALIZE } from '../runtimeHelpers'

const fnExpRE = /^\s*([\w$_]+|\([^)]*?\))\s*=>|^\s*function(?:\s+[\w$]+)?\s*\(/

export interface VOnDirectiveNode extends DirectiveNode {
  // v-on without arg is handled directly in ./transformElements.ts due to it affecting
  // codegen for the entire props object. This transform here is only for v-on
  // *with* args.
  arg: ExpressionNode
  // exp is guaranteed to be a simple expression here because v-on w/ arg is
  // skipped by transformExpression as a special case.
  exp: SimpleExpressionNode | undefined
}

export const transformOn: DirectiveTransform = (
  dir,
  node,
  context,
  augmentor
) => {
  const { loc, modifiers, arg } = dir as VOnDirectiveNode
  if (!dir.exp && !modifiers.length) {
    context.onError(createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc))
  }
  let eventName: ExpressionNode
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      const rawName = arg.content
      // for all event listeners, auto convert it to camelCase. See issue #2249
      const normalizedName = capitalize(camelize(rawName))
      eventName = createSimpleExpression(`on${normalizedName}`, true, arg.loc)
    } else {
      // #2388
      eventName = createCompoundExpression([
        arg,
        ` ? "on" + ${context.helperString(CAPITALIZE)}(`,
        arg,
        `) : ""`
      ])
    }
  } else {
    // already a compound expression.
    eventName = arg
    eventName.children.unshift(`"on" + ${context.helperString(CAPITALIZE)}(`)
    eventName.children.push(`)`)
  }

  // handler processing
  let exp: ExpressionNode | undefined = dir.exp as
    | SimpleExpressionNode
    | undefined
  if (exp && !exp.content.trim()) {
    exp = undefined
  }
  let isCacheable: boolean = context.cacheHandlers && !exp
  if (exp) {
    const isMemberExp = isMemberExpression(exp.content)
    const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content))
    const hasMultipleStatements = exp.content.includes(`;`)

    // process the expression since it's been skipped
    if (!__BROWSER__ && context.prefixIdentifiers) {
      isInlineStatement && context.addIdentifiers(`$event`)
      exp = processExpression(exp, context, false, hasMultipleStatements)
      isInlineStatement && context.removeIdentifiers(`$event`)
      // with scope analysis, the function is hoistable if it has no reference
      // to scope variables.
      isCacheable =
        context.cacheHandlers &&
        // #1541 bail if this is a member exp handler passed to a component -
        // we need to use the original function to preserve arity,
        // e.g. <transition> relies on checking cb.length to determine
        // transition end handling. Inline function is ok since its arity
        // is preserved even when cached.
        !(isMemberExp && node.tagType === ElementTypes.COMPONENT) &&
        // bail if the function references closure variables (v-for, v-slot)
        // it must be passed fresh to avoid stale values.
        !hasScopeRef(exp, context.identifiers)
      // If the expression is optimizable and is a member expression pointing
      // to a function, turn it into invocation (and wrap in an arrow function
      // below) so that it always accesses the latest value when called - thus
      // avoiding the need to be patched.
      if (isCacheable && isMemberExp) {
        if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
          exp.content += `(...args)`
        } else {
          exp.children.push(`(...args)`)
        }
      }
    }

    if (__DEV__ && __BROWSER__) {
      validateBrowserExpression(
        exp as SimpleExpressionNode,
        context,
        false,
        hasMultipleStatements
      )
    }

    if (isInlineStatement || (isCacheable && isMemberExp)) {
      // wrap inline statement in a function expression
      exp = createCompoundExpression([
        `${isInlineStatement ? `$event` : `(...args)`} => ${
          hasMultipleStatements ? `{` : `(`
        }`,
        exp,
        hasMultipleStatements ? `}` : `)`
      ])
    }
  }

  let ret: DirectiveTransformResult = {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression(`() => {}`, false, loc)
      )
    ]
  }

  // apply extended compiler augmentor
  if (augmentor) {
    ret = augmentor(ret)
  }

  if (isCacheable) {
    // cache handlers so that it's always the same handler being passed down.
    // this avoids unnecessary re-renders when users use inline handlers on
    // components.
    ret.props[0].value = context.cache(ret.props[0].value)
  }

  return ret
}
