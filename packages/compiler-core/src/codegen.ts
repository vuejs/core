import type { CodegenOptions } from './options'
import {
  type ArrayExpression,
  type AssignmentExpression,
  type CacheExpression,
  type CallExpression,
  type CommentNode,
  type CompoundExpressionNode,
  type ConditionalExpression,
  type ExpressionNode,
  type FunctionExpression,
  type IfStatement,
  type InterpolationNode,
  type JSChildNode,
  NodeTypes,
  type ObjectExpression,
  type ReturnStatement,
  type RootNode,
  type SSRCodegenNode,
  type SequenceExpression,
  type SimpleExpressionNode,
  type TemplateChildNode,
  type TemplateLiteral,
  type TextNode,
  type VNodeCall,
  getVNodeBlockHelper,
  getVNodeHelper,
} from './ast'
import { type Piece, type Source, renderWithSourceMap } from 'muggle-string'
import { assert, isSimpleIdentifier, toValidAssetId } from './utils'
import {
  NOOP,
  PatchFlagNames,
  type PatchFlags,
  isArray,
  isString,
  isSymbol,
} from '@vue/shared'
import {
  CREATE_COMMENT,
  CREATE_ELEMENT_VNODE,
  CREATE_STATIC,
  CREATE_TEXT,
  CREATE_VNODE,
  OPEN_BLOCK,
  RESOLVE_COMPONENT,
  RESOLVE_DIRECTIVE,
  RESOLVE_FILTER,
  SET_BLOCK_TRACKING,
  TO_DISPLAY_STRING,
  WITH_CTX,
  WITH_DIRECTIVES,
  helperNameMap,
} from './runtimeHelpers'
import type { ImportItem } from './transform'

export interface RawSourceMap {
  file?: string
  sourceRoot?: string
  version: string
  sources: string[]
  names: string[]
  sourcesContent?: string[]
  mappings: string
}

const PURE_ANNOTATION = `/*@__PURE__*/`

const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`

type CodegenNode = TemplateChildNode | JSChildNode | SSRCodegenNode

export interface BaseCodegenResult {
  code: string
  preamble: string
  ast: unknown
  map?: RawSourceMap
  /** @internal The pieces the map is rendered from */
  pieces?: CodegenPiece[]
  helpers?: Set<string> | Set<symbol>
}

export interface CodegenResult extends BaseCodegenResult {
  ast: RootNode
}

export enum NewlineType {
  /** Start with `\n` */
  Start = 0,
  /** Ends with `\n` */
  End = -1,
  /** No `\n` included */
  None = -2,
  /** Don't know, calc it */
  Unknown = -3,
}

export interface CodegenContext extends Omit<
  Required<CodegenOptions>,
  | 'bindingMetadata'
  | 'inline'
  | 'vaporRuntimeModuleName'
  | 'expressionPlugins'
  | 'pieceSource'
  | 'pieceOffset'
> {
  source: string
  code: string
  indentLevel: number
  pure: boolean
  /** The pieces of the code, when a source map is generated */
  pieces?: CodegenPiece[]
  helper(key: symbol): string
  push(code: string, newlineIndex?: number, node?: CodegenNode): void
  indent(): void
  deindent(withoutNewLine?: boolean): void
  newline(): void
}

function createCodegenContext(
  ast: RootNode,
  {
    mode = 'function',
    prefixIdentifiers = mode === 'module',
    sourceMap = false,
    pieceSource,
    pieceOffset = 0,
    filename = `template.vue.html`,
    scopeId = null,
    optimizeImports = false,
    runtimeGlobalName = `Vue`,
    runtimeModuleName = `vue`,
    ssrRuntimeModuleName = 'vue/server-renderer',
    ssr = false,
    isTS = false,
    inSSR = false,
  }: CodegenOptions,
): CodegenContext {
  const context: CodegenContext = {
    mode,
    prefixIdentifiers,
    sourceMap,
    filename,
    scopeId,
    optimizeImports,
    runtimeGlobalName,
    runtimeModuleName,
    ssrRuntimeModuleName,
    ssr,
    isTS,
    inSSR,
    source: ast.source,
    code: ``,
    indentLevel: 0,
    pure: false,
    helper(key) {
      return `_${helperNameMap[key]}`
    },
    push(code, newlineIndex, node) {
      context.code += code
      if (!__BROWSER__ && context.pieces) {
        if (node && node.loc.source) {
          const { start, end } = node.loc
          addPiece(
            context.pieces,
            code,
            source,
            start.offset + pieceOffset,
            end.offset + pieceOffset,
          )
          mappedEnd = end.offset + pieceOffset
        } else {
          addPiece(
            context.pieces,
            code,
            mappedEnd === -1 ? undefined : source,
            mappedEnd,
          )
        }
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
    },
  }

  // text without a node maps to the end of the last node on its line
  let mappedEnd = -1
  const source = pieceSource || { content: ast.source }

  function newline(n: number) {
    mappedEnd = -1
    context.push('\n' + `  `.repeat(n), NewlineType.Start)
  }

  if (!__BROWSER__ && sourceMap) {
    context.pieces = [createSourcePiece(source)]
  }

  return context
}

export type CodegenPiece = Piece<{ source: Source }>

/** An empty piece of `source`, so that the map names it even if no code maps to it */
export function createSourcePiece(source: Source): CodegenPiece {
  return { source, start: 0, end: 0, text: '' }
}

/**
 * Adds `code` to `pieces`, as the text of `start`..`end` of `source` if given,
 * joined to the last piece when that maps the same way
 */
export function addPiece(
  pieces: CodegenPiece[],
  code: string,
  source?: Source,
  start: number = 0,
  end: number = start,
): void {
  const last = pieces[pieces.length - 1]
  if (!source) {
    if (typeof last === 'string') pieces[pieces.length - 1] = last + code
    else pieces.push(code)
  } else if (
    typeof last === 'object' &&
    last.source === source &&
    last.start === start &&
    last.end === end
  ) {
    last.text += code
  } else {
    // a range takes the indentation before it, so its line starts with one segment, not two
    if (typeof last === 'string') {
      let indent = last.length
      while (last.charCodeAt(indent - 1) === 32) indent--
      if (indent < last.length && last.charCodeAt(indent - 1) === 10) {
        pieces[pieces.length - 1] = last.slice(0, indent)
        code = last.slice(indent) + code
      }
    }
    pieces.push({ source, start, end, text: code })
  }
}

export const createSourceMap: (
  filename: string,
  pieces: CodegenPiece[],
) => RawSourceMap = __BROWSER__
  ? (NOOP as any)
  : (filename, pieces) =>
      renderWithSourceMap(
        sink => {
          for (const piece of pieces) sink(piece)
        },
        () => filename,
      ).map as unknown as RawSourceMap

export function generate(
  ast: RootNode,
  options: CodegenOptions & {
    onContextCreated?: (context: CodegenContext) => void
  } = {},
): CodegenResult {
  const context = createCodegenContext(ast, options)
  if (options.onContextCreated) options.onContextCreated(context)
  const {
    mode,
    push,
    prefixIdentifiers,
    indent,
    deindent,
    newline,
    scopeId,
    ssr,
  } = context

  const helpers = Array.from(ast.helpers)
  const hasHelpers = helpers.length > 0
  const useWithBlock = !prefixIdentifiers && mode !== 'module'
  const genScopeId = !__BROWSER__ && scopeId != null && mode === 'module'
  const isSetupInlined = !__BROWSER__ && !!options.inline

  // preambles
  // in setup() inline mode, the preamble is generated in a sub context
  // and returned separately.
  const preambleContext = isSetupInlined
    ? createCodegenContext(ast, options)
    : context
  if (!__BROWSER__ && mode === 'module') {
    genModulePreamble(ast, preambleContext, genScopeId, isSetupInlined)
  } else {
    genFunctionPreamble(ast, preambleContext)
  }
  // enter render function
  const functionName = ssr ? `ssrRender` : `render`
  const args = ssr ? ['_ctx', '_push', '_parent', '_attrs'] : ['_ctx', '_cache']
  if (!__BROWSER__ && options.bindingMetadata && !options.inline) {
    // binding optimization args
    args.push('$props', '$setup', '$data', '$options')
  }
  const signature =
    !__BROWSER__ && options.isTS
      ? args.map(arg => `${arg}: any`).join(',')
      : args.join(', ')

  if (isSetupInlined) {
    push(`(${signature}) => {`)
  } else {
    push(`function ${functionName}(${signature}) {`)
  }
  indent()

  if (useWithBlock) {
    push(`with (_ctx) {`)
    indent()
    // function mode const declarations should be inside with block
    // also they should be renamed to avoid collision with user properties
    if (hasHelpers) {
      push(
        `const { ${helpers.map(aliasHelper).join(', ')} } = _Vue\n`,
        NewlineType.End,
      )
      newline()
    }
  }

  // generate asset resolution statements
  if (ast.components.length) {
    genAssets(ast.components, 'component', context)
    if (ast.directives.length || ast.temps > 0) {
      newline()
    }
  }
  if (ast.directives.length) {
    genAssets(ast.directives, 'directive', context)
    if (ast.temps > 0) {
      newline()
    }
  }
  if (__COMPAT__ && ast.filters && ast.filters.length) {
    newline()
    genAssets(ast.filters, 'filter', context)
    newline()
  }

  if (ast.temps > 0) {
    push(`let `)
    for (let i = 0; i < ast.temps; i++) {
      push(`${i > 0 ? `, ` : ``}_temp${i}`)
    }
  }
  if (ast.components.length || ast.directives.length || ast.temps) {
    push(`\n`, NewlineType.Start)
    newline()
  }

  // generate the VNode tree expression
  if (!ssr) {
    push(`return `)
  }
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context)
  } else {
    push(`null`)
  }

  if (useWithBlock) {
    deindent()
    push(`}`)
  }

  deindent()
  push(`}`)

  return {
    ast,
    code: context.code,
    preamble: isSetupInlined ? preambleContext.code : ``,
    map:
      !__BROWSER__ && context.pieces
        ? createSourceMap(context.filename, context.pieces)
        : undefined,
    pieces: context.pieces,
    helpers: ast.helpers,
  }
}

function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const {
    ssr,
    prefixIdentifiers,
    push,
    newline,
    runtimeModuleName,
    runtimeGlobalName,
    ssrRuntimeModuleName,
  } = context
  const VueBinding =
    !__BROWSER__ && ssr
      ? `require(${JSON.stringify(runtimeModuleName)})`
      : runtimeGlobalName
  // Generate const declaration for helpers
  // In prefix mode, we place the const declaration at top so it's done
  // only once; But if we not prefixing, we place the declaration inside the
  // with block so it doesn't incur the `in` check cost for every helper access.
  const helpers = Array.from(ast.helpers)
  if (helpers.length > 0) {
    if (!__BROWSER__ && prefixIdentifiers) {
      push(
        `const { ${helpers.map(aliasHelper).join(', ')} } = ${VueBinding}\n`,
        NewlineType.End,
      )
    } else {
      // "with" mode.
      // save Vue in a separate variable to avoid collision
      push(`const _Vue = ${VueBinding}\n`, NewlineType.End)
      // in "with" mode, helpers are declared inside the with block to avoid
      // has check cost, but hoists are lifted out of the function - we need
      // to provide the helper here.
      if (ast.hoists.length) {
        const staticHelpers = [
          CREATE_VNODE,
          CREATE_ELEMENT_VNODE,
          CREATE_COMMENT,
          CREATE_TEXT,
          CREATE_STATIC,
        ]
          .filter(helper => helpers.includes(helper))
          .map(aliasHelper)
          .join(', ')
        push(`const { ${staticHelpers} } = _Vue\n`, NewlineType.End)
      }
    }
  }
  // generate variables for ssr helpers
  if (!__BROWSER__ && ast.ssrHelpers && ast.ssrHelpers.length) {
    // ssr guarantees prefixIdentifier: true
    push(
      `const { ${ast.ssrHelpers
        .map(aliasHelper)
        .join(', ')} } = require("${ssrRuntimeModuleName}")\n`,
      NewlineType.End,
    )
  }
  genHoists(ast.hoists, context)
  newline()
  push(`return `)
}

function genModulePreamble(
  ast: RootNode,
  context: CodegenContext,
  genScopeId: boolean,
  inline?: boolean,
) {
  const {
    push,
    newline,
    optimizeImports,
    runtimeModuleName,
    ssrRuntimeModuleName,
  } = context

  // generate import statements for helpers
  if (ast.helpers.size) {
    const helpers = Array.from(ast.helpers)
    if (optimizeImports) {
      // when bundled with webpack with code-split, calling an import binding
      // as a function leads to it being wrapped with `Object(a.b)` or `(0,a.b)`,
      // incurring both payload size increase and potential perf overhead.
      // therefore we assign the imports to variables (which is a constant ~50b
      // cost per-component instead of scaling with template size)
      push(
        `import { ${helpers
          .map(s => helperNameMap[s])
          .join(', ')} } from ${JSON.stringify(runtimeModuleName)}\n`,
        NewlineType.End,
      )
      push(
        `\n// Binding optimization for webpack code-split\nconst ${helpers
          .map(s => `_${helperNameMap[s]} = ${helperNameMap[s]}`)
          .join(', ')}\n`,
        NewlineType.End,
      )
    } else {
      push(
        `import { ${helpers
          .map(s => `${helperNameMap[s]} as _${helperNameMap[s]}`)
          .join(', ')} } from ${JSON.stringify(runtimeModuleName)}\n`,
        NewlineType.End,
      )
    }
  }

  if (ast.ssrHelpers && ast.ssrHelpers.length) {
    push(
      `import { ${ast.ssrHelpers
        .map(s => `${helperNameMap[s]} as _${helperNameMap[s]}`)
        .join(', ')} } from "${ssrRuntimeModuleName}"\n`,
      NewlineType.End,
    )
  }

  if (ast.imports.length) {
    genImports(ast.imports, context)
    newline()
  }

  genHoists(ast.hoists, context)
  newline()

  if (!inline) {
    push(`export `)
  }
}

function genAssets(
  assets: string[],
  type: 'component' | 'directive' | 'filter',
  { helper, push, newline, isTS }: CodegenContext,
) {
  const resolver = helper(
    __COMPAT__ && type === 'filter'
      ? RESOLVE_FILTER
      : type === 'component'
        ? RESOLVE_COMPONENT
        : RESOLVE_DIRECTIVE,
  )
  for (let i = 0; i < assets.length; i++) {
    let id = assets[i]
    // potential component implicit self-reference inferred from SFC filename
    const maybeSelfReference = id.endsWith('__self')
    if (maybeSelfReference) {
      id = id.slice(0, -6)
    }
    push(
      `const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(id)}${
        maybeSelfReference ? `, true` : ``
      })${isTS ? `!` : ``}`,
    )
    if (i < assets.length - 1) {
      newline()
    }
  }
}

function genHoists(hoists: (JSChildNode | null)[], context: CodegenContext) {
  if (!hoists.length) {
    return
  }
  context.pure = true
  const { push, newline } = context
  newline()

  for (let i = 0; i < hoists.length; i++) {
    const exp = hoists[i]
    if (exp) {
      push(`const _hoisted_${i + 1} = `)
      genNode(exp, context)
      newline()
    }
  }

  context.pure = false
}

function genImports(importsOptions: ImportItem[], context: CodegenContext) {
  if (!importsOptions.length) {
    return
  }
  importsOptions.forEach(imports => {
    context.push(`import `)
    genNode(imports.exp, context)
    context.push(` from '${imports.path}'`)
    context.newline()
  })
}

function isText(n: string | CodegenNode) {
  return (
    isString(n) ||
    n.type === NodeTypes.SIMPLE_EXPRESSION ||
    n.type === NodeTypes.TEXT ||
    n.type === NodeTypes.INTERPOLATION ||
    n.type === NodeTypes.COMPOUND_EXPRESSION
  )
}

function genNodeListAsArray(
  nodes: (string | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext,
) {
  const multilines =
    nodes.length > 3 ||
    ((!__BROWSER__ || __DEV__) && nodes.some(n => isArray(n) || !isText(n)))
  context.push(`[`)
  multilines && context.indent()
  genNodeList(nodes, context, multilines)
  multilines && context.deindent()
  context.push(`]`)
}

function genNodeList(
  nodes: (string | symbol | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext,
  multilines: boolean = false,
  comma: boolean = true,
) {
  const { push, newline } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isString(node)) {
      push(node, NewlineType.Unknown)
    } else if (isArray(node)) {
      genNodeListAsArray(node, context)
    } else {
      genNode(node, context)
    }
    if (i < nodes.length - 1) {
      if (multilines) {
        comma && push(',')
        newline()
      } else {
        comma && push(', ')
      }
    }
  }
}

function genNode(node: CodegenNode | symbol | string, context: CodegenContext) {
  if (isString(node)) {
    context.push(node, NewlineType.Unknown)
    return
  }
  if (isSymbol(node)) {
    context.push(context.helper(node))
    return
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF:
    case NodeTypes.FOR:
      __DEV__ &&
        assert(
          node.codegenNode != null,
          `Codegen node is missing for element/if/for node. ` +
            `Apply appropriate transforms first.`,
        )
      genNode(node.codegenNode!, context)
      break
    case NodeTypes.TEXT:
      genText(node, context)
      break
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context)
      break
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context)
      break
    case NodeTypes.TEXT_CALL:
      genNode(node.codegenNode, context)
      break
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context)
      break
    case NodeTypes.COMMENT:
      genComment(node, context)
      break
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context)
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
    case NodeTypes.JS_FUNCTION_EXPRESSION:
      genFunctionExpression(node, context)
      break
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context)
      break
    case NodeTypes.JS_CACHE_EXPRESSION:
      genCacheExpression(node, context)
      break
    case NodeTypes.JS_BLOCK_STATEMENT:
      genNodeList(node.body, context, true, false)
      break

    // SSR only types
    case NodeTypes.JS_TEMPLATE_LITERAL:
      !__BROWSER__ && genTemplateLiteral(node, context)
      break
    case NodeTypes.JS_IF_STATEMENT:
      !__BROWSER__ && genIfStatement(node, context)
      break
    case NodeTypes.JS_ASSIGNMENT_EXPRESSION:
      !__BROWSER__ && genAssignmentExpression(node, context)
      break
    case NodeTypes.JS_SEQUENCE_EXPRESSION:
      !__BROWSER__ && genSequenceExpression(node, context)
      break
    case NodeTypes.JS_RETURN_STATEMENT:
      !__BROWSER__ && genReturnStatement(node, context)
      break

    /* v8 ignore start */
    case NodeTypes.IF_BRANCH:
      // noop
      break
    default:
      if (__DEV__) {
        assert(false, `unhandled codegen node type: ${(node as any).type}`)
        // make sure we exhaust all possible types
        const exhaustiveCheck: never = node
        return exhaustiveCheck
      }
    /* v8 ignore stop */
  }
}

function genText(
  node: TextNode | SimpleExpressionNode,
  context: CodegenContext,
) {
  context.push(JSON.stringify(node.content), NewlineType.Unknown, node)
}

function genExpression(node: SimpleExpressionNode, context: CodegenContext) {
  const { content, isStatic } = node
  context.push(
    isStatic ? JSON.stringify(content) : content,
    NewlineType.Unknown,
    node,
  )
}

function genInterpolation(node: InterpolationNode, context: CodegenContext) {
  const { push, helper, pure } = context
  if (pure) push(PURE_ANNOTATION, NewlineType.None, node)
  push(`${helper(TO_DISPLAY_STRING)}(`, NewlineType.None, node)
  genNode(node.content, context)
  push(`)`)
}

function genCompoundExpression(
  node: CompoundExpressionNode,
  context: CodegenContext,
) {
  for (let i = 0; i < node.children!.length; i++) {
    const child = node.children![i]
    if (isString(child)) {
      context.push(child, NewlineType.Unknown)
    } else {
      genNode(child, context)
    }
  }
}

function genExpressionAsPropertyKey(
  node: ExpressionNode,
  context: CodegenContext,
) {
  const { push } = context
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    push(`[`)
    genCompoundExpression(node, context)
    push(`]`)
  } else if (node.isStatic) {
    // only quote keys if necessary
    const text = isSimpleIdentifier(node.content)
      ? node.content
      : JSON.stringify(node.content)
    push(text, NewlineType.None, node)
  } else {
    push(`[${node.content}]`, NewlineType.Unknown, node)
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  const { push, helper, pure } = context
  if (pure) {
    push(PURE_ANNOTATION)
  }
  push(
    `${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`,
    NewlineType.Unknown,
    node,
  )
}

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper, pure } = context
  const {
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    disableTracking,
    isComponent,
  } = node

  // add dev annotations to patch flags
  let patchFlagString
  if (patchFlag) {
    if (__DEV__) {
      if (patchFlag < 0) {
        // special flags (negative and mutually exclusive)
        patchFlagString = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`
      } else {
        // bitwise flags
        const flagNames = Object.keys(PatchFlagNames)
          .map(Number)
          .filter(n => n > 0 && patchFlag & n)
          .map(n => PatchFlagNames[n as PatchFlags])
          .join(`, `)
        patchFlagString = patchFlag + ` /* ${flagNames} */`
      }
    } else {
      patchFlagString = String(patchFlag)
    }
  }

  if (directives) {
    push(helper(WITH_DIRECTIVES) + `(`, NewlineType.None, node)
  }
  if (isBlock) {
    push(
      `(${helper(OPEN_BLOCK)}(${disableTracking ? `true` : ``}), `,
      NewlineType.None,
      node,
    )
  }
  if (pure) {
    push(PURE_ANNOTATION, NewlineType.None, node)
  }
  const callHelper: symbol = isBlock
    ? getVNodeBlockHelper(context.inSSR, isComponent)
    : getVNodeHelper(context.inSSR, isComponent)
  push(helper(callHelper) + `(`, NewlineType.None, node)
  genNodeList(
    genNullableArgs([tag, props, children, patchFlagString, dynamicProps]),
    context,
  )
  push(`)`)
  if (isBlock) {
    push(`)`)
  }
  if (directives) {
    push(`, `)
    genNode(directives, context)
    push(`)`)
  }
}

function genNullableArgs(args: any[]): CallExpression['arguments'] {
  let i = args.length
  while (i--) {
    if (args[i] != null) break
  }
  return args.slice(0, i + 1).map(arg => arg || `null`)
}

// JavaScript
function genCallExpression(node: CallExpression, context: CodegenContext) {
  const { push, helper, pure } = context
  const callee = isString(node.callee) ? node.callee : helper(node.callee)
  if (pure) {
    push(PURE_ANNOTATION, NewlineType.None, node)
  }
  push(callee + `(`, NewlineType.None, node)
  genNodeList(node.arguments, context)
  push(`)`)
}

function genObjectExpression(node: ObjectExpression, context: CodegenContext) {
  const { push, indent, deindent, newline } = context
  const { properties } = node
  if (!properties.length) {
    push(`{}`, NewlineType.None, node)
    return
  }
  const multilines =
    properties.length > 1 ||
    ((!__BROWSER__ || __DEV__) &&
      properties.some(p => p.value.type !== NodeTypes.SIMPLE_EXPRESSION))
  push(multilines ? `{` : `{ `)
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
  genNodeListAsArray(node.elements as CodegenNode[], context)
}

function genFunctionExpression(
  node: FunctionExpression,
  context: CodegenContext,
) {
  const { push, indent, deindent } = context
  const { params, returns, body, newline, isSlot } = node
  if (isSlot) {
    // wrap slot functions with owner context
    push(`_${helperNameMap[WITH_CTX]}(`, NewlineType.None, node)
  }
  push(`(`, NewlineType.None, node)
  if (isArray(params)) {
    genNodeList(params, context)
  } else if (params) {
    genNode(params, context)
  }
  push(`) => `)
  if (newline || body) {
    push(`{`)
    indent()
  }
  if (returns) {
    if (newline) {
      push(`return `)
    }
    if (isArray(returns)) {
      genNodeListAsArray(returns, context)
    } else {
      genNode(returns, context)
    }
  } else if (body) {
    genNode(body, context)
  }
  if (newline || body) {
    deindent()
    push(`}`)
  }
  if (isSlot) {
    if (__COMPAT__ && node.isNonScopedSlot) {
      push(`, undefined, true`)
    }
    push(`)`)
  }
}

function genConditionalExpression(
  node: ConditionalExpression,
  context: CodegenContext,
) {
  const { test, consequent, alternate, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    const needsParens = !isSimpleIdentifier(test.content)
    needsParens && push(`(`)
    genExpression(test, context)
    needsParens && push(`)`)
  } else {
    push(`(`)
    genNode(test, context)
    push(`)`)
  }
  needNewline && indent()
  context.indentLevel++
  needNewline || push(` `)
  push(`? `)
  genNode(consequent, context)
  context.indentLevel--
  needNewline && newline()
  needNewline || push(` `)
  push(`: `)
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  if (!isNested) {
    context.indentLevel++
  }
  genNode(alternate, context)
  if (!isNested) {
    context.indentLevel--
  }
  needNewline && deindent(true /* without newline */)
}

function genCacheExpression(node: CacheExpression, context: CodegenContext) {
  const { push, helper, indent, deindent, newline } = context
  const { needPauseTracking, needArraySpread } = node
  if (needArraySpread) {
    push(`[...(`)
  }
  push(`_cache[${node.index}] || (`)
  if (needPauseTracking) {
    indent()
    push(`${helper(SET_BLOCK_TRACKING)}(-1`)
    if (node.inVOnce) push(`, true`)
    push(`),`)
    newline()
    push(`(`)
  }
  push(`_cache[${node.index}] = `)
  genNode(node.value, context)
  if (needPauseTracking) {
    push(`).cacheIndex = ${node.index},`)
    newline()
    push(`${helper(SET_BLOCK_TRACKING)}(1),`)
    newline()
    push(`_cache[${node.index}]`)
    deindent()
  }
  push(`)`)
  if (needArraySpread) {
    push(`)]`)
  }
}

function genTemplateLiteral(node: TemplateLiteral, context: CodegenContext) {
  const { push, indent, deindent } = context
  push('`')
  const l = node.elements.length
  const multilines = l > 3
  for (let i = 0; i < l; i++) {
    const e = node.elements[i]
    if (isString(e)) {
      push(e.replace(/(`|\$|\\)/g, '\\$1'), NewlineType.Unknown)
    } else {
      push('${')
      if (multilines) indent()
      genNode(e, context)
      if (multilines) deindent()
      push('}')
    }
  }
  push('`')
}

function genIfStatement(node: IfStatement, context: CodegenContext) {
  const { push, indent, deindent } = context
  const { test, consequent, alternate } = node
  push(`if (`)
  genNode(test, context)
  push(`) {`)
  indent()
  genNode(consequent, context)
  deindent()
  push(`}`)
  if (alternate) {
    push(` else `)
    if (alternate.type === NodeTypes.JS_IF_STATEMENT) {
      genIfStatement(alternate, context)
    } else {
      push(`{`)
      indent()
      genNode(alternate, context)
      deindent()
      push(`}`)
    }
  }
}

function genAssignmentExpression(
  node: AssignmentExpression,
  context: CodegenContext,
) {
  genNode(node.left, context)
  context.push(` = `)
  genNode(node.right, context)
}

function genSequenceExpression(
  node: SequenceExpression,
  context: CodegenContext,
) {
  context.push(`(`)
  genNodeList(node.expressions, context)
  context.push(`)`)
}

function genReturnStatement(
  { returns }: ReturnStatement,
  context: CodegenContext,
) {
  context.push(`return `)
  if (isArray(returns)) {
    genNodeListAsArray(returns, context)
  } else {
    genNode(returns, context)
  }
}
