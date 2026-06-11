import {
  type ExpressionNode,
  NodeTypes,
  type PlainElementNode,
  type TemplateChildNode,
  type TransformContext,
  createCallExpression,
  createConditionalExpression,
  createSimpleExpression,
  findProp,
} from '@vue/compiler-core'
import {
  SSR_INCLUDE_BOOLEAN_ATTR,
  SSR_LOOSE_CONTAIN,
  SSR_LOOSE_EQUAL,
} from './runtimeHelpers'

export function findValueBinding(node: PlainElementNode): ExpressionNode {
  const valueBinding = findProp(node, 'value')
  return valueBinding
    ? valueBinding.type === NodeTypes.DIRECTIVE
      ? valueBinding.exp!
      : createSimpleExpression(valueBinding.value!.content, true)
    : createSimpleExpression(`null`, false)
}

export type SelectValue =
  | {
      type: 'staticValue'
      value: string
    }
  | {
      type: 'dynamicValue'
      value: ExpressionNode
    }
  | {
      type: 'dynamicVBind'
      tempId: string
    }

export const processSelectChildren = (
  context: TransformContext,
  children: TemplateChildNode[],
  selectValue: SelectValue,
): void => {
  children.forEach(child => {
    if (child.type === NodeTypes.ELEMENT) {
      processOption(context, child as PlainElementNode, selectValue)
    } else if (child.type === NodeTypes.FOR) {
      processSelectChildren(context, child.children, selectValue)
    } else if (child.type === NodeTypes.IF) {
      child.branches.forEach(b =>
        processSelectChildren(context, b.children, selectValue),
      )
    }
  })
}

export function processOption(
  context: TransformContext,
  plainNode: PlainElementNode,
  selectValue: SelectValue,
): void {
  if (plainNode.tag === 'option') {
    if (plainNode.props.findIndex(p => p.name === 'selected') === -1) {
      const value = findValueBinding(plainNode)

      function createDynamicSelectExpression(selectValue: ExpressionNode) {
        return createConditionalExpression(
          createCallExpression(`Array.isArray`, [selectValue]),
          createCallExpression(context.helper(SSR_LOOSE_CONTAIN), [
            selectValue,
            value,
          ]),
          createCallExpression(context.helper(SSR_LOOSE_EQUAL), [
            selectValue,
            value,
          ]),
        )
      }

      plainNode.ssrCodegenNode!.elements.push(
        createConditionalExpression(
          createCallExpression(context.helper(SSR_INCLUDE_BOOLEAN_ATTR), [
            selectValue.type === 'staticValue'
              ? createCallExpression(context.helper(SSR_LOOSE_EQUAL), [
                  createSimpleExpression(selectValue.value, true),
                  value,
                ])
              : selectValue.type === 'dynamicValue'
                ? createDynamicSelectExpression(selectValue.value)
                : createConditionalExpression(
                    createSimpleExpression(
                      `"value" in ${selectValue.tempId}`,
                      false,
                    ),
                    createDynamicSelectExpression(
                      createSimpleExpression(
                        `${selectValue.tempId}.value`,
                        false,
                      ),
                    ),
                    createSimpleExpression('false', false),
                  ),
          ]),
          createSimpleExpression(' selected', true),
          createSimpleExpression('', true),
          false /* no newline */,
        ),
      )
    }
  } else if (plainNode.tag === 'optgroup') {
    processSelectChildren(context, plainNode.children, selectValue)
  }
}
