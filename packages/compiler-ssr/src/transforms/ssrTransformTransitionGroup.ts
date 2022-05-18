import {
  AttributeNode,
  buildProps,
  ComponentNode,
  createCallExpression,
  DirectiveNode,
  findProp,
  JSChildNode,
  NodeTypes,
  TransformContext
} from '@vue/compiler-dom'
import { SSR_RENDER_ATTRS } from '../runtimeHelpers'
import { processChildren, SSRTransformContext } from '../ssrCodegenTransform'
import { buildSSRProps } from './ssrTransformElement'

const wipMap = new WeakMap<ComponentNode, WIPEntry>()

interface WIPEntry {
  tag: AttributeNode | DirectiveNode
  propsExp: string | JSChildNode | null
}

// phase 1: build props
export function ssrTransformTransitionGroup(
  node: ComponentNode,
  context: TransformContext
) {
  return () => {
    const tag = findProp(node, 'tag')
    if (tag) {
      const otherProps = node.props.filter(p => p !== tag)
      const { props, directives } = buildProps(
        node,
        context,
        otherProps,
        true, /* isComponent */
        false, /* isDynamicComponent */
        true /* ssr (skip event listeners) */
      )
      let propsExp = null
      if (props || directives.length) {
        propsExp = createCallExpression(context.helper(SSR_RENDER_ATTRS), [
          buildSSRProps(props, directives, context)
        ])
      }
      wipMap.set(node, {
        tag,
        propsExp
      })
    }
  }
}

// phase 2: process children
export function ssrProcessTransitionGroup(
  node: ComponentNode,
  context: SSRTransformContext
) {
  const entry = wipMap.get(node)
  if (entry) {
    const { tag, propsExp } = entry
    if (tag.type === NodeTypes.DIRECTIVE) {
      // dynamic :tag
      context.pushStringPart(`<`)
      context.pushStringPart(tag.exp!)
      if (propsExp) {
        context.pushStringPart(propsExp)
      }
      context.pushStringPart(`>`)

      processChildren(
        node,
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
      if (propsExp) {
        context.pushStringPart(propsExp)
      }
      context.pushStringPart(`>`)
      processChildren(node, context, false, true)
      context.pushStringPart(`</${tag.value!.content}>`)
    }
  } else {
    // fragment
    processChildren(node, context, true, true)
  }
}
