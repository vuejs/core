import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  createCallExpression,
  resolveComponentType,
  buildProps,
  ComponentNode,
  PORTAL,
  SUSPENSE
} from '@vue/compiler-dom'
import { SSR_RENDER_COMPONENT } from '../runtimeHelpers'
import { SSRTransformContext } from '../ssrCodegenTransform'
import { isSymbol } from '@vue/shared'

export const ssrTransformComponent: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.COMPONENT
  ) {
    return
  }

  return function ssrPostTransformComponent() {
    const component = resolveComponentType(node, context)

    if (isSymbol(component)) {
      // built-in compoonent
      if (component === PORTAL) {
        // TODO
      } else if (component === SUSPENSE) {
        // TODO fallthrough
        // TODO option to use fallback content and resolve on client
      } else {
        // TODO fallthrough for KeepAlive & Transition
      }
    }

    // note we are not passing ssr: true here because for components, v-on
    // handlers should still be passed
    const { props } = buildProps(node, context)

    // TODO slots
    // TODO option for slots bail out
    // TODO scopeId

    node.ssrCodegenNode = createCallExpression(
      context.helper(SSR_RENDER_COMPONENT),
      [
        component,
        props || `null`,
        `null`, // TODO slots
        `_parent`
      ]
    )
  }
}

export function ssrProcessComponent(
  node: ComponentNode,
  context: SSRTransformContext
) {
  context.pushStatement(node.ssrCodegenNode!)
}
