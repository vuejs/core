import { type ElementNode, ElementTypes, NodeTypes } from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  transformNode,
} from '../transform'
import { DynamicFlag, type IRDynamicInfo, IRNodeTypes } from '../ir'

export const transformChildren: NodeTransform = (node, context) => {
  const isFragment =
    node.type === NodeTypes.ROOT ||
    (node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.TEMPLATE ||
        node.tagType === ElementTypes.COMPONENT))

  if (!isFragment && node.type !== NodeTypes.ELEMENT) return

  for (const [i, child] of node.children.entries()) {
    const childContext = context.create(child, i)
    transformNode(childContext)

    const childDynamic = childContext.dynamic

    if (isFragment) {
      childContext.reference()
      childContext.registerTemplate()

      if (
        !(childDynamic.flags & DynamicFlag.NON_TEMPLATE) ||
        childDynamic.flags & DynamicFlag.INSERT
      ) {
        context.block.returns.push(childContext.dynamic.id!)
      }
    } else {
      context.childrenTemplate.push(childContext.template)
    }

    if (
      childDynamic.hasDynamicChild ||
      childDynamic.id !== undefined ||
      childDynamic.flags & DynamicFlag.NON_TEMPLATE ||
      childDynamic.flags & DynamicFlag.INSERT
    ) {
      context.dynamic.hasDynamicChild = true
    }

    context.dynamic.children[i] = childDynamic
  }

  if (!isFragment) {
    processDynamicChildren(context as TransformContext<ElementNode>)
  }
}

function processDynamicChildren(context: TransformContext<ElementNode>) {
  let prevDynamics: IRDynamicInfo[] = []
  let hasStaticTemplate = false
  const children = context.dynamic.children

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      prevDynamics.push(child)
    }

    if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
      if (prevDynamics.length) {
        if (hasStaticTemplate) {
          context.childrenTemplate[index - prevDynamics.length] = `<!>`

          prevDynamics[0].flags -= DynamicFlag.NON_TEMPLATE
          const anchor = (prevDynamics[0].anchor = context.increaseId())

          context.registerOperation({
            type: IRNodeTypes.INSERT_NODE,
            elements: prevDynamics.map(child => child.id!),
            parent: context.reference(),
            anchor,
          })
        } else {
          context.registerOperation({
            type: IRNodeTypes.PREPEND_NODE,
            elements: prevDynamics.map(child => child.id!),
            parent: context.reference(),
          })
        }
        prevDynamics = []
      }
      hasStaticTemplate = true
    }
  }

  if (prevDynamics.length) {
    context.registerOperation({
      type: IRNodeTypes.INSERT_NODE,
      elements: prevDynamics.map(child => child.id!),
      parent: context.reference(),
    })
  }
}
