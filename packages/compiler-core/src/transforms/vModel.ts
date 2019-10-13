import { DirectiveTransform, TransformContext } from '../transform'
import {
  createSimpleExpression,
  createObjectProperty,
  createCompoundExpression,
  NodeTypes,
  Property,
  DirectiveNode,
  ElementNode,
  createCallExpression,
  CallExpression
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { isMemberExpression } from '../utils'
import { TO_NUMBER, TRIM } from '../runtimeHelpers'

export enum VModelModifiers {
  NUMBER = 'number',
  TRIM = 'trim'
}

export const transformModel: DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext
) => {
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

  const props = [
    createObjectProperty(propName, dir.exp!),
    createObjectProperty(
      eventName,
      createCompoundExpression([
        `$event => (`,
        ...(exp.type === NodeTypes.SIMPLE_EXPRESSION ? [exp] : exp.children),
        ...getVModelValueExpression(dir.modifiers, context)
      ])
    )
  ]

  return createTransformProps(props)
}

function createTransformProps(props: Property[] = []) {
  return { props, needRuntime: false }
}

function getVModelValueExpression(
  modifiers: string[],
  context: TransformContext
): Array<CallExpression | string> {
  const start = ' = ',
    end = ')'
  const arg = `$event`
  if (modifiers.length) {
    if (modifiers.indexOf(VModelModifiers.NUMBER) > -1) {
      return [
        start,
        createCallExpression(context.helper(TO_NUMBER), [arg]),
        end
      ]
    }
    if (modifiers.indexOf(VModelModifiers.TRIM) > -1) {
      return [start, createCallExpression(context.helper(TRIM), [arg]), end]
    }
  }
  return [start + arg + end]
}
