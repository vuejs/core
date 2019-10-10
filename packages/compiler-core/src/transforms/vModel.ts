import { DirectiveTransform } from '../transform'
import {
  createSimpleExpression,
  createObjectProperty,
  createCompoundExpression,
  NodeTypes,
  Property
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { isMemberExpression } from '../utils'

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

  return createTransformProps([
    createObjectProperty(propName, dir.exp!),
    createObjectProperty(
      eventName,
      createCompoundExpression([
        `$event => (`,
        ...(exp.type === NodeTypes.SIMPLE_EXPRESSION ? [exp] : exp.children),
        ` = $event)`
      ])
    )
  ])
}

function createTransformProps(props: Property[] = []) {
  return { props, needRuntime: false }
}
