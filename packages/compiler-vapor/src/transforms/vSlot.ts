import {
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  type TemplateChildNode,
  createCompilerError,
  isTemplateNode,
  isVSlot,
} from '@vue/compiler-dom'
import type { NodeTransform, TransformContext } from '../transform'
import { newBlock } from './utils'
import {
  DynamicFlag,
  type IRFor,
  type IRSlotDynamic,
  type IRSlotDynamicBasic,
  type IRSlotDynamicConditional,
  IRSlotType,
  type IRSlots,
  type IRSlotsStatic,
  type SlotBlockIRNode,
  type VaporDirectiveNode,
} from '../ir'
import { findDir, resolveExpression } from '../utils'
import { markNonTemplate } from './transformText'

export const transformVSlot: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return

  const dir = findDir(node, 'slot', true)
  const { tagType, children } = node
  const { parent } = context

  const isComponent = tagType === ElementTypes.COMPONENT
  const isSlotTemplate =
    isTemplateNode(node) &&
    parent &&
    parent.node.type === NodeTypes.ELEMENT &&
    parent.node.tagType === ElementTypes.COMPONENT

  if (isComponent && children.length) {
    return transformComponentSlot(
      node,
      dir,
      context as TransformContext<ElementNode>,
    )
  } else if (isSlotTemplate && dir) {
    return transformTemplateSlot(
      node,
      dir,
      context as TransformContext<ElementNode>,
    )
  } else if (!isComponent && dir) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, dir.loc),
    )
  }
}

// <Foo v-slot:default>
function transformComponentSlot(
  node: ElementNode,
  dir: VaporDirectiveNode | undefined,
  context: TransformContext<ElementNode>,
) {
  const { children } = node
  const arg = dir && dir.arg

  // whitespace: 'preserve'
  const emptyTextNodes: TemplateChildNode[] = []
  const nonSlotTemplateChildren = children.filter(n => {
    if (isNonWhitespaceContent(n)) {
      return !(n.type === NodeTypes.ELEMENT && n.props.some(isVSlot))
    } else {
      emptyTextNodes.push(n)
    }
  })
  if (!nonSlotTemplateChildren.length) {
    emptyTextNodes.forEach(n => {
      markNonTemplate(n, context)
    })
  }

  const [block, onExit] = createSlotBlock(node, dir, context)

  const { slots } = context

  return () => {
    onExit()

    const hasOtherSlots = !!slots.length
    if (dir && hasOtherSlots) {
      // already has on-component slot - this is incorrect usage.
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE, dir.loc),
      )
      return
    }

    if (nonSlotTemplateChildren.length) {
      if (hasStaticSlot(slots, 'default')) {
        context.options.onError(
          createCompilerError(
            ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN,
            nonSlotTemplateChildren[0].loc,
          ),
        )
      } else {
        registerSlot(slots, arg, block)
        context.slots = slots
      }
    } else if (hasOtherSlots) {
      context.slots = slots
    }
  }
}

// <template #foo>
function transformTemplateSlot(
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
) {
  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE

  const arg = dir.arg && resolveExpression(dir.arg)
  const vFor = findDir(node, 'for')
  const vIf = findDir(node, 'if')
  const vElse = findDir(node, /^else(-if)?$/, true /* allowEmpty */)
  const { slots } = context
  const [block, onExit] = createSlotBlock(node, dir, context)

  if (!vFor && !vIf && !vElse) {
    const slotName = arg ? arg.isStatic && arg.content : 'default'
    if (slotName && hasStaticSlot(slots, slotName)) {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES, dir.loc),
      )
    } else {
      registerSlot(slots, arg, block)
    }
  } else if (vIf) {
    registerDynamicSlot(slots, {
      slotType: IRSlotType.CONDITIONAL,
      condition: vIf.exp!,
      positive: {
        slotType: IRSlotType.DYNAMIC,
        name: arg!,
        fn: block,
      },
    })
  } else if (vElse) {
    const vIfSlot = slots[slots.length - 1] as IRSlotDynamic
    if (vIfSlot.slotType === IRSlotType.CONDITIONAL) {
      let ifNode = vIfSlot
      while (
        ifNode.negative &&
        ifNode.negative.slotType === IRSlotType.CONDITIONAL
      )
        ifNode = ifNode.negative
      const negative: IRSlotDynamicBasic | IRSlotDynamicConditional = vElse.exp
        ? {
            slotType: IRSlotType.CONDITIONAL,
            condition: vElse.exp,
            positive: {
              slotType: IRSlotType.DYNAMIC,
              name: arg!,
              fn: block,
            },
          }
        : {
            slotType: IRSlotType.DYNAMIC,
            name: arg!,
            fn: block,
          }
      ifNode.negative = negative
    } else {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, vElse.loc),
      )
    }
  } else if (vFor) {
    if (vFor.forParseResult) {
      registerDynamicSlot(slots, {
        slotType: IRSlotType.LOOP,
        name: arg!,
        fn: block,
        loop: vFor.forParseResult as IRFor,
      })
    } else {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION, vFor.loc),
      )
    }
  }

  return onExit
}

function ensureStaticSlots(slots: IRSlots[]): IRSlotsStatic['slots'] {
  let lastSlots = slots[slots.length - 1]
  if (!slots.length || lastSlots.slotType !== IRSlotType.STATIC) {
    slots.push(
      (lastSlots = {
        slotType: IRSlotType.STATIC,
        slots: {},
      }),
    )
  }
  return lastSlots.slots
}

function registerSlot(
  slots: IRSlots[],
  name: SimpleExpressionNode | undefined,
  block: SlotBlockIRNode,
) {
  const isStatic = !name || name.isStatic
  if (isStatic) {
    const staticSlots = ensureStaticSlots(slots)
    staticSlots[name ? name.content : 'default'] = block
  } else {
    slots.push({
      slotType: IRSlotType.DYNAMIC,
      name: name!,
      fn: block,
    })
  }
}

function registerDynamicSlot(allSlots: IRSlots[], dynamic: IRSlotDynamic) {
  allSlots.push(dynamic)
}

function hasStaticSlot(slots: IRSlots[], name: string) {
  return slots.some(slot => {
    if (slot.slotType === IRSlotType.STATIC) return !!slot.slots[name]
  })
}

function createSlotBlock(
  slotNode: ElementNode,
  dir: VaporDirectiveNode | undefined,
  context: TransformContext<ElementNode>,
): [SlotBlockIRNode, () => void] {
  const block: SlotBlockIRNode = newBlock(slotNode)
  block.props = dir && dir.exp
  const exitBlock = context.enterBlock(block)
  return [block, exitBlock]
}

function isNonWhitespaceContent(node: TemplateChildNode): boolean {
  if (node.type !== NodeTypes.TEXT) return true
  return !!node.content.trim()
}
