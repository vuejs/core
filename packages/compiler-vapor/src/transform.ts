import {
  RootNode,
  TemplateChildNode,
  ElementNode,
  AttributeNode,
  SourceLocation,
  NodeTypes,
  InterpolationNode
} from '@vue/compiler-dom'
import { TransformOptions } from 'vite'

export const enum IRNodeTypes {
  ROOT,
  TEMPLATE_GENERATOR
}

export interface IRNode {
  type: IRNodeTypes
  loc: SourceLocation
}

export interface RootIRNode extends IRNode {
  type: IRNodeTypes.ROOT
  template: Array<TemplateGeneratorIRNode>
  helpers: Set<string>
}

export interface TemplateGeneratorIRNode extends IRNode {
  type: IRNodeTypes.TEMPLATE_GENERATOR
  template: string
}

// AST -> IR
export function transform(
  root: RootNode,
  options: TransformOptions = {}
): RootIRNode {
  const template = transformChildren(root.children)

  return {
    type: IRNodeTypes.ROOT,
    loc: root.loc,
    template: [
      {
        type: IRNodeTypes.TEMPLATE_GENERATOR,
        template,
        loc: root.loc
      }
    ],
    helpers: new Set(['template'])
  }
}

function transformChildren(children: TemplateChildNode[]) {
  let template: string = ''
  children.forEach((child, i) => walkNode(child, children.length > i + 1))
  return template

  function walkNode(node: TemplateChildNode, hasSibling: boolean) {
    switch (node.type) {
      case 1 satisfies NodeTypes.ELEMENT: {
        template += transformElement(node, hasSibling)
        break
      }
      case 2 satisfies NodeTypes.TEXT:
        template += node.content
        break
      case 3 satisfies NodeTypes.COMMENT:
        template += `<!--${node.content}-->`
        break
      case 5 satisfies NodeTypes.INTERPOLATION:
        template += transformInterpolation(node)
        break
      // case 12 satisfies NodeTypes.TEXT_CALL:
      //   template += node.content
      default:
        template += `[${node.type}]`
    }
  }
}

function transformInterpolation(node: InterpolationNode) {
  // TODO
  if (node.content.type === (4 satisfies NodeTypes.SIMPLE_EXPRESSION)) {
    return `{{ ${node.content.content} }}`
  }
  return '[EXP]'
  // return `{{${node.content.content}}}`
}

function transformElement(node: ElementNode, hasSibling: boolean) {
  const { tag, props, children } = node
  let template = `<${tag}`
  const propsTemplate = props
    .filter(
      (prop): prop is AttributeNode =>
        prop.type === (6 satisfies NodeTypes.ATTRIBUTE)
    )
    .map(prop => transformProp(prop))
    .join(' ')

  if (propsTemplate) template += ' ' + propsTemplate
  template += `>`

  if (children.length > 0) {
    template += transformChildren(children)
  }

  template += `</${tag}>`

  return template
}

function transformProp(prop: AttributeNode) {
  const { name, value } = prop
  if (value) return `${name}="${value.content}"`
  return name
}
