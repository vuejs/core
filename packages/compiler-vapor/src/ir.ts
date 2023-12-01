import type {
  ExpressionNode,
  RootNode,
  SourceLocation,
} from '@vue/compiler-dom'

export enum IRNodeTypes {
  ROOT,
  TEMPLATE_FACTORY,
  FRAGMENT_FACTORY,

  SET_PROP,
  SET_TEXT,
  SET_EVENT,
  SET_HTML,

  INSERT_NODE,
  PREPEND_NODE,
  APPEND_NODE,
  CREATE_TEXT_NODE,
}

export interface BaseIRNode {
  type: IRNodeTypes
  loc: SourceLocation
}

// TODO refactor
export type VaporHelper = keyof typeof import('../../runtime-vapor/src')

export interface RootIRNode extends BaseIRNode {
  type: IRNodeTypes.ROOT
  source: string
  node: RootNode
  template: Array<TemplateFactoryIRNode | FragmentFactoryIRNode>
  dynamic: IRDynamicInfo
  effect: IREffect[]
  operation: OperationNode[]
  helpers: Set<string>
  vaporHelpers: Set<VaporHelper>
}

export interface TemplateFactoryIRNode extends BaseIRNode {
  type: IRNodeTypes.TEMPLATE_FACTORY
  template: string
}

export interface FragmentFactoryIRNode extends BaseIRNode {
  type: IRNodeTypes.FRAGMENT_FACTORY
}

export interface SetPropIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_PROP
  element: number
  name: IRExpression
  value: IRExpression
}

export interface SetTextIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
  value: IRExpression
}

export interface SetEventIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  name: IRExpression
  value: IRExpression
  modifiers: string[]
}

export interface SetHtmlIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_HTML
  element: number
  value: IRExpression
}

export interface CreateTextNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.CREATE_TEXT_NODE
  id: number
  value: IRExpression
}

export interface InsertNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.INSERT_NODE
  element: number | number[]
  parent: number
  anchor: number
}

export interface PrependNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.PREPEND_NODE
  elements: number[]
  parent: number
}

export interface AppendNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.APPEND_NODE
  elements: number[]
  parent: number
}

export type IRNode =
  | OperationNode
  | RootIRNode
  | TemplateFactoryIRNode
  | FragmentFactoryIRNode
export type OperationNode =
  | SetPropIRNode
  | SetTextIRNode
  | SetEventIRNode
  | SetHtmlIRNode
  | CreateTextNodeIRNode
  | InsertNodeIRNode
  | PrependNodeIRNode
  | AppendNodeIRNode

export interface IRDynamicInfo {
  id: number | null
  referenced: boolean
  /** created by DOM API */
  ghost: boolean
  placeholder: number | null
  children: IRDynamicChildren
}
export type IRDynamicChildren = Record<number, IRDynamicInfo>

export type IRExpression = ExpressionNode | string
export interface IREffect {
  // TODO multi-expression effect
  expressions: IRExpression[]
  operations: OperationNode[]
}
