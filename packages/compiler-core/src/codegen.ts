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
import {
  advancePositionWithMutation,
  assert,
  isSimpleIdentifier
} from './utils'
import { isString, isArray } from '@vue/shared'
import {
  RENDER_LIST,
  TO_STRING,
  CREATE_VNODE,
  COMMENT
} from './runtimeConstants'

type CodegenNode = ChildNode | JSChildNode

export interface CodegenOptions {
  // - Module mode will generate ES module import statements for helpers
  //   and export the render function as the default export.
  // - Function mode will generate a single `const { helpers... } = Vue`
  //   statement and return the render function. It is meant to be used with
  //   `new Function(code)()` to generate a render function at runtime.
  // Default: 'function'
  mode?: 'module' | 'function'
  // Prefix suitable identifiers with _ctx.
  // If this option is false, the generated code will be wrapped in a
  // `with (this) { ... }` block.
  // Default: false
  prefixIdentifiers?: boolean
  // Generate source map?
  // Default: false
  sourceMap?: boolean
  // Filename for source map generation.
  // Default: `template.vue.html`
  filename?: string
}

export interface CodegenResult {
  code: string
  ast: RootNode
  map?: RawSourceMap
}

export interface CodegenContext extends Required<CodegenOptions> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indentLevel: number
  map?: SourceMapGenerator
  helper(name: string): string
  push(code: string, node?: CodegenNode): void
  indent(): void
  deindent(withoutNewLine?: boolean): void
  newline(): void
}

function createCodegenContext(
  ast: RootNode,
  {
    mode = 'function',
    prefixIdentifiers = false,
    sourceMap = false,
    filename = `template.vue.html`
  }: CodegenOptions
): CodegenContext {
  const context: CodegenContext = {
    mode,
    prefixIdentifiers,
    sourceMap,
    filename,
    source: ast.loc.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
    indentLevel: 0,

    // lazy require source-map implementation, only in non-browser builds!
    map:
      __BROWSER__ || !sourceMap
        ? undefined
        : new (require('source-map')).SourceMapGenerator(),

    helper(name) {
      return prefixIdentifiers ? name : `_${name}`
    },
    push(code, node?: CodegenNode) {
      context.code += code
      if (context.map) {
        if (node) {
          const mapping = {
            source: context.filename,
            original: {
              line: node.loc.start.line,
              column: node.loc.start.column - 1 // source-map column is 0 based
            },
            generated: {
              line: context.line,
              column: context.column - 1
            }
          }
          context.map.addMapping(mapping)
        }
        advancePositionWithMutation(context, code)
      }
    },
    indent() {
      newline(++context.indentLevel)
    },
    deindent(withoutNewLine = false) {
      if (withoutNewLine) {
        --context.indentLevel
      } else {
        newline(--context.indentLevel)
      }
    },
    newline() {
      newline(context.indentLevel)
    }
  }
  const newline = (n: number) => context.push('\n' + `  `.repeat(n))
  if (!__BROWSER__ && context.map) {
    context.map.setSourceContent(filename, context.source)
  }
  return context
}

export function generate(
  ast: RootNode,
  options: CodegenOptions = {}
): CodegenResult {
  const context = createCodegenContext(ast, options)
  const { mode, push, prefixIdentifiers, indent, deindent, newline } = context
  const hasImports = ast.imports.length

  // preambles
  if (mode === 'function') {
    // Generate const declaration for helpers
    // In prefix mode, we place the const declaration at top so it's done
    // only once; But if we not prefixing, we place the decalration inside the
    // with block so it doesn't incur the `in` check cost for every helper access.
    if (hasImports) {
      if (prefixIdentifiers) {
        push(`const { ${ast.imports.join(', ')} } = Vue\n`)
      } else {
        // save Vue in a separate variable to avoid collision
        push(`const _Vue = Vue`)
      }
    }
    genHoists(ast.hoists, context)
    push(`return `)
  } else {
    // generate import statements for helpers
    if (hasImports) {
      push(`import { ${ast.imports.join(', ')} } from 'vue'\n`)
    }
    genHoists(ast.hoists, context)
    push(`export default `)
  }

  // enter render function
  push(`function render() {`)
  indent()

  if (!prefixIdentifiers) {
    push(`with (this) {`)
    indent()
    // function mode const declarations should be inside with block
    // also they should be renamed to avoid collision with user properties
    if (mode === 'function' && hasImports) {
      push(`const { ${ast.imports.map(n => `${n}: _${n}`).join(', ')} } = _Vue`)
      newline()
    }
  } else {
    push(`const _ctx = this`)
    newline()
  }

  // generate asset resolution statements
  if (ast.statements.length) {
    ast.statements.forEach(s => {
      push(s)
      newline()
    })
    newline()
  }

  // generate the VNode tree expression
  push(`return `)
  genChildren(ast.children, context, true)
  if (!prefixIdentifiers) {
    deindent()
    push(`}`)
  }
  deindent()
  push(`}`)
  return {
    ast,
    code: context.code,
    map: context.map ? context.map.toJSON() : undefined
  }
}

function genHoists(hoists: JSChildNode[], context: CodegenContext) {
  hoists.forEach((exp, i) => {
    context.push(`const _hoisted_${i + 1} = `)
    genNode(exp, context)
    context.newline()
  })
  context.newline()
}

// This will generate a single vnode call if:
// - The target position explicitly allows a single node (root, if, for)
// - The list has length === 1, AND The only child is a text or expression.
function genChildren(
  children: ChildNode[],
  context: CodegenContext,
  allowSingle: boolean = false
) {
  if (!children.length) {
    return context.push(`null`)
  }
  const child = children[0]
  if (
    children.length === 1 &&
    (allowSingle ||
      child.type === NodeTypes.TEXT ||
      child.type == NodeTypes.EXPRESSION)
  ) {
    genNode(child, context)
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
      push(node)
    } else if (isArray(node)) {
      genChildren(node, context)
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
      break
    default:
      /* istanbul ignore next */
      __DEV__ &&
        assert(false, `unhandled codegen node type: ${(node as any).type}`)
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
  const { push, helper } = context
  const { content, children, isStatic, isInterpolation } = node
  if (isInterpolation) {
    push(`${helper(TO_STRING)}(`)
  }
  if (children) {
    genCompoundExpression(node, context)
  } else {
    push(isStatic ? JSON.stringify(content) : content, node)
  }
  if (isInterpolation) {
    push(`)`)
  }
}

function genExpressionAsPropertyKey(
  node: ExpressionNode,
  context: CodegenContext
) {
  const { push } = context
  const { content, children, isStatic } = node
  if (children) {
    push(`[`)
    genCompoundExpression(node, context)
    push(`]`)
  } else if (isStatic) {
    // only quote keys if necessary
    const text = isSimpleIdentifier(content) ? content : JSON.stringify(content)
    push(text, node)
  } else {
    push(`[${content}]`, node)
  }
}

function genCompoundExpression(node: ExpressionNode, context: CodegenContext) {
  for (let i = 0; i < node.children!.length; i++) {
    const child = node.children![i]
    if (isString(child)) {
      context.push(child)
    } else {
      genExpression(child, context)
    }
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  if (__DEV__) {
    const { push, helper } = context
    push(
      `${helper(CREATE_VNODE)}(${helper(COMMENT)}, 0, ${JSON.stringify(
        node.content
      )})`,
      node
    )
  }
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
    // v-if or v-else-if
    const { push, indent, deindent, newline } = context
    const needsQuote = !isSimpleIdentifier(condition.content)
    needsQuote && push(`(`)
    genExpression(condition, context)
    needsQuote && push(`)`)
    indent()
    context.indentLevel++
    push(`? `)
    genChildren(children, context, true)
    context.indentLevel--
    newline()
    push(`: `)
    if (nextIndex < branches.length) {
      genIfBranch(branches[nextIndex], branches, nextIndex + 1, context)
    } else {
      context.push(`null`)
    }
    deindent(true /* without newline */)
  } else {
    // v-else
    __DEV__ && assert(nextIndex === branches.length)
    genChildren(children, context, true)
  }
}

function genFor(node: ForNode, context: CodegenContext) {
  const { push, helper, indent, deindent } = context
  const { source, keyAlias, valueAlias, objectIndexAlias, children } = node
  push(`${helper(RENDER_LIST)}(`, node)
  genExpression(source, context)
  push(`, (`)
  if (valueAlias) {
    genExpression(valueAlias, context)
  }
  if (keyAlias) {
    if (!valueAlias) {
      push(`__value`)
    }
    push(`, `)
    genExpression(keyAlias, context)
  }
  if (objectIndexAlias) {
    if (!keyAlias) {
      if (!valueAlias) {
        push(`__value, __key`)
      } else {
        push(`, __key`)
      }
    }
    push(`, `)
    genExpression(objectIndexAlias, context)
  }
  push(`) => {`)
  indent()
  push(`return `)
  genChildren(children, context, true)
  deindent()
  push(`})`)
}

// JavaScript
function genCallExpression(
  node: CallExpression,
  context: CodegenContext,
  multilines = node.arguments.length > 2
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
  push(multilines ? `{` : `{ `, node)
  multilines && indent()
  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i]
    // key
    genExpressionAsPropertyKey(key, context)
    push(`: `)
    // value
    genNode(value, context)
    if (i < properties.length - 1) {
      // will only reach this if it's multilines
      push(`,`)
      newline()
    }
  }
  multilines && deindent()
  push(multilines ? `}` : ` }`)
}

function genArrayExpression(node: ArrayExpression, context: CodegenContext) {
  genNodeListAsArray(node.elements, context)
}
