import {
  ComponentNode,
  findProp,
  NodeTypes,
  createCallExpression,
  buildProps,
  createTemplateLiteral,
  DirectiveNode,
  AttributeNode
} from '@vue/compiler-dom'
import { processChildren, SSRTransformContext } from '../ssrCodegenTransform'
import { SSR_RENDER_ATTRS } from '../runtimeHelpers'

function injectProp(
  node: ComponentNode,
  context: SSRTransformContext,
  tag: AttributeNode | DirectiveNode
) {
  const { props } = buildProps(
    node,
    context as any,
    node.props.filter(p => p !== tag),
    true /* ssr */
  )
  if (props) {
    context.pushStatement(
      createCallExpression(`_push`, [
        createTemplateLiteral([
          createCallExpression(context.helper(SSR_RENDER_ATTRS), [props])
        ])
      ])
    )
  }
}

export function ssrProcessTransitionGroup(
  node: ComponentNode,
  context: SSRTransformContext
) {
  const tag = findProp(node, 'tag')
  if (tag) {
    if (tag.type === NodeTypes.DIRECTIVE) {
      // dynamic :tag
      context.pushStringPart(`<`)
      context.pushStringPart(tag.exp!)
      injectProp(node, context, tag)
      context.pushStringPart(`>`)

      processChildren(
        node.children,
        context,
        false,
        /**
         * TransitionGroup has the special runtime behavior of flattening and
         * concatenating all children into a single fragment (in order for them to
         * be patched using the same key map) so we need to account for that here
         * by disabling nested fragment wrappers from being generated.
         */
        true
      )
      context.pushStringPart(`</`)
      context.pushStringPart(tag.exp!)
      context.pushStringPart(`>`)
    } else {
      // static tag
      context.pushStringPart(`<${tag.value!.content}`)
      injectProp(node, context, tag)
      context.pushStringPart(`>`)
      processChildren(node.children, context, false, true)
      context.pushStringPart(`</${tag.value!.content}>`)
    }
  } else {
    // fragment
    processChildren(node.children, context, true, true)
  }
}
