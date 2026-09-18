import type { SimpleExpressionNode } from '@vue/compiler-dom'
import type { DirectiveTransformResult } from '../transform'
import type { BlockIRNode, IRFor } from './index'

// props
export interface IRProp extends Omit<DirectiveTransformResult, 'value'> {
  values: SimpleExpressionNode[]
}

export enum IRDynamicPropsKind {
  EXPRESSION, // v-bind="value"
  ATTRIBUTE, // v-bind:[foo]="value"
}

export type IRPropsStatic = IRProp[]
export interface IRPropsDynamicExpression {
  kind: IRDynamicPropsKind.EXPRESSION
  value: SimpleExpressionNode
  handler?: boolean
}
export interface IRPropsDynamicAttribute extends IRProp {
  kind: IRDynamicPropsKind.ATTRIBUTE
}
export type IRProps =
  | IRPropsStatic
  | IRPropsDynamicAttribute
  | IRPropsDynamicExpression

// slots
export interface SlotBlockIRNode extends BlockIRNode {
  props?: SimpleExpressionNode
}

export enum IRSlotType {
  STATIC,
  DYNAMIC,
  LOOP,
  CONDITIONAL,
  EXPRESSION, // JSX only
}
export type IRSlotsStatic = {
  slotType: IRSlotType.STATIC
  slots: Record<string, SlotBlockIRNode>
}
export interface IRSlotDynamicBasic {
  slotType: IRSlotType.DYNAMIC
  name: SimpleExpressionNode
  fn: SlotBlockIRNode
  // Declaration index among the owning component's dynamic slots, emitted as
  // the slot record's `key`. See `keyDynamicSlots` in transforms/vSlot.ts.
  //
  // Optional rather than required for two reasons: the numbering pass runs when
  // the owning component's transform exits, so records carry no key while they
  // are still being collected; and this IR is public, so transforms built on it
  // outside this package (the vapor JSX compiler) can keep producing records
  // without one. Codegen simply omits the key for those, leaving the slot
  // fragment to fall back to keying on the slot function.
  key?: string
}
export interface IRSlotDynamicLoop {
  slotType: IRSlotType.LOOP
  name: SimpleExpressionNode
  fn: SlotBlockIRNode
  loop: IRFor
  keyProp?: SimpleExpressionNode
}
export interface IRSlotDynamicConditional {
  slotType: IRSlotType.CONDITIONAL
  condition: SimpleExpressionNode
  positive: IRSlotDynamicBasic
  negative?: IRSlotDynamicBasic | IRSlotDynamicConditional
}
export interface IRSlotsExpression {
  slotType: IRSlotType.EXPRESSION
  slots: SimpleExpressionNode
}

export type IRSlotDynamic =
  | IRSlotDynamicBasic
  | IRSlotDynamicLoop
  | IRSlotDynamicConditional
export type IRSlots = IRSlotsStatic | IRSlotDynamic | IRSlotsExpression
