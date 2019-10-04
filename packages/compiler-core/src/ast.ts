import { isString } from '@vue/shared'
import { ForParseResult } from './transforms/vFor'

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
  JS_FUNCTION_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION
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

export type TemplateChildNode =
  | ElementNode
  | InterpolationNode
  | CompoundExpressionNode
  | TextNode
  | CommentNode
  | IfNode
  | ForNode

export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: TemplateChildNode[]
  imports: string[]
  statements: string[]
  hoists: JSChildNode[]
  codegenNode: TemplateChildNode | JSChildNode | undefined
}

export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  ns: Namespace
  tag: string
  tagType: ElementTypes
  isSelfClosing: boolean
  props: Array<AttributeNode | DirectiveNode>
  children: TemplateChildNode[]
  codegenNode: CallExpression | SimpleExpressionNode | undefined
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
  // optional property to cache the expression parse result for v-for
  parseResult?: ForParseResult
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
  children: (SimpleExpressionNode | InterpolationNode | TextNode | string)[]
  // an expression parsed as the params of a function will track
  // the identifiers declared inside the function body.
  identifiers?: string[]
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  codegenNode: SequenceExpression
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: TemplateChildNode[]
}

export interface ForNode extends Node {
  type: NodeTypes.FOR
  source: ExpressionNode
  valueAlias: ExpressionNode | undefined
  keyAlias: ExpressionNode | undefined
  objectIndexAlias: ExpressionNode | undefined
  children: TemplateChildNode[]
  codegenNode: SequenceExpression
}

// We also include a number of JavaScript AST nodes for code generation.
// The AST is an intentioanlly minimal subset just to meet the exact needs of
// Vue render function generation.
export type JSChildNode =
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ExpressionNode
  | FunctionExpression
  | ConditionalExpression
  | SequenceExpression

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION
  callee: string
  arguments: (string | JSChildNode | TemplateChildNode | TemplateChildNode[])[]
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

export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | ExpressionNode[] | undefined
  returns: TemplateChildNode | TemplateChildNode[] | JSChildNode
  newline: boolean
}

export interface SequenceExpression extends Node {
  type: NodeTypes.JS_SEQUENCE_EXPRESSION
  expressions: JSChildNode[]
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION
  test: ExpressionNode
  consequent: JSChildNode
  alternate: JSChildNode
}

// AST Utilities ---------------------------------------------------------------

// Some expressions, e.g. sequence and conditional expressions, are never
// associated with template nodes, so their source locations are just a stub.
// Container types like CompoundExpression also don't need a real location.
export const locStub: SourceLocation = {
  source: '',
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 }
}

export function createArrayExpression(
  elements: ArrayExpression['elements'],
  loc: SourceLocation = locStub
): ArrayExpression {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    loc,
    elements
  }
}

export function createObjectExpression(
  properties: ObjectExpression['properties'],
  loc: SourceLocation = locStub
): ObjectExpression {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc,
    properties
  }
}

export function createObjectProperty(
  key: Property['key'] | string,
  value: Property['value']
): Property {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc: locStub,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value
  }
}

export function createSimpleExpression(
  content: SimpleExpressionNode['content'],
  isStatic: SimpleExpressionNode['isStatic'],
  loc: SourceLocation = locStub
): SimpleExpressionNode {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content,
    isStatic
  }
}

export function createInterpolation(
  content: InterpolationNode['content'] | string,
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
  children: CompoundExpressionNode['children']
): CompoundExpressionNode {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc: locStub,
    children
  }
}

export function createCallExpression(
  callee: CallExpression['callee'],
  args: CallExpression['arguments'] = [],
  loc: SourceLocation = locStub
): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args
  }
}

export function createFunctionExpression(
  params: FunctionExpression['params'],
  returns: FunctionExpression['returns'],
  newline: boolean = false,
  loc: SourceLocation = locStub
): FunctionExpression {
  return {
    type: NodeTypes.JS_FUNCTION_EXPRESSION,
    params,
    returns,
    newline,
    loc
  }
}

export function createSequenceExpression(
  expressions: SequenceExpression['expressions']
): SequenceExpression {
  return {
    type: NodeTypes.JS_SEQUENCE_EXPRESSION,
    expressions,
    loc: locStub
  }
}

export function createConditionalExpression(
  test: ConditionalExpression['test'],
  consequent: ConditionalExpression['consequent'],
  alternate: ConditionalExpression['alternate']
): ConditionalExpression {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    loc: locStub
  }
}
