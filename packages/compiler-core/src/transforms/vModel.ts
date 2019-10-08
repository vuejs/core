import { DirectiveTransform } from '../transform'
import {
  createSimpleExpression,
  createObjectProperty,
  createCompoundExpression,
  NodeTypes,
  Property
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { isEmptyExpression } from '../utils'

export const transformModel: DirectiveTransform = (dir, context) => {
  const { exp, arg } = dir
  if (!exp) {
    context.onError(createCompilerError(ErrorCodes.X_V_MODEL_NO_EXPRESSION))

    return createTransformProps()
  } else if (isEmptyExpression(exp)) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION)
    )

    return createTransformProps()
  } else {
    const defaultPropName = createSimpleExpression('modelValue', true)
    const defaultEventName = createSimpleExpression('onUpdate:modelValue', true)
    const propName = arg ? arg : defaultPropName
    const eventName = arg
      ? arg.type === NodeTypes.SIMPLE_EXPRESSION && arg.isStatic
        ? createSimpleExpression('onUpdate:' + arg.content, true)
        : createCompoundExpression([
            createSimpleExpression('onUpdate:', true),
            '+',
            ...(arg.type === NodeTypes.SIMPLE_EXPRESSION ? [arg] : arg.children)
          ])
      : defaultEventName

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
}

function createTransformProps(props: Property[] = []) {
  return { props, needRuntime: false }
}
