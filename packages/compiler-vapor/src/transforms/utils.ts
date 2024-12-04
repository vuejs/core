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
})

export function wrapTemplate(node: ElementNode, dirs: string[]): TemplateNode {
  if (node.tagType === ElementTypes.TEMPLATE) {
    return node
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
