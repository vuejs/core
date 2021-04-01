import { ComponentNode, findProp, NodeTypes } from '@vue/compiler-dom'
import { processChildren, SSRTransformContext } from '../ssrCodegenTransform'

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
      context.pushStringPart(`>`)

      processChildren(
        node.children,
        context,
        false,
        /**
         * TransitionGroup has the special runtime behavior of flattening and
         * concatenating all children into a single fragment (in order for them to
         * be pathced using the same key map) so we need to account for that here
         * by disabling nested fragment wrappers from being generated.
         */
        true
      )
      context.pushStringPart(`</`)
      context.pushStringPart(tag.exp!)
      context.pushStringPart(`>`)
    } else {
      // static tag
      context.pushStringPart(`<${tag.value!.content}>`)
      processChildren(node.children, context, false, true)
      context.pushStringPart(`</${tag.value!.content}>`)
    }
  } else {
    // fragment
    processChildren(node.children, context, true, true)
  }
}
