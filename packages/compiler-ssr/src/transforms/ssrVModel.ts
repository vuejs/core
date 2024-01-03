import {
  DOMErrorCodes,
  type DirectiveTransform,
  ElementTypes,
  type ExpressionNode,
  NodeTypes,
  type PlainElementNode,
  createCallExpression,
  createConditionalExpression,
  createDOMCompilerError,
  createInterpolation,
  createObjectProperty,
  createSimpleExpression,
  findProp,
  hasDynamicKeyVBind,
  transformModel,
} from '@vue/compiler-dom'
import {
  SSR_INCLUDE_BOOLEAN_ATTR,
  SSR_LOOSE_CONTAIN,
  SSR_LOOSE_EQUAL,
  SSR_RENDER_DYNAMIC_MODEL,
} from '../runtimeHelpers'
import type { DirectiveTransformResult } from 'packages/compiler-core/src/transform'

export const ssrTransformModel: DirectiveTransform = (dir, node, context) => {
  const model = dir.exp!

  function checkDuplicatedValue() {
    const value = findProp(node, 'value')
    if (value) {
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_V_MODEL_UNNECESSARY_VALUE,
          value.loc,
        ),
      )
    }
  }

  function processOption(plainNode: PlainElementNode) {
    if (plainNode.tag === 'option') {
      if (plainNode.props.findIndex(p => p.name === 'selected') === -1) {
        const value = findValueBinding(plainNode)
        plainNode.ssrCodegenNode!.elements.push(
          createConditionalExpression(
            createCallExpression(context.helper(SSR_INCLUDE_BOOLEAN_ATTR), [
              createConditionalExpression(
                createCallExpression(`Array.isArray`, [model]),
                createCallExpression(context.helper(SSR_LOOSE_CONTAIN), [
                  model,
                  value,
                ]),
                createCallExpression(context.helper(SSR_LOOSE_EQUAL), [
                  model,
                  value,
                ]),
              ),
            ]),
            createSimpleExpression(' selected', true),
            createSimpleExpression('', true),
            false /* no newline */,
          ),
        )
      }
    } else if (plainNode.tag === 'optgroup') {
      plainNode.children.forEach(option =>
        processOption(option as PlainElementNode),
      )
    }
  }

  if (node.tagType === ElementTypes.ELEMENT) {
    const res: DirectiveTransformResult = { props: [] }
    const defaultProps = [
      // default value binding for text type inputs
      createObjectProperty(`value`, model),
    ]
    if (node.tag === 'input') {
      const type = findProp(node, 'type')
      if (type) {
        const value = findValueBinding(node)
        if (type.type === NodeTypes.DIRECTIVE) {
          // dynamic type
          res.ssrTagParts = [
            createCallExpression(context.helper(SSR_RENDER_DYNAMIC_MODEL), [
              type.exp!,
              model,
              value,
            ]),
          ]
        } else if (type.value) {
          // static type
          switch (type.value.content) {
            case 'radio':
              res.props = [
                createObjectProperty(
                  `checked`,
                  createCallExpression(context.helper(SSR_LOOSE_EQUAL), [
                    model,
                    value,
                  ]),
                ),
              ]
              break
            case 'checkbox':
              const trueValueBinding = findProp(node, 'true-value')
              if (trueValueBinding) {
                const trueValue =
                  trueValueBinding.type === NodeTypes.ATTRIBUTE
                    ? JSON.stringify(trueValueBinding.value!.content)
                    : trueValueBinding.exp!
                res.props = [
                  createObjectProperty(
                    `checked`,
                    createCallExpression(context.helper(SSR_LOOSE_EQUAL), [
                      model,
                      trueValue,
                    ]),
                  ),
                ]
              } else {
                res.props = [
                  createObjectProperty(
                    `checked`,
                    createConditionalExpression(
                      createCallExpression(`Array.isArray`, [model]),
                      createCallExpression(context.helper(SSR_LOOSE_CONTAIN), [
                        model,
                        value,
                      ]),
                      model,
                    ),
                  ),
                ]
              }
              break
            case 'file':
              context.onError(
                createDOMCompilerError(
                  DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT,
                  dir.loc,
                ),
              )
              break
            default:
              checkDuplicatedValue()
              res.props = defaultProps
              break
          }
        }
      } else if (hasDynamicKeyVBind(node)) {
        // dynamic type due to dynamic v-bind
        // NOOP, handled in ssrTransformElement due to need to rewrite
        // the entire props expression
      } else {
        // text type
        checkDuplicatedValue()
        res.props = defaultProps
      }
    } else if (node.tag === 'textarea') {
      checkDuplicatedValue()
      node.children = [createInterpolation(model, model.loc)]
    } else if (node.tag === 'select') {
      node.children.forEach(child => {
        if (child.type === NodeTypes.ELEMENT) {
          processOption(child as PlainElementNode)
        }
      })
    } else {
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT,
          dir.loc,
        ),
      )
    }

    return res
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
