import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  ComponentNode,
  TemplateChildNode
} from '@vue/compiler-core'
import { TRANSITION } from '../runtimeHelpers'
import { createDOMCompilerError, DOMErrorCodes } from '../errors'

export const warnTransitionChildren: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    const component = context.isBuiltInComponent(node.tag)
    if (component === TRANSITION && hasMultipleChildren(node)) {
      context.onError(
        createDOMCompilerError(DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN, {
          start: node.children[0].loc.start,
          end: node.children[node.children.length - 1].loc.end,
          source: ''
        })
      )
    }
  }
}

function hasMultipleChildren(node: ComponentNode): boolean {
  if (node.children.length > 1) {
    return !node.children.every(hasValidDirectives)
  }

  const child = node.children[0]
  return (
    // no child
    !!child &&
    (child.type === NodeTypes.FOR ||
      (child.type === NodeTypes.ELEMENT &&
        // disallow template
        (child.tag === 'template' ||
          // disallow v-for
          child.props.some(
            prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'for'
          ))))
  )
}

function hasValidDirectives(node: TemplateChildNode, i: number): boolean {
  return (
    node.type === NodeTypes.ELEMENT &&
    node.tag !== 'template' &&
    node.props.length > 0 &&
    // disallow multiple v-for
    !node.props.some(
      prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'for'
    ) &&
    node.props.some(
      prop =>
        prop.type === NodeTypes.DIRECTIVE &&
        ((i === 0 && prop.name === 'if') ||
          (i > 0 && (prop.name === 'else' || prop.name === 'else-if')))
    )
  )
}
