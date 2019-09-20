import {
  RootNode,
  ChildNode,
  ElementNode,
  IfNode,
  ForNode,
  TextNode,
  CommentNode,
  ExpressionNode,
  NodeTypes
} from './ast'
import { SourceMapGenerator, RawSourceMap } from 'source-map'
import { advancePositionWithMutation } from './utils'

export interface CodegenOptions {
  // Assume ES module environment. If true, will generate import statements for
  // runtime helpers; otherwise will grab the helpers from global `Vue`.
  module?: boolean
  // Filename for source map generation.
  filename?: string
}

export interface CodegenResult {
  code: string
  map?: RawSourceMap
}

interface CodegenContext extends Required<CodegenOptions> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indent: number
  identifiers: Set<string>
  map?: SourceMapGenerator
  push(generatedCode: string, astNode?: ChildNode): void
}

export function generate(
  ast: RootNode,
  options: CodegenOptions = {}
): CodegenResult {
  const context = createCodegenContext(ast, options)
  if (context.module) {
    // TODO inject import statements on RootNode
    context.push(`export function render() {\n`)
    context.indent++
    context.push(`  return `)
  }
  if (ast.children.length === 1) {
    genNode(ast.children[0], context)
  } else {
    genChildren(ast.children, context)
  }
  if (context.module) {
    context.indent--
    context.push(`\n}`)
  }
  return {
    code: context.code,
    map: context.map ? context.map.toJSON() : undefined
  }
}

function createCodegenContext(
  ast: RootNode,
  options: CodegenOptions
): CodegenContext {
  const context: CodegenContext = {
    module: true,
    filename: `template.vue.html`,
    ...options,
    source: ast.loc.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
    indent: 0,
    identifiers: new Set(),
    // lazy require source-map implementation, only in non-browser builds!
    map: __BROWSER__
      ? undefined
      : new (require('source-map')).SourceMapGenerator(),
    push(generatedCode, node) {
      // TODO handle indent
      context.code += generatedCode
      if (context.map) {
        if (node) {
          context.map.addMapping({
            source: context.filename,
            original: {
              line: node.loc.start.line,
              column: node.loc.start.column - 1 // source-map column is 0 based
            },
            generated: {
              line: context.line,
              column: context.column - 1
            }
          })
        }
        advancePositionWithMutation(
          context,
          generatedCode,
          generatedCode.length
        )
      }
    }
  }
  return context
}

function genChildren(children: ChildNode[], context: CodegenContext) {
  context.push(`[`)
  for (let i = 0; i < children.length; i++) {
    genNode(children[i], context)
    if (i < children.length - 1) context.push(', ')
  }
  context.push(`]`)
}

function genNode(node: ChildNode, context: CodegenContext) {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      genElement(node, context)
      break
    case NodeTypes.TEXT:
      genText(node, context)
      break
    case NodeTypes.EXPRESSION:
      genExpression(node, context)
      break
    case NodeTypes.COMMENT:
      genComment(node, context)
      break
    case NodeTypes.IF:
      genIf(node, context)
      break
    case NodeTypes.FOR:
      genFor(node, context)
      break
  }
}

function genElement(el: ElementNode, context: CodegenContext) {}

function genText(node: TextNode | ExpressionNode, context: CodegenContext) {
  context.push(JSON.stringify(node.content), node)
}

function genExpression(node: ExpressionNode, context: CodegenContext) {
  if (!__BROWSER__) {
    // TODO parse expression content and rewrite identifiers
  }
  context.push(node.content, node)
}

function genComment(node: CommentNode, context: CodegenContext) {
  context.push(`<!--${node.content}-->`, node)
}

// control flow
function genIf(node: IfNode, context: CodegenContext) {}

function genFor(node: ForNode, context: CodegenContext) {}
