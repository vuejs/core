import {
  type CodegenOptions,
  type CodegenResult,
  type Position,
  type SourceLocation,
  NewlineType,
  advancePositionWithMutation,
  locStub,
  BindingTypes,
  createSimpleExpression,
  walkIdentifiers,
  advancePositionWithClone,
  isSimpleIdentifier,
} from '@vue/compiler-dom'
import {
  type IRDynamicChildren,
  type RootIRNode,
  type SetPropIRNode,
  type IRExpression,
  type OperationNode,
  type VaporHelper,
  type SetEventIRNode,
  type WithDirectiveIRNode,
  type SetTextIRNode,
  type SetHtmlIRNode,
  type CreateTextNodeIRNode,
  type InsertNodeIRNode,
  type PrependNodeIRNode,
  type AppendNodeIRNode,
  IRNodeTypes,
} from './ir'
import { SourceMapGenerator } from 'source-map-js'
import { camelize, isGloballyAllowed, isString, makeMap } from '@vue/shared'
import type { Identifier } from '@babel/types'

// remove when stable
// @ts-expect-error
function checkNever(x: never): never {}

export interface CodegenContext extends Required<CodegenOptions> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indentLevel: number
  map?: SourceMapGenerator

  push(
    code: string,
    newlineIndex?: number,
    loc?: SourceLocation,
    name?: string,
  ): void
  pushWithNewline(
    code: string,
    newlineIndex?: number,
    loc?: SourceLocation,
    name?: string,
  ): void
  indent(): void
  deindent(): void
  newline(): void

  helpers: Set<string>
  vaporHelpers: Set<string>
  helper(name: string): string
  vaporHelper(name: string): string
}

function createCodegenContext(
  ir: RootIRNode,
  {
    mode = 'function',
    prefixIdentifiers = mode === 'module',
    sourceMap = false,
    filename = `template.vue.html`,
    scopeId = null,
    optimizeImports = false,
    runtimeGlobalName = `Vue`,
    runtimeModuleName = `vue`,
    ssrRuntimeModuleName = 'vue/server-renderer',
    ssr = false,
    isTS = false,
    inSSR = false,
    inline = false,
    bindingMetadata = {},
  }: CodegenOptions,
) {
  const { helpers, vaporHelpers } = ir
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
    bindingMetadata,
    inline,

    source: ir.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
    indentLevel: 0,

    helpers,
    vaporHelpers,
    helper(name: string) {
      helpers.add(name)
      return `_${name}`
    },
    vaporHelper(name: VaporHelper) {
      vaporHelpers.add(name)
      return `_${name}`
    },
    push(code, newlineIndex = NewlineType.None, loc, name) {
      context.code += code
      if (!__BROWSER__ && context.map) {
        if (loc) addMapping(loc.start, name)

        if (newlineIndex === NewlineType.Unknown) {
          // multiple newlines, full iteration
          advancePositionWithMutation(context, code)
        } else {
          // fast paths
          context.offset += code.length
          if (newlineIndex === NewlineType.None) {
            // no newlines; fast path to avoid newline detection
            if (__TEST__ && code.includes('\n')) {
              throw new Error(
                `CodegenContext.push() called newlineIndex: none, but contains` +
                  `newlines: ${code.replace(/\n/g, '\\n')}`,
              )
            }
            context.column += code.length
          } else {
            // single newline at known index
            if (newlineIndex === NewlineType.End) {
              newlineIndex = code.length - 1
            }
            if (
              __TEST__ &&
              (code.charAt(newlineIndex) !== '\n' ||
                code.slice(0, newlineIndex).includes('\n') ||
                code.slice(newlineIndex + 1).includes('\n'))
            ) {
              throw new Error(
                `CodegenContext.push() called with newlineIndex: ${newlineIndex} ` +
                  `but does not conform: ${code.replace(/\n/g, '\\n')}`,
              )
            }
            context.line++
            context.column = code.length - newlineIndex
          }
        }
        if (loc && loc !== locStub) {
          addMapping(loc.end)
        }
      }
    },
    pushWithNewline(code, newlineIndex, node) {
      context.newline()
      context.push(code, newlineIndex, node)
    },
    indent() {
      ++context.indentLevel
    },
    deindent() {
      --context.indentLevel
    },
    newline() {
      newline(context.indentLevel)
    },
  }

  function newline(n: number) {
    context.push(`\n${`  `.repeat(n)}`, NewlineType.Start)
  }

  function addMapping(loc: Position, name: string | null = null) {
    // we use the private property to directly add the mapping
    // because the addMapping() implementation in source-map-js has a bunch of
    // unnecessary arg and validation checks that are pure overhead in our case.
    const { _names, _mappings } = context.map!
    if (name !== null && !_names.has(name)) _names.add(name)
    _mappings.add({
      originalLine: loc.line,
      originalColumn: loc.column - 1, // source-map column is 0 based
      generatedLine: context.line,
      generatedColumn: context.column - 1,
      source: filename,
      // @ts-ignore it is possible to be null
      name,
    })
  }

  if (!__BROWSER__ && sourceMap) {
    // lazy require source-map implementation, only in non-browser builds
    context.map = new SourceMapGenerator()
    context.map.setSourceContent(filename, context.source)
    context.map._sources.add(filename)
  }

  return context
}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): CodegenResult {
  const ctx = createCodegenContext(ir, options)
  const { push, pushWithNewline, indent, deindent, newline } = ctx
  const { vaporHelper, helpers, vaporHelpers } = ctx

  const functionName = 'render'
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    push(`(() => {`)
  } else {
    // placeholder for preamble
    newline()
    pushWithNewline(`export function ${functionName}(_ctx) {`)
  }
  indent()

  ir.template.forEach((template, i) => {
    if (template.type === IRNodeTypes.TEMPLATE_FACTORY) {
      // TODO source map?
      pushWithNewline(
        `const t${i} = ${vaporHelper('template')}(${JSON.stringify(
          template.template,
        )})`,
      )
    } else {
      // fragment
      pushWithNewline(
        `const t0 = ${vaporHelper('fragment')}()\n`,
        NewlineType.End,
      )
    }
  })

  {
    pushWithNewline(`const n${ir.dynamic.id} = t0()`)

    const children = genChildren(ir.dynamic.children)
    if (children) {
      pushWithNewline(
        `const ${children} = ${vaporHelper('children')}(n${ir.dynamic.id})`,
      )
    }

    for (const oper of ir.operation.filter(
      (oper): oper is WithDirectiveIRNode =>
        oper.type === IRNodeTypes.WITH_DIRECTIVE,
    )) {
      genWithDirective(oper, ctx)
    }

    for (const operation of ir.operation) {
      genOperation(operation, ctx)
    }

    for (const { operations } of ir.effect) {
      pushWithNewline(`${vaporHelper('effect')}(() => {`)
      indent()
      for (const operation of operations) {
        genOperation(operation, ctx)
      }
      deindent()
      pushWithNewline('})')
    }

    // TODO multiple-template
    // TODO return statement in IR
    pushWithNewline(`return n${ir.dynamic.id}`)
  }

  deindent()
  newline()
  if (isSetupInlined) {
    push('})()')
  } else {
    push('}')
  }

  let preamble = ''
  if (vaporHelpers.size)
    // TODO: extract import codegen
    preamble = `import { ${[...vaporHelpers]
      .map((h) => `${h} as _${h}`)
      .join(', ')} } from 'vue/vapor';`
  if (helpers.size)
    preamble = `import { ${[...helpers]
      .map((h) => `${h} as _${h}`)
      .join(', ')} } from 'vue';`

  if (!isSetupInlined) {
    ctx.code = preamble + ctx.code
  }

  return {
    code: ctx.code,
    ast: ir as any,
    preamble,
    map: ctx.map ? ctx.map.toJSON() : undefined,
  }
}

function genChildren(children: IRDynamicChildren) {
  let code = ''
  // TODO
  let offset = 0
  for (const [index, child] of Object.entries(children)) {
    const childrenLength = Object.keys(child.children).length
    if (child.ghost && child.placeholder === null && childrenLength === 0) {
      offset--
      continue
    }

    code += ` ${Number(index) + offset}: [`

    const id = child.ghost ? child.placeholder : child.id
    if (id !== null) code += `n${id}`

    const childrenString = childrenLength && genChildren(child.children)
    if (childrenString) code += `, ${childrenString}`

    code += '],'
  }

  if (!code) return ''
  return `{${code}}`
}

function genOperation(oper: OperationNode, context: CodegenContext) {
  // TODO: cache old value
  switch (oper.type) {
    case IRNodeTypes.SET_PROP:
      return genSetProp(oper, context)
    case IRNodeTypes.SET_TEXT:
      return genSetText(oper, context)
    case IRNodeTypes.SET_EVENT:
      return genSetEvent(oper, context)
    case IRNodeTypes.SET_HTML:
      return genSetHtml(oper, context)
    case IRNodeTypes.CREATE_TEXT_NODE:
      return genCreateTextNode(oper, context)
    case IRNodeTypes.INSERT_NODE:
      return genInsertNode(oper, context)
    case IRNodeTypes.PREPEND_NODE:
      return genPrependNode(oper, context)
    case IRNodeTypes.APPEND_NODE:
      return genAppendNode(oper, context)
    case IRNodeTypes.WITH_DIRECTIVE:
      // generated, skip
      return
    default:
      return checkNever(oper)
  }
}

function genSetProp(oper: SetPropIRNode, context: CodegenContext) {
  const { push, pushWithNewline, vaporHelper, helper } = context
  pushWithNewline(`${vaporHelper('setAttr')}(n${oper.element}, `)
  if (oper.runtimeCamelize) push(`${helper('camelize')}(`)
  genExpression(oper.key, context)
  if (oper.runtimeCamelize) push(`)`)
  push(`, undefined, `)
  genExpression(oper.value, context)
  push(')')
}

function genSetText(oper: SetTextIRNode, context: CodegenContext) {
  const { push, pushWithNewline, vaporHelper } = context
  pushWithNewline(`${vaporHelper('setText')}(n${oper.element}, undefined, `)
  genExpression(oper.value, context)
  push(')')
}

function genSetHtml(oper: SetHtmlIRNode, context: CodegenContext) {
  const { push, pushWithNewline, vaporHelper } = context
  pushWithNewline(`${vaporHelper('setHtml')}(n${oper.element}, undefined, `)
  genExpression(oper.value, context)
  push(')')
}

function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
) {
  const { push, pushWithNewline, vaporHelper } = context
  pushWithNewline(`const n${oper.id} = ${vaporHelper('createTextNode')}(`)
  genExpression(oper.value, context)
  push(')')
}

function genInsertNode(oper: InsertNodeIRNode, context: CodegenContext) {
  const { pushWithNewline, vaporHelper } = context
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map((el) => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  pushWithNewline(
    `${vaporHelper('insert')}(${element}, n${
      oper.parent
    }${`, n${oper.anchor}`})`,
  )
}

function genPrependNode(oper: PrependNodeIRNode, context: CodegenContext) {
  const { pushWithNewline, vaporHelper } = context
  pushWithNewline(
    `${vaporHelper('prepend')}(n${oper.parent}, ${oper.elements
      .map((el) => `n${el}`)
      .join(', ')})`,
  )
}

function genAppendNode(oper: AppendNodeIRNode, context: CodegenContext) {
  const { pushWithNewline, vaporHelper } = context
  pushWithNewline(
    `${vaporHelper('append')}(n${oper.parent}, ${oper.elements
      .map((el) => `n${el}`)
      .join(', ')})`,
  )
}

function genSetEvent(oper: SetEventIRNode, context: CodegenContext) {
  const { vaporHelper, push, pushWithNewline } = context

  pushWithNewline(`${vaporHelper('on')}(n${oper.element}, `)
  // second arg: event name
  genExpression(oper.key, context)
  push(', ')

  const { keys, nonKeys, options } = oper.modifiers
  if (keys.length) {
    push(`${vaporHelper('withKeys')}(`)
  }
  if (nonKeys.length) {
    push(`${vaporHelper('withModifiers')}(`)
  }

  // gen event handler
  push('(...args) => (')
  genExpression(oper.value, context)
  push(' && ')
  genExpression(oper.value, context)
  push('(...args))')

  if (nonKeys.length) {
    push(`, ${genArrayExpression(nonKeys)})`)
  }
  if (keys.length) {
    push(`, ${genArrayExpression(keys)})`)
  }
  if (options.length) {
    push(`, { ${options.map((v) => `${v}: true`).join(', ')} }`)
  }

  push(')')
}

function genWithDirective(oper: WithDirectiveIRNode, context: CodegenContext) {
  const { push, pushWithNewline, vaporHelper, bindingMetadata } = context
  const { dir } = oper

  // TODO merge directive for the same node
  pushWithNewline(`${vaporHelper('withDirectives')}(n${oper.element}, [[`)

  if (dir.name === 'show') {
    push(vaporHelper('vShow'))
  } else {
    const directiveReference = camelize(`v-${dir.name}`)
    // TODO resolve directive
    if (bindingMetadata[directiveReference]) {
      const directiveExpression = createSimpleExpression(directiveReference)
      directiveExpression.ast = null
      genExpression(directiveExpression, context)
    }
  }

  if (dir.exp) {
    push(', () => ')
    genExpression(dir.exp, context)
  } else if (dir.arg || dir.modifiers.length) {
    push(', void 0')
  }

  if (dir.arg) {
    push(', ')
    genExpression(dir.arg, context)
  } else if (dir.modifiers.length) {
    push(', void 0')
  }

  if (dir.modifiers.length) {
    push(', ')
    push('{ ')
    push(genDirectiveModifiers(dir.modifiers))
    push(' }')
  }
  push(']])')
  return
}

// TODO: other types (not only string)
function genArrayExpression(elements: string[]) {
  return `[${elements.map((it) => JSON.stringify(it)).join(', ')}]`
}

const isLiteralWhitelisted = /*#__PURE__*/ makeMap('true,false,null,this')

function genExpression(node: IRExpression, context: CodegenContext): void {
  const { push } = context
  if (isString(node)) return push(node)

  const { content: rawExpr, ast, isStatic, loc } = node
  if (__BROWSER__) {
    return push(rawExpr)
  }

  if (
    !context.prefixIdentifiers ||
    !node.content.trim() ||
    // there was a parsing error
    ast === false ||
    isGloballyAllowed(rawExpr) ||
    isLiteralWhitelisted(rawExpr)
  ) {
    return push(rawExpr, NewlineType.None, loc)
  }
  if (isStatic) {
    return push(JSON.stringify(rawExpr), NewlineType.None, loc)
  }

  if (ast === null) {
    // the expression is a simple identifier
    return genIdentifier(rawExpr, context, loc)
  }

  const ids: Identifier[] = []
  walkIdentifiers(
    ast!,
    (id) => {
      ids.push(id)
    },
    true,
  )
  if (ids.length) {
    ids.sort((a, b) => a.start! - b.start!)
    ids.forEach((id, i) => {
      // range is offset by -1 due to the wrapping parens when parsed
      const start = id.start! - 1
      const end = id.end! - 1
      const last = ids[i - 1]

      const leadingText = rawExpr.slice(last ? last.end! - 1 : 0, start)
      if (leadingText.length) push(leadingText, NewlineType.Unknown)

      const source = rawExpr.slice(start, end)
      genIdentifier(source, context, {
        start: advancePositionWithClone(node.loc.start, source, start),
        end: advancePositionWithClone(node.loc.start, source, end),
        source,
      })

      if (i === ids.length - 1 && end < rawExpr.length) {
        push(rawExpr.slice(end), NewlineType.Unknown)
      }
    })
  } else {
    push(rawExpr, NewlineType.Unknown)
  }
}

function genIdentifier(
  id: string,
  { inline, bindingMetadata, vaporHelper, push }: CodegenContext,
  loc?: SourceLocation,
): void {
  let name: string | undefined = id
  if (inline) {
    switch (bindingMetadata[id]) {
      case BindingTypes.SETUP_REF:
        name = id += '.value'
        break
      case BindingTypes.SETUP_MAYBE_REF:
        id = `${vaporHelper('unref')}(${id})`
        name = undefined
        break
    }
  } else {
    id = `_ctx.${id}`
  }
  push(id, NewlineType.None, loc, name)
}

function genDirectiveModifiers(modifiers: string[]) {
  return modifiers
    .map(
      (value) =>
        `${isSimpleIdentifier(value) ? value : JSON.stringify(value)}: true`,
    )
    .join(', ')
}
