import {
  DirectiveTransform,
  ElementTypes,
  transformModel,
  findProp,
  NodeTypes,
  createDOMCompilerError,
  DOMErrorCodes,
  Property,
  createObjectProperty,
  createSimpleExpression,
  createCallExpression,
  PlainElementNode,
  ExpressionNode,
  createConditionalExpression,
  createInterpolation
} from '@vue/compiler-dom'
import { SSR_LOOSE_EQUAL, SSR_LOOSE_CONTAIN } from '../runtimeHelpers'

export const ssrTransformModel: DirectiveTransform = (dir, node, context) => {
  const model = dir.exp!

  function checkDuplicatedValue() {
    const value = findProp(node, 'value')
    if (value) {
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_V_MODEL_UNNECESSARY_VALUE,
          value.loc
        )
      )
    }
  }

  if (node.tagType === ElementTypes.ELEMENT) {
    let props: Property[] = []
    const defaultProps = [
      // default value binding for text type inputs
      createObjectProperty(createSimpleExpression(`value`, true), model)
    ]
    if (node.tag === 'input') {
      const type = findProp(node, 'type')
      if (type) {
        if (type.type === NodeTypes.DIRECTIVE) {
          // dynamic type
          // TODO
        } else if (type.value) {
          // static type
          switch (type.value.content) {
            case 'radio':
              props = [
                createObjectProperty(
                  createSimpleExpression(`checked`, true),
                  createCallExpression(context.helper(SSR_LOOSE_EQUAL), [
                    model,
                    findValueBinding(node)
                  ])
                )
              ]
              break
            case 'checkbox':
              const value = findValueBinding(node)
              props = [
                createObjectProperty(
                  createSimpleExpression(`checked`, true),
                  createConditionalExpression(
                    createCallExpression(`Array.isArray`, [model]),
                    createCallExpression(context.helper(SSR_LOOSE_CONTAIN), [
                      model,
                      value
                    ]),
                    model
                  )
                )
              ]
              break
            case 'file':
              context.onError(
                createDOMCompilerError(
                  DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT,
                  dir.loc
                )
              )
              break
            default:
              checkDuplicatedValue()
              props = defaultProps
              break
          }
        }
      } else {
        checkDuplicatedValue()
        props = defaultProps
      }
    } else if (node.tag === 'textarea') {
      checkDuplicatedValue()
      node.children = [createInterpolation(model, model.loc)]
    } else if (node.tag === 'select') {
      // NOOP
      // select relies on client-side directive to set initial selected state.
    } else {
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT,
          dir.loc
        )
      )
    }

    return { props }
  } else {
    // component v-model
    return transformModel(dir, node, context)
  }
}

function findValueBinding(node: PlainElementNode): ExpressionNode {
  const valueBinding = findProp(node, 'value')
  return valueBinding
    ? valueBinding.type === NodeTypes.DIRECTIVE
      ? valueBinding.exp!
      : createSimpleExpression(valueBinding.value!.content, true)
    : createSimpleExpression(`null`, false)
}
