import {
  type AttributeNode,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type TemplateChildNode,
  type TemplateNode,
  createSimpleExpression,
} from '@vue/compiler-dom'
import { extend } from '@vue/shared'
import { DynamicFlag, type IRDynamicInfo } from '../ir'

export const genDefaultDynamic = (): IRDynamicInfo => ({
  flags: DynamicFlag.NONE,
  children: [],
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

export const EMPTY_EXPRESSION = createSimpleExpression('', true)
