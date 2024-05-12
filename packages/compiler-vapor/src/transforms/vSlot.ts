import {
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type TemplateChildNode,
  createCompilerError,
  isTemplateNode,
  isVSlot,
} from '@vue/compiler-core'
import type { NodeTransform, TransformContext } from '../transform'
import { newBlock } from './utils'
import { type BlockIRNode, DynamicFlag, type VaporDirectiveNode } from '../ir'
import { findDir, resolveExpression } from '../utils'

// TODO dynamic slots
export const transformVSlot: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return

  let dir: VaporDirectiveNode | undefined
  const { tagType, children } = node
  const { parent } = context

  const isDefaultSlot = tagType === ElementTypes.COMPONENT && children.length
  const isSlotTemplate =
    isTemplateNode(node) &&
    parent &&
    parent.node.type === NodeTypes.ELEMENT &&
    parent.node.tagType === ElementTypes.COMPONENT

  if (isDefaultSlot) {
    const defaultChildren = children.filter(
      n =>
        isNonWhitespaceContent(node) &&
        !(n.type === NodeTypes.ELEMENT && n.props.some(isVSlot)),
    )

    const [block, onExit] = createSlotBlock(
      node,
      context as TransformContext<ElementNode>,
    )

    const slots = (context.slots ||= {})
    const dynamicSlots = (context.dynamicSlots ||= [])

    return () => {
      onExit()

      if (defaultChildren.length) {
        if (slots.default) {
          context.options.onError(
            createCompilerError(
              ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN,
              defaultChildren[0].loc,
            ),
          )
        } else {
          slots.default = block
        }
        context.slots = slots
      } else if (Object.keys(slots).length) {
        context.slots = slots
      }

      if (dynamicSlots.length) context.dynamicSlots = dynamicSlots
    }
  } else if (isSlotTemplate && (dir = findDir(node, 'slot', true))) {
    let { arg } = dir

    context.dynamic.flags |= DynamicFlag.NON_TEMPLATE

    const slots = context.slots!
    const dynamicSlots = context.dynamicSlots!

    const [block, onExit] = createSlotBlock(
      node,
      context as TransformContext<ElementNode>,
    )

    arg &&= resolveExpression(arg)

    if (!arg || arg.isStatic) {
      const slotName = arg ? arg.content : 'default'

      if (slots[slotName]) {
        context.options.onError(
          createCompilerError(
            ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES,
            dir.loc,
          ),
        )
      } else {
        slots[slotName] = block
      }
    } else {
      dynamicSlots.push({
        name: arg,
        fn: block,
      })
    }
    return () => onExit()
  }
}

function createSlotBlock(
  slotNode: ElementNode,
  context: TransformContext<ElementNode>,
): [BlockIRNode, () => void] {
  const branch: BlockIRNode = newBlock(slotNode)
  const exitBlock = context.enterBlock(branch)
  return [branch, exitBlock]
}

function isNonWhitespaceContent(node: TemplateChildNode): boolean {
  if (node.type !== NodeTypes.TEXT) return true
  return !!node.content.trim()
}
