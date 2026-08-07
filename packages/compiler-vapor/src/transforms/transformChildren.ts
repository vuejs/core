import { type ElementNode, ElementTypes, NodeTypes } from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  transformNode,
} from '../transform'
import { DynamicFlag, IRNodeTypes, isBlockOperation } from '../ir'
import {
  getChildTemplateCloseState,
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
  const childTemplateCloseState =
    !isFragment && !useCreateElement
      ? getChildTemplateCloseState(context as TransformContext<ElementNode>)
      : undefined

  for (const [i, child] of node.children.entries()) {
    const childContext = context.create(child, i)
    const isInSameTemplate =
      childTemplateCloseState &&
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT &&
      isInSameTemplateAsParent(childContext as TransformContext<ElementNode>)
    childContext.templateCloseTags = isInSameTemplate
      ? childTemplateCloseState.tags
      : undefined
    childContext.templateCloseBlocks = isInSameTemplate
      ? childTemplateCloseState.blocks
      : false
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
  const children = context.dynamic.children

  // The index of the last child that materializes in the parent template.
  // Dynamic children before it are anchored by their own `<!>` placeholder;
  // dynamic children after it are appends and need no placeholder.
  let lastTemplateIndex = -1
  for (let i = children.length - 1; i >= 0; i--) {
    if (!(children[i].flags & DynamicFlag.NON_TEMPLATE)) {
      lastTemplateIndex = i
      break
    }
  }

  // Logical unit counter. Each template child (placeholders included) and
  // each trailing dynamic block occupies one SSR logical unit; for template
  // children the unit index equals the CSR element index by construction,
  // which is what lets hydration reuse the CSR locators unchanged.
  let unitIndex = 0

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      let anchor: number | undefined
      if (index < lastTemplateIndex) {
        // anchored insert: own `<!>` placeholder in the parent template,
        // located at runtime and passed as the insertion anchor
        context.childrenTemplate[index] = `<!>`
        child.flags =
          (child.flags - DynamicFlag.NON_TEMPLATE) | DynamicFlag.REFERENCED
        anchor = child.anchor = context.increaseId()
      }
      if (child.template != null) {
        // template node due to invalid nesting - generate actual insertion,
        // appended when no anchor was assigned
        child.operation = {
          type: IRNodeTypes.INSERT_NODE,
          elements: [child.id!],
          parent: context.reference(),
          anchor,
        }
      } else if (child.operation && isBlockOperation(child.operation)) {
        child.operation.parent = context.reference()
        if (anchor !== undefined) {
          child.operation.anchor = anchor
        } else {
          // append: the block's SSR output starts at logical unit `unitIndex`
          child.operation.appendIndex = unitIndex
        }
      }
      unitIndex++
    } else if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
      unitIndex++
    }
  }
}
