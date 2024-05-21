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
import {
  type BlockIRNode,
  type ComponentBasicDynamicSlot,
  type ComponentConditionalDynamicSlot,
  DynamicFlag,
  DynamicSlotType,
  type IRFor,
  type VaporDirectiveNode,
} from '../ir'
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

    const vFor = findDir(node, 'for')
    const vIf = findDir(node, 'if')
    const vElse = findDir(node, /^else(-if)?$/, true /* allowEmpty */)
    const slots = context.slots!
    const dynamicSlots = context.dynamicSlots!

    const [block, onExit] = createSlotBlock(
      node,
      context as TransformContext<ElementNode>,
    )

    arg &&= resolveExpression(arg)

    if ((!arg || arg.isStatic) && !vFor && !vIf && !vElse) {
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
    } else if (vIf) {
      dynamicSlots.push({
        slotType: DynamicSlotType.CONDITIONAL,
        condition: vIf.exp!,
        positive: {
          slotType: DynamicSlotType.BASIC,
          name: arg!,
          fn: block,
          key: 0,
        },
      })
    } else if (vElse) {
      const vIfIR = dynamicSlots[dynamicSlots.length - 1]
      if (vIfIR.slotType === DynamicSlotType.CONDITIONAL) {
        let ifNode = vIfIR
        while (
          ifNode.negative &&
          ifNode.negative.slotType === DynamicSlotType.CONDITIONAL
        )
          ifNode = ifNode.negative
        const negative:
          | ComponentBasicDynamicSlot
          | ComponentConditionalDynamicSlot = vElse.exp
          ? {
              slotType: DynamicSlotType.CONDITIONAL,
              condition: vElse.exp,
              positive: {
                slotType: DynamicSlotType.BASIC,
                name: arg!,
                fn: block,
                key: ifNode.positive.key! + 1,
              },
            }
          : {
              slotType: DynamicSlotType.BASIC,
              name: arg!,
              fn: block,
              key: ifNode.positive.key! + 1,
            }
        ifNode.negative = negative
      } else {
        context.options.onError(
          createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, vElse.loc),
        )
      }
    } else if (vFor) {
      if (vFor.forParseResult) {
        dynamicSlots.push({
          slotType: DynamicSlotType.LOOP,
          name: arg!,
          fn: block,
          loop: vFor.forParseResult as IRFor,
        })
      } else {
        context.options.onError(
          createCompilerError(
            ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION,
            vFor.loc,
          ),
        )
      }
    } else {
      dynamicSlots.push({
        slotType: DynamicSlotType.BASIC,
        name: arg!,
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
