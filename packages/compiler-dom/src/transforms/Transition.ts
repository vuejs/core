import {
  type ComponentNode,
  ElementTypes,
  type IfBranchNode,
  type NodeTransform,
  NodeTypes,
} from '@vue/compiler-core'
import { TRANSITION } from '../runtimeHelpers'
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

export const transformTransition: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    const component = context.isBuiltInComponent(node.tag)
    if (component === TRANSITION) {
      return () => {
        if (!node.children.length) {
          return
        }

        // warn multiple transition children
        if (hasMultipleChildren(node)) {
          context.onError(
            createDOMCompilerError(
              DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN,
              {
                start: node.children[0].loc.start,
                end: node.children[node.children.length - 1].loc.end,
                source: '',
              },
            ),
          )
        }

        // check if it's s single child w/ v-show
        // if yes, inject "persisted: true" to the transition props
        const child = node.children[0]
        if (child.type === NodeTypes.ELEMENT) {
          for (const p of child.props) {
            if (p.type === NodeTypes.DIRECTIVE && p.name === 'show') {
              node.props.push({
                type: NodeTypes.ATTRIBUTE,
                name: 'persisted',
                nameLoc: node.loc,
                value: undefined,
                loc: node.loc,
              })
            }
          }
        }
      }
    }
  }
}

function hasMultipleChildren(node: ComponentNode | IfBranchNode): boolean {
  // #1352 filter out potential comment nodes.
  const children = (node.children = node.children.filter(
    c =>
      c.type !== NodeTypes.COMMENT &&
      !(c.type === NodeTypes.TEXT && !c.content.trim()),
  ))
  const child = children[0]
  return (
    children.length !== 1 ||
    child.type === NodeTypes.FOR ||
    (child.type === NodeTypes.IF && child.branches.some(hasMultipleChildren))
  )
}
