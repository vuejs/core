// Vue template is a platform-agnostic superset of HTML (syntax only).
// More namespaces like SVG and MathML are declared by platform specific
// compilers.
export type Namespace = number

export const enum Namespaces {
  HTML
}

export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  EXPRESSION,
  ATTRIBUTE,
  DIRECTIVE,
  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  // codegen
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION
}

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}

export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

// The node's range. The `start` is inclusive and `end` is exclusive.
// [start, end)
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface Position {
  offset: number // from start of file
  line: number
  column: number
}

export type ParentNode = RootNode | ElementNode | IfBranchNode | ForNode

export type ChildNode =
  | ElementNode
  | ExpressionNode
  | TextNode
  | CommentNode
  | IfNode
  | ForNode

export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: ChildNode[]
  imports: string[]
  statements: string[]
}

export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  ns: Namespace
  tag: string
  tagType: ElementTypes
  isSelfClosing: boolean
  props: Array<AttributeNode | DirectiveNode>
  children: ChildNode[]
  codegenNode: CallExpression | undefined
}

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
  isEmpty: boolean
}

export interface CommentNode extends Node {
  type: NodeTypes.COMMENT
  content: string
}

export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined
}

export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[]
}

export interface ExpressionNode extends Node {
  type: NodeTypes.EXPRESSION
  content: string
  isStatic: boolean
  isInterpolation: boolean
  children?: (ExpressionNode | string)[]
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  isRoot: boolean
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: ChildNode[]
  isRoot: boolean
}

export interface ForNode extends Node {
  type: NodeTypes.FOR
  source: ExpressionNode
  valueAlias: ExpressionNode | undefined
  keyAlias: ExpressionNode | undefined
  objectIndexAlias: ExpressionNode | undefined
  children: ChildNode[]
}

// We also include a number of JavaScript AST nodes for code generation.
// The AST is an intentioanlly minimal subset just to meet the exact needs of
// Vue render function generation.
export type JSChildNode =
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ExpressionNode

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION
  callee: string // can only be imported runtime helpers, so no source location
  arguments: Array<string | JSChildNode | ChildNode[]>
}

export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION
  properties: Array<Property>
}

export interface Property extends Node {
  type: NodeTypes.JS_PROPERTY
  key: ExpressionNode
  value: ExpressionNode
}

export interface ArrayExpression extends Node {
  type: NodeTypes.JS_ARRAY_EXPRESSION
  elements: Array<string | JSChildNode>
}

export function createArrayExpression(
  elements: ArrayExpression['elements'],
  loc: SourceLocation
): ArrayExpression {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    loc,
    elements
  }
}

export function createObjectExpression(
  properties: Property[],
  loc: SourceLocation
): ObjectExpression {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc,
    properties
  }
}

export function createObjectProperty(
  key: ExpressionNode,
  value: ExpressionNode,
  loc: SourceLocation
): Property {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc,
    key,
    value
  }
}

export function createExpression(
  content: string,
  isStatic: boolean,
  loc: SourceLocation,
  isInterpolation = false
): ExpressionNode {
  return {
    type: NodeTypes.EXPRESSION,
    loc,
    content,
    isStatic,
    isInterpolation
  }
}

export function createCallExpression(
  callee: string,
  args: CallExpression['arguments'],
  loc: SourceLocation
): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args
  }
}
