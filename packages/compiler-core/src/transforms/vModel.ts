import { DirectiveTransform } from '../transform'
import {
  createSimpleExpression,
  createObjectProperty,
  createCompoundExpression,
  NodeTypes,
  Property,
  ElementTypes
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import {
  isMemberExpression,
  isSimpleIdentifier,
  hasScopeRef,
  isStaticExp
} from '../utils'

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

  if (
    !__BROWSER__ &&
    context.prefixIdentifiers &&
    isSimpleIdentifier(expString) &&
    context.identifiers[expString]
  ) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_ON_SCOPE_VARIABLE, exp.loc)
    )
    return createTransformProps()
  }

  const propName = arg ? arg : createSimpleExpression('modelValue', true)
  const eventName = arg
    ? isStaticExp(arg)
      ? `onUpdate:${arg.content}`
      : createCompoundExpression(['"onUpdate:" + ', arg])
    : `onUpdate:modelValue`

  const props = [
    // modelValue: foo
    createObjectProperty(propName, dir.exp!),
    // "onUpdate:modelValue": $event => (foo = $event)
    createObjectProperty(
      eventName,
      createCompoundExpression([`$event => (`, exp, ` = $event)`])
    )
  ]

  // cache v-model handler if applicable (when it doesn't refer any scope vars)
  if (
    !__BROWSER__ &&
    context.prefixIdentifiers &&
    context.cacheHandlers &&
    !hasScopeRef(exp, context.identifiers)
  ) {
    props[1].value = context.cache(props[1].value)
  }

  // modelModifiers: { foo: true, "bar-baz": true }
  if (dir.modifiers.length && node.tagType === ElementTypes.COMPONENT) {
    const modifiers = dir.modifiers
      .map(m => (isSimpleIdentifier(m) ? m : JSON.stringify(m)) + `: true`)
      .join(`, `)
    const modifiersKey = arg
      ? isStaticExp(arg)
        ? `${arg.content}Modifiers`
        : createCompoundExpression([arg, ' + "Modifiers"'])
      : `modelModifiers`
    props.push(
      createObjectProperty(
        modifiersKey,
        createSimpleExpression(`{ ${modifiers} }`, false, dir.loc, true)
      )
    )
  }

  return createTransformProps(props)
}

function createTransformProps(props: Property[] = []) {
  return { props }
}
