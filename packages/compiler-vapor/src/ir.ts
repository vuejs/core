import type { SourceLocation } from '@vue/compiler-dom'

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

export interface IRNode {
  type: IRNodeTypes
  loc: SourceLocation
}

export interface RootIRNode extends IRNode {
  type: IRNodeTypes.ROOT
  template: Array<TemplateFactoryIRNode | FragmentFactoryIRNode>
  dynamic: DynamicInfo
  // TODO multi-expression effect
  effect: Record<string /* expr */, OperationNode[]>
  operation: OperationNode[]
  helpers: Set<string>
  vaporHelpers: Set<string>
}

export interface TemplateFactoryIRNode extends IRNode {
  type: IRNodeTypes.TEMPLATE_FACTORY
  template: string
}

export interface FragmentFactoryIRNode extends IRNode {
  type: IRNodeTypes.FRAGMENT_FACTORY
}

export interface SetPropIRNode extends IRNode {
  type: IRNodeTypes.SET_PROP
  element: number
  name: string
  value: string
}

export interface SetTextIRNode extends IRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
  value: string
}

export interface SetEventIRNode extends IRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  name: string
  value: string
}

export interface SetHtmlIRNode extends IRNode {
  type: IRNodeTypes.SET_HTML
  element: number
  value: string
}

export interface CreateTextNodeIRNode extends IRNode {
  type: IRNodeTypes.CREATE_TEXT_NODE
  id: number
  value: string
}

export interface InsertNodeIRNode extends IRNode {
  type: IRNodeTypes.INSERT_NODE
  element: number | number[]
  parent: number
  anchor: number
}

export interface PrependNodeIRNode extends IRNode {
  type: IRNodeTypes.PREPEND_NODE
  elements: number[]
  parent: number
}

export interface AppendNodeIRNode extends IRNode {
  type: IRNodeTypes.APPEND_NODE
  elements: number[]
  parent: number
}

export type OperationNode =
  | SetPropIRNode
  | SetTextIRNode
  | SetEventIRNode
  | SetHtmlIRNode
  | CreateTextNodeIRNode
  | InsertNodeIRNode
  | PrependNodeIRNode
  | AppendNodeIRNode

export interface DynamicInfo {
  id: number | null
  referenced: boolean
  /** created by DOM API */
  ghost: boolean
  placeholder: number | null
  children: DynamicChildren
}
export type DynamicChildren = Record<number, DynamicInfo>
