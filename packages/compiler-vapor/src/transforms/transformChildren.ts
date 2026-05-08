import { type ElementNode, ElementTypes, NodeTypes } from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  transformNode,
} from '../transform'
import {
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  isBlockOperation,
} from '../ir'
import {
  getChildTemplateCloseTags,
  isInSameTemplateAsParent,
  shouldUseCreateElement,
} from './transformElement'

export const transformChildren: NodeTransform = (node, context) => {
  const isFragment =
    node.type === NodeTypes.ROOT ||
    (node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.TEMPLATE ||
        node.tagType === ElementTypes.COMPONENT))

  if (!isFragment && node.type !== NodeTypes.ELEMENT) return

  const useCreateElement =
    node.type === NodeTypes.ELEMENT &&
    shouldUseCreateElement(node, context as TransformContext<ElementNode>)
  const childTemplateCloseTags =
    !isFragment && !useCreateElement
      ? getChildTemplateCloseTags(context as TransformContext<ElementNode>)
      : undefined

  for (const [i, child] of node.children.entries()) {
    const childContext = context.create(child, i)
    childContext.templateCloseTags =
      childTemplateCloseTags &&
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT &&
      isInSameTemplateAsParent(childContext as TransformContext<ElementNode>)
        ? childTemplateCloseTags
        : undefined
    if (isFragment || useCreateElement) {
      childContext.hasInlineAncestorNeedingClose = false
    }
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
    } else if (useCreateElement) {
      const createsNode =
        childContext.template !== '' ||
        childDynamic.template != null ||
        childDynamic.id !== undefined ||
        childDynamic.operation !== undefined ||
        childDynamic.hasDynamicChild === true

      if (createsNode) {
        // createElement-backed parents don't materialize childNodes from a
        // static HTML string, so every real child node must be inserted.
        childContext.reference()
        childContext.registerTemplate()
        childDynamic.flags |= DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE
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
  let staticCount = 0
  const children = context.dynamic.children

  // Track logical index for each child.
  // logicalIndex represents the position in SSR DOM, used during hydration
  // to locate the correct DOM node. Each child (static element, component,
  // v-if/v-else-if/v-else chain, v-for, slot) counts as one logical unit.
  let logicalIndex = 0

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      child.logicalIndex = logicalIndex
      prevDynamics.push(child)
      logicalIndex++
    }

    if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
      child.logicalIndex = logicalIndex
      if (prevDynamics.length) {
        if (staticCount) {
          context.childrenTemplate[index - prevDynamics.length] = `<!>`
          prevDynamics[0].flags -= DynamicFlag.NON_TEMPLATE
          const anchor = (prevDynamics[0].anchor = context.increaseId())
          registerInsertion(prevDynamics, context, anchor)
        } else {
          registerInsertion(prevDynamics, context, -1 /* prepend */)
        }
        prevDynamics = []
      }
      staticCount++
      logicalIndex++
    }
  }

  if (prevDynamics.length) {
    registerInsertion(
      prevDynamics,
      context,
      // the logical index of append child
      prevDynamics[0].logicalIndex!,
      true,
    )
  }
}

function registerInsertion(
  dynamics: IRDynamicInfo[],
  context: TransformContext,
  anchor: number,
  append?: boolean,
) {
  for (const child of dynamics) {
    const logicalIndex = child.logicalIndex
    if (child.template != null) {
      // template node due to invalid nesting - generate actual insertion
      context.registerOperation({
        type: IRNodeTypes.INSERT_NODE,
        elements: dynamics.map(child => child.id!),
        parent: context.reference(),
        anchor: append ? undefined : anchor,
      })
    } else if (child.operation && isBlockOperation(child.operation)) {
      // block types
      child.operation.parent = context.reference()
      child.operation.anchor = anchor
      child.operation.logicalIndex = logicalIndex
      child.operation.append = append
    }
  }
}
