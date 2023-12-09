import type {
  CompoundExpressionNode,
  DirectiveNode,
  RootNode,
  SimpleExpressionNode,
  SourceLocation,
} from '@vue/compiler-dom'
import type { Prettify } from '@vue/shared'
import type { DirectiveTransform, NodeTransform } from './transform'

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

  WITH_DIRECTIVE,
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
  key: IRExpression
  value: IRExpression
  runtimeCamelize: boolean
}

export interface SetTextIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
  value: IRExpression
}

export type KeyOverride = [find: string, replacement: string]
export interface SetEventIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  key: IRExpression
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

export interface WithDirectiveIRNode extends BaseIRNode {
  type: IRNodeTypes.WITH_DIRECTIVE
  element: number
  dir: VaporDirectiveNode
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
  | WithDirectiveIRNode

export interface IRDynamicInfo {
  id: number | null
  referenced: boolean
  /** created by DOM API */
  ghost: boolean
  placeholder: number | null
  children: IRDynamicChildren
}
export type IRDynamicChildren = Record<number, IRDynamicInfo>

export type IRExpression = SimpleExpressionNode | string
export interface IREffect {
  // TODO multi-expression effect
  expressions: IRExpression[]
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
