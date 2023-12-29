import {
  type AttributeNode,
  type ElementNode,
  ElementTypes,
  NodeTypes,
} from '@vue/compiler-dom'
import { isBuiltInDirective, isVoidTag } from '@vue/shared'
import type { NodeTransform, TransformContext } from '../transform'
import { IRNodeTypes, type VaporDirectiveNode } from '../ir'

export const transformElement: NodeTransform = (node, ctx) => {
  return function postTransformElement() {
    node = ctx.node

    if (
      !(
        node.type === NodeTypes.ELEMENT &&
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    ) {
      return
    }

    const { tag, props } = node
    const isComponent = node.tagType === ElementTypes.COMPONENT

    ctx.template += `<${tag}`
    if (props.length) {
      buildProps(
        node,
        ctx as TransformContext<ElementNode>,
        undefined,
        isComponent,
      )
    }
    ctx.template += `>` + ctx.childrenTemplate.join('')

    // TODO remove unnecessary close tag, e.g. if it's the last element of the template
    if (!isVoidTag(tag)) {
      ctx.template += `</${tag}>`
    }
  }
}

function buildProps(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  props: ElementNode['props'] = node.props,
  isComponent: boolean,
) {
  for (const prop of props) {
    transformProp(prop as VaporDirectiveNode | AttributeNode, node, context)
  }
}

function transformProp(
  prop: VaporDirectiveNode | AttributeNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
): void {
  const { name, loc } = prop
  if (prop.type === NodeTypes.ATTRIBUTE) {
    context.template += ` ${name}`
    if (prop.value) context.template += `="${prop.value.content}"`
    return
  }

  const directiveTransform = context.options.directiveTransforms[name]
  if (directiveTransform) {
    directiveTransform(prop, node, context)
  } else if (!isBuiltInDirective(name)) {
    context.registerOperation({
      type: IRNodeTypes.WITH_DIRECTIVE,
      element: context.reference(),
      dir: prop,
      loc,
    })
  }
}
