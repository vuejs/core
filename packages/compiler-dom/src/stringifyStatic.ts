import {
  NodeTypes,
  ElementNode,
  TransformContext,
  TemplateChildNode,
  SimpleExpressionNode,
  createCallExpression,
  HoistTransform,
  CREATE_STATIC
} from '@vue/compiler-core'
import { isVoidTag, isString, isSymbol, escapeHtml } from '@vue/shared'

// Turn eligible hoisted static trees into stringied static nodes, e.g.
//   const _hoisted_1 = createStaticVNode(`<div class="foo">bar</div>`)
export const stringifyStatic: HoistTransform = (node, context) => {
  if (shouldOptimize(node)) {
    return createCallExpression(context.helper(CREATE_STATIC), [
      JSON.stringify(stringifyElement(node, context))
    ])
  } else {
    return node.codegenNode!
  }
}

// Opt-in heuristics based on:
// 1. number of elements with attributes > 5.
// 2. OR: number of total nodes > 20
// For some simple trees, the performance can actually be worse.
// it is only worth it when the tree is complex enough
// (e.g. big piece of static content)
function shouldOptimize(node: ElementNode): boolean {
  let bindingThreshold = 5
  let nodeThreshold = 20

  function walk(node: ElementNode) {
    for (let i = 0; i < node.children.length; i++) {
      if (--nodeThreshold === 0) {
        return true
      }
      const child = node.children[i]
      if (child.type === NodeTypes.ELEMENT) {
        if (child.props.length > 0 && --bindingThreshold === 0) {
          return true
        }
        if (walk(child)) {
          return true
        }
      }
    }
    return false
  }

  return walk(node)
}

function stringifyElement(
  node: ElementNode,
  context: TransformContext
): string {
  let res = `<${node.tag}`
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      res += ` ${p.name}`
      if (p.value) {
        res += `="${p.value.content}"`
      }
    } else if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
      // constant v-bind, e.g. :foo="1"
      // TODO
    }
  }
  if (context.scopeId) {
    res += ` ${context.scopeId}`
  }
  res += `>`
  for (let i = 0; i < node.children.length; i++) {
    res += stringifyNode(node.children[i], context)
  }
  if (!isVoidTag(node.tag)) {
    res += `</${node.tag}>`
  }
  return res
}

function stringifyNode(
  node: string | TemplateChildNode,
  context: TransformContext
): string {
  if (isString(node)) {
    return node
  }
  if (isSymbol(node)) {
    return ``
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return stringifyElement(node, context)
    case NodeTypes.TEXT:
      return escapeHtml(node.content)
    case NodeTypes.COMMENT:
      return `<!--${escapeHtml(node.content)}-->`
    case NodeTypes.INTERPOLATION:
      // constants
      // TODO check eval
      return (node.content as SimpleExpressionNode).content
    case NodeTypes.COMPOUND_EXPRESSION:
      // TODO proper handling
      return node.children.map((c: any) => stringifyNode(c, context)).join('')
    case NodeTypes.TEXT_CALL:
      return stringifyNode(node.content, context)
    default:
      // static trees will not contain if/for nodes
      return ''
  }
}
