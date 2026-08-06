import type {
  CompoundExpressionNode,
  DirectiveNode,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
} from '@vue/compiler-dom'
import type { Namespace, Prettify } from '@vue/shared'
import type { DirectiveTransform, NodeTransform } from '../transform'
import type { IRProp, IRProps, IRSlots } from './component'

export * from './component'

export enum IRNodeTypes {
  ROOT,
  BLOCK,

  SET_BLOCK_KEY,
  SET_PROP,
  SET_DYNAMIC_PROPS,
  SET_TEXT,
  SET_EVENT,
  SET_DYNAMIC_EVENTS,
  SET_HTML,
  SET_TEMPLATE_REF,

  INSERT_NODE,
  CREATE_COMPONENT_NODE,
  SLOT_OUTLET_NODE,

  DIRECTIVE,

  IF,
  FOR,
  KEY,

  GET_TEXT_CHILD,
}

export interface BaseIRNode {
  type: IRNodeTypes
}

export interface EffectBoundary {
  operationIndex?: number
  effectIndex?: number
}

/**
 * Insertion state shared by block operations (if / for / key / component /
 * slot outlet). `anchor` references a template `<!>` placeholder id;
 * `appendIndex` is the hydration start unit index for appends.
 */
export interface InsertionState {
  parent?: number
  anchor?: number
  appendIndex?: number
}

export type CoreHelper = keyof typeof import('packages/runtime-dom/src')

export type VaporHelper = keyof typeof import('packages/runtime-vapor/src')

export interface BlockIRNode extends BaseIRNode {
  type: IRNodeTypes.BLOCK
  node: RootNode | TemplateChildNode
  dynamic: IRDynamicInfo
  tempId: number
  effect: IREffect[]
  operation: OperationNode[]
  returns: number[]
}

export interface RootIRNode {
  type: IRNodeTypes.ROOT
  node: RootNode
  source: string
  template: TemplateRegistry
  component: Set<string>
  directive: Set<string>
  block: BlockIRNode
  hasTemplateRef: boolean
}

export interface IRTemplate {
  content: string
  ns: Namespace
  root: boolean
  static: boolean
}

export class TemplateRegistry {
  entries: IRTemplate[] = []

  keys(): string[] {
    return this.entries.map(({ content }) => content)
  }
}

export interface IfIRNode extends BaseIRNode, EffectBoundary, InsertionState {
  type: IRNodeTypes.IF
  id: number
  blockShape: number
  condition: SimpleExpressionNode
  positive: BlockIRNode
  negative?: BlockIRNode | IfIRNode
  once?: boolean
  slotRoot?: boolean
  index?: number
}

export interface IRFor {
  source: SimpleExpressionNode
  value?: SimpleExpressionNode
  key?: SimpleExpressionNode
  index?: SimpleExpressionNode
}

export interface ForIRNode
  extends BaseIRNode, IRFor, EffectBoundary, InsertionState {
  type: IRNodeTypes.FOR
  id: number
  keyProp?: SimpleExpressionNode
  render: BlockIRNode
  once: boolean
  slotRoot?: boolean
  component: boolean
  onlyChild: boolean
}

export interface KeyIRNode extends BaseIRNode, EffectBoundary, InsertionState {
  type: IRNodeTypes.KEY
  id: number
  value: SimpleExpressionNode
  block: BlockIRNode
  slotRoot?: boolean
}

export interface SetBlockKeyIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_BLOCK_KEY
  element: number
  value: SimpleExpressionNode
}

export interface SetPropIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_PROP
  element: number
  prop: IRProp
  tag: string
}

export interface SetDynamicPropsIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_DYNAMIC_PROPS
  element: number
  props: IRProps[]
  tag: string
}

export interface SetDynamicEventsIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_DYNAMIC_EVENTS
  element: number
  event: SimpleExpressionNode
}

export interface SetTextIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
  values: SimpleExpressionNode[]
  generated?: boolean // whether this is a generated empty text node by `processTextLikeContainer`
}

export type KeyOverride = [find: string, replacement: string]
export interface SetEventIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  key: SimpleExpressionNode
  value?: SimpleExpressionNode
  modifiers: {
    // modifiers for addEventListener() options, e.g. .passive & .capture
    options: string[]
    // modifiers that needs runtime guards, withKeys
    keys: string[]
    // modifiers that needs runtime guards, withModifiers
    nonKeys: string[]
  }
  keyOverride?: KeyOverride
  delegate: boolean
  /** Whether it's in effect */
  effect: boolean
}

export interface SetHtmlIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_HTML
  element: number
  value: SimpleExpressionNode
}

export interface SetTemplateRefIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_TEMPLATE_REF
  element: number
  value: SimpleExpressionNode
  refFor: boolean
  effect: boolean
}

export interface InsertNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.INSERT_NODE
  elements: number[]
  parent: number
  anchor?: number
}

export interface DirectiveIRNode extends BaseIRNode {
  type: IRNodeTypes.DIRECTIVE
  element: number
  dir: VaporDirectiveNode
  name: string
  builtin?: boolean
  asset?: boolean
  modelType?: 'text' | 'dynamic' | 'radio' | 'checkbox' | 'select'
}

export interface CreateComponentIRNode
  extends BaseIRNode, EffectBoundary, InsertionState {
  type: IRNodeTypes.CREATE_COMPONENT_NODE
  id: number
  tag: string
  props: IRProps[]
  slots: IRSlots[]
  asset: boolean
  root: boolean
  once: boolean
  slotRoot?: boolean
  dynamic?: SimpleExpressionNode
  useCreateElement: boolean
}

export interface SlotOutletIRNode
  extends BaseIRNode, EffectBoundary, InsertionState {
  type: IRNodeTypes.SLOT_OUTLET_NODE
  id: number
  name: SimpleExpressionNode
  props: IRProps[]
  fallback?: BlockIRNode
  flags: number
}

export interface GetTextChildIRNode extends BaseIRNode {
  type: IRNodeTypes.GET_TEXT_CHILD
  parent: number
}

export type IRNode = OperationNode | RootIRNode
export type OperationNode =
  | SetBlockKeyIRNode
  | SetPropIRNode
  | SetDynamicPropsIRNode
  | SetTextIRNode
  | SetEventIRNode
  | SetDynamicEventsIRNode
  | SetHtmlIRNode
  | SetTemplateRefIRNode
  | InsertNodeIRNode
  | DirectiveIRNode
  | IfIRNode
  | ForIRNode
  | KeyIRNode
  | CreateComponentIRNode
  | SlotOutletIRNode
  | GetTextChildIRNode

export enum DynamicFlag {
  NONE = 0,
  /**
   * This node is referenced and needs to be saved as a variable.
   */
  REFERENCED = 1,
  /**
   * This node is not generated from template, but is generated dynamically.
   */
  NON_TEMPLATE = 1 << 1,
  /**
   * This node needs to be inserted back into the template.
   */
  INSERT = 1 << 2,
}

export interface IRDynamicInfo {
  id?: number
  flags: DynamicFlag
  anchor?: number
  children: IRDynamicInfo[]
  template?: number
  hasDynamicChild?: boolean
  operation?: OperationNode
}

export interface IREffect {
  expressions: SimpleExpressionNode[]
  operations: OperationNode[]
}

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> &
  Pick<U, Extract<keyof U, keyof T>>

export type HackOptions<T> = Prettify<
  Overwrite<
    T,
    {
      nodeTransforms?: NodeTransform[]
      directiveTransforms?: Record<string, DirectiveTransform | undefined>
    }
  >
>

export type VaporDirectiveNode = Overwrite<
  DirectiveNode,
  {
    exp: Exclude<DirectiveNode['exp'], CompoundExpressionNode>
    arg: Exclude<DirectiveNode['arg'], CompoundExpressionNode>
  }
>

export type InsertionStateTypes =
  | IfIRNode
  | ForIRNode
  | KeyIRNode
  | SlotOutletIRNode
  | CreateComponentIRNode

export function isBlockOperation(op: OperationNode): op is InsertionStateTypes {
  const type = op.type
  return (
    type === IRNodeTypes.CREATE_COMPONENT_NODE ||
    type === IRNodeTypes.SLOT_OUTLET_NODE ||
    type === IRNodeTypes.IF ||
    type === IRNodeTypes.KEY ||
    type === IRNodeTypes.FOR
  )
}
