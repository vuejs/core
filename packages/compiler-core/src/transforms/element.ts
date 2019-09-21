import { Transform, TransformContext } from '../transform'
import {
  NodeTypes,
  ElementTypes,
  CallExpression,
  ObjectExpression,
  ElementNode
} from '../ast'

// generate a JavaScript AST for this element's codegen
export const prepareElementForCodegen: Transform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (
      node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT
    ) {
      const isComponent = node.tagType === ElementTypes.ELEMENT
      const hasProps = node.attrs.length > 0 || node.directives.length > 0
      const hasChildren = node.children.length > 0

      const args: CallExpression['arguments'] = [
        isComponent ? node.tag : `"${node.tag}"`
      ]
      // props
      if (hasProps) {
        args.push(buildProps(node))
      }
      // children
      if (hasChildren) {
        if (!hasProps) {
          // placeholder for null props, but use `0` for more condense code
          args.push(`0`)
        }
        args.push(isComponent ? buildSlots(node, context) : node.children)
      }

      node.codegenNode = {
        type: NodeTypes.CALL_EXPRESSION,
        loc: node.loc,
        callee: `h`,
        arguments: args
      }
    }
  }
}

function buildProps({ loc, attrs }: ElementNode): ObjectExpression {
  return {
    type: NodeTypes.OBJECT_EXPRESSION,
    loc,
    // At this stage we will only process static attrs. Directive bindings will
    // be handled by their respective transforms which adds/modifies the props.
    properties: attrs.map(({ name, value, loc }) => {
      return {
        type: NodeTypes.PROPERTY,
        loc,
        key: {
          type: NodeTypes.EXPRESSION,
          loc,
          content: name,
          isStatic: true
        },
        value: {
          type: NodeTypes.EXPRESSION,
          loc: value ? value.loc : loc,
          content: value ? value.content : '',
          isStatic: true
        }
      }
    })
  }
}

function buildSlots(
  { loc, children }: ElementNode,
  context: TransformContext
): ObjectExpression {
  const slots: ObjectExpression = {
    type: NodeTypes.OBJECT_EXPRESSION,
    loc,
    properties: []
  }

  // TODO

  return slots
}
