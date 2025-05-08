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
}
export interface IRSlotDynamicLoop {
  slotType: IRSlotType.LOOP
  name: SimpleExpressionNode
  fn: SlotBlockIRNode
  loop: IRFor
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
