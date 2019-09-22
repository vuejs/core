import {
  RootNode,
  ChildNode,
  ElementNode,
  IfNode,
  ForNode,
  TextNode,
  CommentNode,
  ExpressionNode,
  NodeTypes,
  JSChildNode,
  CallExpression,
  ArrayExpression,
  ObjectExpression,
  IfBranchNode
} from './ast'
import { SourceMapGenerator, RawSourceMap } from 'source-map'
import { advancePositionWithMutation, assert } from './utils'
import { isString, isArray } from '@vue/shared'
import { RENDER_LIST_HELPER } from './transforms/vFor'

type CodegenNode = ChildNode | JSChildNode

export interface CodegenOptions {
  //  will generate import statements for
  // runtime helpers; otherwise will grab the helpers from global `Vue`.
  // default: false
  mode?: 'module' | 'function'
  useWith?: boolean
  // Filename for source map generation.
  filename?: string
}

export interface CodegenResult {
  code: string
  map?: RawSourceMap
}

export interface CodegenContext extends Required<CodegenOptions> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indentLevel: number
  imports: Set<string>
  knownIdentifiers: Set<string>
  map?: SourceMapGenerator
  push(code: string, node?: CodegenNode): void
  indent(): void
  deindent(): void
  newline(): void
}

function createCodegenContext(
  ast: RootNode,
  {
    mode = 'function',
    useWith = true,
    filename = `template.vue.html`
  }: CodegenOptions
): CodegenContext {
  const context: CodegenContext = {
    mode,
    useWith,
    filename,
    source: ast.loc.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
    indentLevel: 0,
    imports: new Set(),
    knownIdentifiers: new Set(),

    // lazy require source-map implementation, only in non-browser builds!
    map: __BROWSER__
      ? undefined
      : new (require('source-map')).SourceMapGenerator(),

    push(code, node?: CodegenNode) {
      context.code += code
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
        advancePositionWithMutation(context, code, code.length)
      }
    },
    indent() {
      newline(++context.indentLevel)
    },
    deindent() {
      newline(--context.indentLevel)
    },
    newline() {
      newline(context.indentLevel)
    }
  }
  const newline = (n: number) => context.push('\n' + `  `.repeat(n))
  if (!__BROWSER__) {
    context.map!.setSourceContent(filename, context.source)
  }
  return context
}

export function generate(
  ast: RootNode,
  options: CodegenOptions = {}
): CodegenResult {
  const context = createCodegenContext(ast, options)
  // TODO handle different output for module mode and IIFE mode
  const { mode, push, useWith, indent, deindent } = context
  if (mode === 'function') {
    // TODO generate const declarations for helpers
    push(`return `)
  } else {
    // TODO generate import statements for helpers
    push(`export default `)
  }
  push(`function render() {`)
  if (useWith) {
    indent()
    push(`with (this) {`)
  }
  indent()
  push(`return `)
  genChildren(ast.children, context)
  if (useWith) {
    deindent()
    push(`}`)
  }
  deindent()
  push(`}`)
  return {
    code: context.code,
    map: context.map ? context.map.toJSON() : undefined
  }
}

// This will generate a single vnode call if the list has length === 1.
function genChildren(children: ChildNode[], context: CodegenContext) {
  if (children.length === 1) {
    genNode(children[0], context)
  } else {
    genNodeListAsArray(children, context)
  }
}

function genNodeListAsArray(
  nodes: (string | CodegenNode | ChildNode[])[],
  context: CodegenContext
) {
  const multilines = nodes.length > 1
  context.push(`[`)
  multilines && context.indent()
  genNodeList(nodes, context, multilines)
  multilines && context.deindent()
  context.push(`]`)
}

function genNodeList(
  nodes: (string | CodegenNode | ChildNode[])[],
  context: CodegenContext,
  multilines: boolean = false
) {
  const { push, newline } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isString(node)) {
      // plain code string
      // note not adding quotes here because this can be any code,
      // not just plain strings.
      push(node)
    } else if (isArray(node)) {
      // child VNodes in a h() call
      // not using genChildren here because we want them to always be an array
      genNodeListAsArray(node, context)
    } else {
      genNode(node, context)
    }
    if (i < nodes.length - 1) {
      if (multilines) {
        push(',')
        newline()
      } else {
        push(', ')
      }
    }
  }
}

function genNode(node: CodegenNode, context: CodegenContext) {
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
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context)
      break
    case NodeTypes.JS_OBJECT_EXPRESSION:
      genObjectExpression(node, context)
      break
    case NodeTypes.JS_ARRAY_EXPRESSION:
      genArrayExpression(node, context)
  }
}

function genElement(node: ElementNode, context: CodegenContext) {
  __DEV__ &&
    assert(
      node.codegenNode != null,
      `AST is not transformed for codegen. ` +
        `Apply appropriate transforms first.`
    )
  genCallExpression(node.codegenNode!, context, false)
}

function genText(node: TextNode | ExpressionNode, context: CodegenContext) {
  context.push(JSON.stringify(node.content), node)
}

function genExpression(node: ExpressionNode, context: CodegenContext) {
  // if (node.codegenNode) {
  //   TODO handle transformed expression
  // }
  const text = node.isStatic ? JSON.stringify(node.content) : node.content
  context.push(text, node)
}

function genExpressionAsPropertyKey(
  node: ExpressionNode,
  context: CodegenContext
) {
  // if (node.codegenNode) {
  //   TODO handle transformed expression
  // }
  if (node.isStatic) {
    // only quote keys if necessary
    const text = /^\d|[^\w]/.test(node.content)
      ? JSON.stringify(node.content)
      : node.content
    context.push(text, node)
  } else {
    context.push(`[${node.content}]`, node)
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  context.push(`<!--${node.content}-->`, node)
}

// control flow
function genIf(node: IfNode, context: CodegenContext) {
  genIfBranch(node.branches[0], node.branches, 1, context)
}

function genIfBranch(
  { condition, children }: IfBranchNode,
  branches: IfBranchNode[],
  nextIndex: number,
  context: CodegenContext
) {
  if (condition) {
    const { push, indent, deindent, newline } = context
    // v-if or v-else-if
    push(`(${condition.content})`, condition)
    indent()
    push(`? `)
    genChildren(children, context)
    newline()
    push(`: `)
    if (nextIndex < branches.length) {
      genIfBranch(branches[nextIndex], branches, nextIndex + 1, context)
    } else {
      context.push(`null`)
    }
    deindent()
  } else {
    // v-else
    __DEV__ && assert(nextIndex === branches.length)
    genChildren(children, context)
  }
}

function genFor(node: ForNode, context: CodegenContext) {
  const { push } = context
  const { source, keyAlias, valueAlias, objectIndexAlias, children } = node
  push(`${RENDER_LIST_HELPER}(`, node)
  genExpression(source, context)
  context.push(`(`)
  if (valueAlias) {
    // not using genExpression here because these aliases can only be code
    // that is valid in the function argument position, so the parse rule can
    // be off and they don't need identifier prefixing anyway.
    push(valueAlias.content, valueAlias)
    push(`, `)
  }
  if (keyAlias) {
    if (!valueAlias) {
      push(`_, `)
    }
    push(keyAlias.content, keyAlias)
    push(`, `)
  }
  if (objectIndexAlias) {
    if (!keyAlias) {
      if (!valueAlias) {
        push(`_, `)
      }
      push(`_, `)
    }
    push(objectIndexAlias.content, objectIndexAlias)
  }
  context.push(`) => `)
  genChildren(children, context)
  context.push(`)`)
}

// JavaScript
function genCallExpression(
  node: CallExpression,
  context: CodegenContext,
  multilines = node.arguments.length > 1
) {
  context.push(node.callee + `(`, node)
  multilines && context.indent()
  genNodeList(node.arguments, context, multilines)
  multilines && context.deindent()
  context.push(`)`)
}

function genObjectExpression(node: ObjectExpression, context: CodegenContext) {
  const { push, indent, deindent, newline } = context
  const { properties } = node
  const multilines = properties.length > 1
  push(`{`, node)
  multilines && indent()
  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i]
    // key
    genExpressionAsPropertyKey(key, context)
    push(`: `)
    // value
    genExpression(value, context)
    if (i < properties.length - 1) {
      if (multilines) {
        push(`,`)
        newline()
      } else {
        push(`, `)
      }
    }
  }
  multilines && deindent()
  push(`}`)
}

function genArrayExpression(node: ArrayExpression, context: CodegenContext) {
  genNodeListAsArray(node.elements, context)
}
