import {
  BindingTypes,
  type CodegenOptions,
  type CodegenResult,
  NewlineType,
  type Position,
  type SourceLocation,
  advancePositionWithClone,
  advancePositionWithMutation,
  createSimpleExpression,
  isSimpleIdentifier,
  locStub,
  walkIdentifiers,
} from '@vue/compiler-dom'
import {
  type AppendNodeIRNode,
  type CreateTextNodeIRNode,
  type IRDynamicChildren,
  type IRExpression,
  IRNodeTypes,
  type InsertNodeIRNode,
  type OperationNode,
  type PrependNodeIRNode,
  type RootIRNode,
  type SetEventIRNode,
  type SetHtmlIRNode,
  type SetPropIRNode,
  type SetTextIRNode,
  type VaporHelper,
  type WithDirectiveIRNode,
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
  pushNewline(
    code: string,
    newlineIndex?: number,
    loc?: SourceLocation,
    name?: string,
  ): void
  pushMulti(
    codes: [left: string, right: string, segment?: string],
    ...fn: Array<false | string | (() => void)>
  ): void
  pushFnCall(name: string, ...args: Array<false | string | (() => void)>): void
  withIndent(fn: () => void): void
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
    pushNewline(code, newlineIndex, node) {
      context.newline()
      context.push(code, newlineIndex, node)
    },
    pushMulti([left, right, seg], ...fns) {
      fns = fns.filter(Boolean)
      context.push(left)
      for (let i = 0; i < fns.length; i++) {
        const fn = fns[i] as string | (() => void)

        if (isString(fn)) context.push(fn)
        else fn()
        if (seg && i < fns.length - 1) context.push(seg)
      }
      context.push(right)
    },
    pushFnCall(name, ...args) {
      context.push(name)
      context.pushMulti(['(', ')', ', '], ...args)
    },
    withIndent(fn) {
      ++context.indentLevel
      fn()
      --context.indentLevel
    },
    newline() {
      context.push(`\n${`  `.repeat(context.indentLevel)}`, NewlineType.Start)
    },
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
      // @ts-expect-error it is possible to be null
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
  const {
    push,
    pushNewline,
    withIndent,
    newline,
    helpers,
    vaporHelper,
    vaporHelpers,
  } = ctx

  const functionName = 'render'
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    push(`(() => {`)
  } else {
    // placeholder for preamble
    newline()
    pushNewline(`export function ${functionName}(_ctx) {`)
  }

  withIndent(() => {
    ir.template.forEach((template, i) => {
      if (template.type === IRNodeTypes.TEMPLATE_FACTORY) {
        // TODO source map?
        pushNewline(
          `const t${i} = ${vaporHelper('template')}(${JSON.stringify(
            template.template,
          )})`,
        )
      } else {
        // fragment
        pushNewline(
          `const t0 = ${vaporHelper('fragment')}()\n`,
          NewlineType.End,
        )
      }
    })

    {
      pushNewline(`const n${ir.dynamic.id} = t0()`)

      const children = genChildren(ir.dynamic.children)
      if (children) {
        pushNewline(
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
        pushNewline(`${vaporHelper('watchEffect')}(() => {`)
        withIndent(() => {
          for (const operation of operations) {
            genOperation(operation, ctx)
          }
        })
        pushNewline('})')
      }

      // TODO multiple-template
      // TODO return statement in IR
      pushNewline(`return n${ir.dynamic.id}`)
    }
  })

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
  const { pushFnCall, newline, vaporHelper, helper } = context

  newline()
  pushFnCall(
    vaporHelper('setAttr'),
    `n${oper.element}`,
    // 2. key name
    () => {
      if (oper.runtimeCamelize) {
        pushFnCall(helper('camelize'), () => genExpression(oper.key, context))
      } else {
        genExpression(oper.key, context)
      }
    },
    'undefined',
    () => genExpression(oper.value, context),
  )
}

function genSetText(oper: SetTextIRNode, context: CodegenContext) {
  const { pushFnCall, newline, vaporHelper } = context
  newline()
  pushFnCall(vaporHelper('setText'), `n${oper.element}`, 'undefined', () =>
    genExpression(oper.value, context),
  )
}

function genSetHtml(oper: SetHtmlIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(vaporHelper('setHtml'), `n${oper.element}`, 'undefined', () =>
    genExpression(oper.value, context),
  )
}

function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
) {
  const { pushNewline, pushFnCall, vaporHelper } = context
  pushNewline(`const n${oper.id} = `)
  pushFnCall(vaporHelper('createTextNode'), () =>
    genExpression(oper.value, context),
  )
}

function genInsertNode(oper: InsertNodeIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map((el) => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  newline()
  pushFnCall(
    vaporHelper('insert'),
    element,
    `n${oper.parent}`,
    `n${oper.anchor}`,
  )
}

function genPrependNode(oper: PrependNodeIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(
    vaporHelper('prepend'),
    `n${oper.parent}`,
    oper.elements.map((el) => `n${el}`).join(', '),
  )
}

function genAppendNode(oper: AppendNodeIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(
    vaporHelper('append'),
    `n${oper.parent}`,
    oper.elements.map((el) => `n${el}`).join(', '),
  )
}

function genSetEvent(oper: SetEventIRNode, context: CodegenContext) {
  const { vaporHelper, push, newline, pushMulti, pushFnCall } = context
  const { keys, nonKeys, options } = oper.modifiers

  newline()
  pushFnCall(
    vaporHelper('on'),
    // 1st arg: event name
    () => push(`n${oper.element}`),
    // 2nd arg: event name
    () => {
      if (oper.keyOverride) {
        const find = JSON.stringify(oper.keyOverride[0])
        const replacement = JSON.stringify(oper.keyOverride[1])
        pushMulti(['(', ')'], () => genExpression(oper.key, context))
        push(` === ${find} ? ${replacement} : `)
        pushMulti(['(', ')'], () => genExpression(oper.key, context))
      } else {
        genExpression(oper.key, context)
      }
    },
    // 3rd arg: event handler
    () => {
      const pushWithKeys = (fn: () => void) => {
        push(`${vaporHelper('withKeys')}(`)
        fn()
        push(`, ${genArrayExpression(keys)})`)
      }
      const pushWithModifiers = (fn: () => void) => {
        push(`${vaporHelper('withModifiers')}(`)
        fn()
        push(`, ${genArrayExpression(nonKeys)})`)
      }
      const pushNoop = (fn: () => void) => fn()

      ;(keys.length ? pushWithKeys : pushNoop)(() =>
        (nonKeys.length ? pushWithModifiers : pushNoop)(() => {
          if (oper.value && oper.value.content.trim()) {
            push('(...args) => (')
            genExpression(oper.value, context)
            push(' && ')
            genExpression(oper.value, context)
            push('(...args))')
          } else {
            push('() => {}')
          }
        }),
      )
    },
    // 4th arg, gen options
    !!options.length &&
      (() => push(`{ ${options.map((v) => `${v}: true`).join(', ')} }`)),
  )
}

function genWithDirective(oper: WithDirectiveIRNode, context: CodegenContext) {
  const { push, newline, pushFnCall, pushMulti, vaporHelper, bindingMetadata } =
    context
  const { dir } = oper

  // TODO merge directive for the same node
  newline()
  pushFnCall(
    vaporHelper('withDirectives'),
    // 1st arg: node
    `n${oper.element}`,
    // 2nd arg: directives
    () => {
      push('[')
      // directive
      pushMulti(['[', ']', ', '], () => {
        if (dir.name === 'show') {
          push(vaporHelper('vShow'))
        } else {
          const directiveReference = camelize(`v-${dir.name}`)
          // TODO resolve directive
          if (bindingMetadata[directiveReference]) {
            const directiveExpression =
              createSimpleExpression(directiveReference)
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
      })
      push(']')
    },
  )
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
  if (isStatic) {
    return push(JSON.stringify(rawExpr), NewlineType.None, loc)
  }
  if (
    __BROWSER__ ||
    !context.prefixIdentifiers ||
    !node.content.trim() ||
    // there was a parsing error
    ast === false ||
    isGloballyAllowed(rawExpr) ||
    isLiteralWhitelisted(rawExpr)
  ) {
    return push(rawExpr, NewlineType.None, loc)
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
