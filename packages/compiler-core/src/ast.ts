import { isString } from '@vue/shared'

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
  SIMPLE_EXPRESSION,
  INTERPOLATION,
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
  JS_ARRAY_EXPRESSION,
  JS_SLOT_FUNCTION
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

export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode

export type ChildNode =
  | ElementNode
  | InterpolationNode
  | TextNode
  | CommentNode
  | IfNode
  | ForNode

export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: ChildNode[]
  imports: string[]
  statements: string[]
  hoists: JSChildNode[]
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

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION
  content: string
  isStatic: boolean
  // an expression parsed as the params of a function will track
  // the identifiers declared inside the function body.
  identifiers?: string[]
}

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: ExpressionNode
}

// always dynamic
export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (SimpleExpressionNode | string)[]
  // an expression parsed as the params of a function will track
  // the identifiers declared inside the function body.
  identifiers?: string[]
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: ChildNode[]
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
  | SlotFunctionExpression

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION
  callee: string | ExpressionNode
  arguments: (string | JSChildNode | ChildNode[])[]
}

export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION
  properties: Array<Property>
}

export interface Property extends Node {
  type: NodeTypes.JS_PROPERTY
  key: ExpressionNode
  value: JSChildNode
}

export interface ArrayExpression extends Node {
  type: NodeTypes.JS_ARRAY_EXPRESSION
  elements: Array<string | JSChildNode>
}

export interface SlotFunctionExpression extends Node {
  type: NodeTypes.JS_SLOT_FUNCTION
  params: ExpressionNode | undefined
  returns: ChildNode[]
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
  value: JSChildNode,
  loc: SourceLocation
): Property {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc,
    key,
    value
  }
}

export function createSimpleExpression(
  content: string,
  isStatic: boolean,
  loc: SourceLocation
): SimpleExpressionNode {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content,
    isStatic
  }
}

export function createInterpolation(
  content: string | CompoundExpressionNode,
  loc: SourceLocation
): InterpolationNode {
  return {
    type: NodeTypes.INTERPOLATION,
    loc,
    content: isString(content)
      ? createSimpleExpression(content, false, loc)
      : content
  }
}

export function createCompoundExpression(
  children: CompoundExpressionNode['children'],
  loc: SourceLocation
): CompoundExpressionNode {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc,
    children
  }
}

export function createCallExpression(
  callee: string | ExpressionNode,
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

export function createFunctionExpression(
  params: ExpressionNode | undefined,
  returns: ChildNode[],
  loc: SourceLocation
): SlotFunctionExpression {
  return {
    type: NodeTypes.JS_SLOT_FUNCTION,
    params,
    returns,
    loc
  }
}
