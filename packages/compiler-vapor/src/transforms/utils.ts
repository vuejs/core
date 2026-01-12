import {
  type AttributeNode,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type SimpleExpressionNode,
  type TemplateChildNode,
  type TemplateNode,
  createSimpleExpression,
} from '@vue/compiler-dom'
import { extend } from '@vue/shared'
import {
  type BlockIRNode,
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
} from '../ir'

export const newDynamic = (): IRDynamicInfo => ({
  flags: DynamicFlag.REFERENCED,
  children: [],
})

export const newBlock = (node: BlockIRNode['node']): BlockIRNode => ({
  type: IRNodeTypes.BLOCK,
  node,
  dynamic: newDynamic(),
  effect: [],
  operation: [],
  returns: [],
  tempId: 0,
})

export function wrapTemplate(node: ElementNode, dirs: string[]): TemplateNode {
  // If the node is already a template, check if it has other structural directives
  // that should be preserved (e.g., v-for when we're processing v-if)
  if (node.tagType === ElementTypes.TEMPLATE) {
    // Check if there are other structural directives that are NOT in the current dirs list
    const otherStructuralDirs = ['if', 'else-if', 'else', 'for']
    const hasOtherStructuralDir = node.props.some(
      prop =>
        prop.type === NodeTypes.DIRECTIVE &&
        otherStructuralDirs.includes(prop.name) &&
        !dirs.includes(prop.name),
    )

    // If no other structural directives, just return the node as is
    if (!hasOtherStructuralDir) {
      return node
    }

    // Otherwise, we need to wrap it: keep the current directive on the wrapper,
    // and pass the rest (including the other structural directive) to the child
    const reserved: Array<AttributeNode | DirectiveNode> = []
    const pass: Array<AttributeNode | DirectiveNode> = []
    node.props.forEach(prop => {
      if (prop.type === NodeTypes.DIRECTIVE && dirs.includes(prop.name)) {
        reserved.push(prop)
      } else {
        pass.push(prop)
      }
    })

    return extend({}, node, {
      type: NodeTypes.ELEMENT,
      tag: 'template',
      props: reserved,
      tagType: ElementTypes.TEMPLATE,
      children: [extend({}, node, { props: pass } as TemplateChildNode)],
    } as Partial<TemplateNode>)
  }

  const reserved: Array<AttributeNode | DirectiveNode> = []
  const pass: Array<AttributeNode | DirectiveNode> = []
  node.props.forEach(prop => {
    if (prop.type === NodeTypes.DIRECTIVE && dirs.includes(prop.name)) {
      reserved.push(prop)
    } else {
      pass.push(prop)
    }
  })

  return extend({}, node, {
    type: NodeTypes.ELEMENT,
    tag: 'template',
    props: reserved,
    tagType: ElementTypes.TEMPLATE,
    children: [extend({}, node, { props: pass } as TemplateChildNode)],
  } as Partial<TemplateNode>)
}

export const EMPTY_EXPRESSION: SimpleExpressionNode = createSimpleExpression(
  '',
  true,
)
