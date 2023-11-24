import type { SourceLocation } from '@vue/compiler-dom'

export const enum IRNodeTypes {
  ROOT,
  TEMPLATE_GENERATOR,
  SET_PROP,
  SET_TEXT,
  SET_EVENT,
  SET_HTML,

  INSERT_NODE,
  TEXT_NODE,
}

export interface IRNode {
  type: IRNodeTypes
  loc: SourceLocation
}

export interface RootIRNode extends IRNode {
  type: IRNodeTypes.ROOT
  template: Array<TemplateGeneratorIRNode>
  children: DynamicChildren
  effect: Record<string, EffectNode[]>
  opration: OprationNode[]
  helpers: Set<string>
  vaporHelpers: Set<string>
}

export interface TemplateGeneratorIRNode extends IRNode {
  type: IRNodeTypes.TEMPLATE_GENERATOR
  template: string
}

export interface SetPropIRNode extends IRNode {
  type: IRNodeTypes.SET_PROP
  element: number
  name: string
}

export interface SetTextIRNode extends IRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
}

export interface SetEventIRNode extends IRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  name: string
}

export interface SetHtmlIRNode extends IRNode {
  type: IRNodeTypes.SET_HTML
  element: number
}

export type EffectNode =
  | SetPropIRNode
  | SetTextIRNode
  | SetEventIRNode
  | SetHtmlIRNode

export interface TextNodeIRNode extends IRNode {
  type: IRNodeTypes.TEXT_NODE
  id: number
  content: string
}

export interface InsertNodeIRNode extends IRNode {
  type: IRNodeTypes.INSERT_NODE
  element: number
  parent: number
  anchor: number | 'first' | 'last'
}

export type OprationNode = TextNodeIRNode | InsertNodeIRNode

export interface DynamicChild {
  id: number | null
  store: boolean
  children: DynamicChildren
}
export type DynamicChildren = Record<number, DynamicChild>
