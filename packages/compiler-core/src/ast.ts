// Vue template is a platform-agnostic superset of HTML (syntax only).
// More namespaces like SVG and MathML are declared by platform specific
// compilers.
export type Namespace = number

export const enum Namespaces {
  HTML
}

export const enum NodeTypes {
  TEXT,
  COMMENT,
  ELEMENT,
  ATTRIBUTE,
  EXPRESSION,
  DIRECTIVE,
  ROOT
}

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT, // slot
  TEMPLATE // template, component
}

export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: Array<ElementNode | ExpressionNode | TextNode | CommentNode>
}

export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  ns: Namespace
  tag: string
  tagType: ElementTypes
  isSelfClosing: boolean
  props: Array<AttributeNode | DirectiveNode>
  children: Array<ElementNode | ExpressionNode | TextNode | CommentNode>
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
}

export interface Position {
  offset: number // from start of file
  line: number
  column: number
}

// The node's range. The `start` is inclusive and `end` is exclusive.
// [start, end)
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}
