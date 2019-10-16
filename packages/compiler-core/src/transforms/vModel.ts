import { DirectiveTransform, TransformContext } from '../transform'
import {
  createSimpleExpression,
  createObjectProperty,
  createCompoundExpression,
  NodeTypes,
  Property,
  CompoundExpressionNode,
  createInterpolation
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { isMemberExpression } from '../utils'
import { isObject } from '@vue/shared'

export const transformModel: DirectiveTransform = (dir, node, context) => {
  const { exp, arg } = dir
  if (!exp) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_NO_EXPRESSION, dir.loc)
    )
    return createTransformProps()
  }

  const expString =
    exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : exp.loc.source
  if (!isMemberExpression(expString)) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION, exp.loc)
    )
    return createTransformProps()
  }

  const propName = arg ? arg : createSimpleExpression('modelValue', true)
  const eventName = arg
    ? arg.type === NodeTypes.SIMPLE_EXPRESSION && arg.isStatic
      ? createSimpleExpression('onUpdate:' + arg.content, true)
      : createCompoundExpression([
          createSimpleExpression('onUpdate:', true),
          '+',
          ...(arg.type === NodeTypes.SIMPLE_EXPRESSION ? [arg] : arg.children)
        ])
    : createSimpleExpression('onUpdate:modelValue', true)

  let assignmentChildren =
    exp.type === NodeTypes.SIMPLE_EXPRESSION ? [exp] : exp.children
  // For a member expression used in assignment, it only needs to be updated
  // if the expression involves scope variables. Otherwise we can mark the
  // expression as constant to avoid it being included in `dynamicPropNames`
  // of the element. This optimization relies on `prefixIdentifiers: true`.
  if (!__BROWSER__ && context.prefixIdentifiers) {
    assignmentChildren = assignmentChildren.map(c => toConstant(c, context))
  }

  const props = [
    createObjectProperty(propName, dir.exp!),
    createObjectProperty(
      eventName,
      createCompoundExpression([
        `$event => (`,
        ...assignmentChildren,
        ` = $event)`
      ])
    )
  ]

  if (dir.modifiers.length) {
    // TODO add modelModifiers prop
  }

  return createTransformProps(props)
}

function toConstant(
  exp: CompoundExpressionNode | CompoundExpressionNode['children'][0],
  context: TransformContext
): any {
  if (!isObject(exp) || exp.type === NodeTypes.TEXT) {
    return exp
  }
  if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (exp.isStatic || context.identifiers[exp.content]) {
      return exp
    }
    return {
      ...exp,
      isConstant: true
    }
  } else if (exp.type === NodeTypes.COMPOUND_EXPRESSION) {
    return createCompoundExpression(
      exp.children.map(c => toConstant(c, context))
    )
  } else if (exp.type === NodeTypes.INTERPOLATION) {
    return createInterpolation(toConstant(exp.content, context), exp.loc)
  }
}

function createTransformProps(props: Property[] = []) {
  return { props, needRuntime: false }
}
