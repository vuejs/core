import MagicString from 'magic-string'
import { BindingMetadata } from '@vue/compiler-core'
import { SFCDescriptor, SFCScriptBlock } from './parse'
import { parse, ParserPlugin } from '@babel/parser'
import { babelParserDefaultPlugins, generateCodeFrame } from '@vue/shared'
import {
  Node,
  Declaration,
  ObjectPattern,
  ObjectExpression,
  ArrayPattern,
  Identifier,
  ExpressionStatement,
  ArrowFunctionExpression,
  ExportSpecifier,
  Function as FunctionNode,
  TSType,
  TSTypeLiteral,
  TSFunctionType,
  TSDeclareFunction,
  ObjectProperty,
  ArrayExpression,
  Statement
} from '@babel/types'
import { walk } from 'estree-walker'
import { RawSourceMap } from 'source-map'
import { genCssVarsCode, injectCssVarsCalls } from './genCssVars'

export interface SFCScriptCompileOptions {
  /**
   * https://babeljs.io/docs/en/babel-parser#plugins
   */
  babelParserPlugins?: ParserPlugin[]
}

let hasWarned = false

/**
 * Compile `<script setup>`
 * It requires the whole SFC descriptor because we need to handle and merge
 * normal `<script>` + `<script setup>` if both are present.
 */
export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions = {}
): SFCScriptBlock {
  const { script, scriptSetup, styles, source, filename } = sfc

  if (__DEV__ && !__TEST__ && !hasWarned && scriptSetup) {
    hasWarned = true
    // @ts-ignore `console.info` cannot be null error
    console[console.info ? 'info' : 'log'](
      `\n[@vue/compiler-sfc] <script setup> is still an experimental proposal.\n` +
        `Follow https://github.com/vuejs/rfcs/pull/182 for its status.\n`
    )
  }

  const hasCssVars = styles.some(s => typeof s.attrs.vars === 'string')

  const scriptLang = script && script.lang
  const scriptSetupLang = scriptSetup && scriptSetup.lang
  const isTS = scriptLang === 'ts' || scriptSetupLang === 'ts'
  const plugins: ParserPlugin[] = [...babelParserDefaultPlugins, 'jsx']
  if (options.babelParserPlugins) plugins.push(...options.babelParserPlugins)
  if (isTS) plugins.push('typescript', 'decorators-legacy')

  if (!scriptSetup) {
    if (!script) {
      throw new Error(`SFC contains no <script> tags.`)
    }
    if (scriptLang && scriptLang !== 'ts') {
      // do not process non js/ts script blocks
      return script
    }
    try {
      const scriptAst = parse(script.content, {
        plugins,
        sourceType: 'module'
      }).program.body
      return {
        ...script,
        content: hasCssVars ? injectCssVarsCalls(sfc, plugins) : script.content,
        bindings: analyzeScriptBindings(scriptAst),
        scriptAst
      }
    } catch (e) {
      // silently fallback if parse fails since user may be using custom
      // babel syntax
      return script
    }
  }

  if (script && scriptLang !== scriptSetupLang) {
    throw new Error(
      `<script> and <script setup> must have the same language type.`
    )
  }

  if (scriptSetupLang && scriptSetupLang !== 'ts') {
    // do not process non js/ts script blocks
    return scriptSetup
  }

  const defaultTempVar = `__default__`
  const bindings: BindingMetadata = {}
  const imports: Record<string, string> = {}
  const setupScopeVars: Record<string, boolean> = {}
  const setupExports: Record<string, boolean> = {}
  let exportAllIndex = 0
  let defaultExport: Node | undefined
  let needDefaultExportRefCheck = false
  let hasAwait = false

  const checkDuplicateDefaultExport = (node: Node) => {
    if (defaultExport) {
      // <script> already has export default
      throw new Error(
        `Default export is already declared in normal <script>.\n\n` +
          generateCodeFrame(
            source,
            node.start! + startOffset,
            node.start! + startOffset + `export default`.length
          )
      )
    }
  }

  const s = new MagicString(source)
  const startOffset = scriptSetup.loc.start.offset
  const endOffset = scriptSetup.loc.end.offset
  const scriptStartOffset = script && script.loc.start.offset
  const scriptEndOffset = script && script.loc.end.offset

  let scriptAst

  // 1. process normal <script> first if it exists
  if (script) {
    // import dedupe between <script> and <script setup>
    scriptAst = parse(script.content, {
      plugins,
      sourceType: 'module'
    }).program.body

    for (const node of scriptAst) {
      if (node.type === 'ImportDeclaration') {
        // record imports for dedupe
        for (const {
          local: { name }
        } of node.specifiers) {
          imports[name] = node.source.value
        }
      } else if (node.type === 'ExportDefaultDeclaration') {
        // export default
        defaultExport = node
        const start = node.start! + scriptStartOffset!
        s.overwrite(
          start,
          start + `export default`.length,
          `const ${defaultTempVar} =`
        )
      } else if (node.type === 'ExportNamedDeclaration' && node.specifiers) {
        const defaultSpecifier = node.specifiers.find(
          s => s.exported.type === 'Identifier' && s.exported.name === 'default'
        ) as ExportSpecifier
        if (defaultSpecifier) {
          defaultExport = node
          // 1. remove specifier
          if (node.specifiers.length > 1) {
            s.remove(
              defaultSpecifier.start! + scriptStartOffset!,
              defaultSpecifier.end! + scriptStartOffset!
            )
          } else {
            s.remove(
              node.start! + scriptStartOffset!,
              node.end! + scriptStartOffset!
            )
          }
          if (node.source) {
            // export { x as default } from './x'
            // rewrite to `import { x as __default__ } from './x'` and
            // add to top
            s.prepend(
              `import { ${
                defaultSpecifier.local.name
              } as ${defaultTempVar} } from '${node.source.value}'\n`
            )
          } else {
            // export { x as default }
            // rewrite to `const __default__ = x` and move to end
            s.append(
              `\nconst ${defaultTempVar} = ${defaultSpecifier.local.name}\n`
            )
          }
        }
      }
    }
  }

  // 2. check <script setup="xxx"> function signature
  const setupValue = scriptSetup.setup
  const hasExplicitSignature = typeof setupValue === 'string'

  let propsVar: string | undefined
  let emitVar: string | undefined
  let slotsVar: string | undefined
  let attrsVar: string | undefined

  let propsType = `{}`
  let emitType = `(e: string, ...args: any[]) => void`
  let slotsType = `__Slots__`
  let attrsType = `Record<string, any>`

  let propsASTNode
  let setupCtxASTNode

  // props/emits declared via types
  const typeDeclaredProps: Record<string, PropTypeData> = {}
  const typeDeclaredEmits: Set<string> = new Set()
  // record declared types for runtime props type generation
  const declaredTypes: Record<string, string[]> = {}

  if (isTS && hasExplicitSignature) {
    // <script setup="xxx" lang="ts">
    // parse the signature to extract the props/emit variables the user wants
    // we need them to find corresponding type declarations.
    const signatureAST = parse(`(${setupValue})=>{}`, { plugins }).program
      .body[0]
    const params = ((signatureAST as ExpressionStatement)
      .expression as ArrowFunctionExpression).params
    if (params[0] && params[0].type === 'Identifier') {
      propsASTNode = params[0]
      propsVar = propsASTNode.name
    }
    if (params[1] && params[1].type === 'ObjectPattern') {
      setupCtxASTNode = params[1]
      for (const p of params[1].properties) {
        if (
          p.type === 'ObjectProperty' &&
          p.key.type === 'Identifier' &&
          p.value.type === 'Identifier'
        ) {
          if (p.key.name === 'emit') {
            emitVar = p.value.name
          } else if (p.key.name === 'slots') {
            slotsVar = p.value.name
          } else if (p.key.name === 'attrs') {
            attrsVar = p.value.name
          }
        }
      }
    }
  }

  // 3. parse <script setup> and  walk over top level statements
  const scriptSetupAst = parse(scriptSetup.content, {
    plugins: [
      ...plugins,
      // allow top level await but only inside <script setup>
      'topLevelAwait'
    ],
    sourceType: 'module'
  }).program.body

  for (const node of scriptSetupAst) {
    const start = node.start! + startOffset
    let end = node.end! + startOffset
    // import or type declarations: move to top
    // locate comment
    if (node.trailingComments && node.trailingComments.length > 0) {
      const lastCommentNode =
        node.trailingComments[node.trailingComments.length - 1]
      end = lastCommentNode.end + startOffset
    }
    // locate the end of whitespace between this statement and the next
    while (end <= source.length) {
      if (!/\s/.test(source.charAt(end))) {
        break
      }
      end++
    }

    if (node.type === 'ImportDeclaration') {
      // import declarations are moved to top
      s.move(start, end, 0)
      // dedupe imports
      let prev
      let removed = 0
      for (const specifier of node.specifiers) {
        if (imports[specifier.local.name]) {
          // already imported in <script setup>, dedupe
          removed++
          s.remove(
            prev ? prev.end! + startOffset : specifier.start! + startOffset,
            specifier.end! + startOffset
          )
        } else {
          imports[specifier.local.name] = node.source.value
        }
        prev = specifier
      }
      if (removed === node.specifiers.length) {
        s.remove(node.start! + startOffset, node.end! + startOffset)
      }
    }

    if (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type') {
      // named exports
      if (node.declaration) {
        // variable/function/class declarations.
        // remove leading `export ` keyword
        s.remove(start, start + 7)
        walkDeclaration(node.declaration, setupExports)
      }
      if (node.specifiers.length) {
        // named export with specifiers
        if (node.source) {
          // export { x } from './x'
          // change it to import and move to top
          s.overwrite(start, start + 6, 'import')
          s.move(start, end, 0)
        } else {
          // export { x }
          s.remove(start, end)
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ExportDefaultSpecifier') {
            // export default from './x'
            // rewrite to `import __default__ from './x'`
            checkDuplicateDefaultExport(node)
            defaultExport = node
            s.overwrite(
              specifier.exported.start! + startOffset,
              specifier.exported.start! + startOffset + 7,
              defaultTempVar
            )
          } else if (
            specifier.type === 'ExportSpecifier' &&
            specifier.exported.type === 'Identifier'
          ) {
            if (specifier.exported.name === 'default') {
              checkDuplicateDefaultExport(node)
              defaultExport = node
              // 1. remove specifier
              if (node.specifiers.length > 1) {
                // removing the default specifier from a list of specifiers.
                // look ahead until we reach the first non , or whitespace char.
                let end = specifier.end! + startOffset
                while (end < source.length) {
                  if (/[^,\s]/.test(source.charAt(end))) {
                    break
                  }
                  end++
                }
                s.remove(specifier.start! + startOffset, end)
              } else {
                s.remove(node.start! + startOffset!, node.end! + startOffset!)
              }
              if (!node.source) {
                // export { x as default, ... }
                const local = specifier.local.name
                if (setupScopeVars[local] || setupExports[local]) {
                  throw new Error(
                    `Cannot export locally defined variable as default in <script setup>.\n` +
                      `Default export must be an object literal with no reference to local scope.\n` +
                      generateCodeFrame(
                        source,
                        specifier.start! + startOffset,
                        specifier.end! + startOffset
                      )
                  )
                }
                // rewrite to `const __default__ = x` and move to end
                s.append(`\nconst ${defaultTempVar} = ${local}\n`)
              } else {
                // export { x as default } from './x'
                // rewrite to `import { x as __default__ } from './x'` and
                // add to top
                s.prepend(
                  `import { ${
                    specifier.local.name
                  } as ${defaultTempVar} } from '${node.source.value}'\n`
                )
              }
            } else {
              setupExports[specifier.exported.name] = true
              if (node.source) {
                imports[specifier.exported.name] = node.source.value
              }
            }
          }
        }
      }
    }

    if (node.type === 'ExportAllDeclaration') {
      // export * from './x'
      s.overwrite(
        start,
        node.source.start! + startOffset,
        `import * as __export_all_${exportAllIndex++}__ from `
      )
      s.move(start, end, 0)
    }

    if (node.type === 'ExportDefaultDeclaration') {
      checkDuplicateDefaultExport(node)
      // export default {} inside <script setup>
      // this should be kept in module scope - move it to the end
      s.move(start, end, source.length)
      s.overwrite(start, start + `export default`.length, `const __default__ =`)
      // save it for analysis when all imports and variable declarations have
      // been recorded
      defaultExport = node
      needDefaultExportRefCheck = true
    }

    if (
      (node.type === 'VariableDeclaration' ||
        node.type === 'FunctionDeclaration' ||
        node.type === 'ClassDeclaration') &&
      !node.declare
    ) {
      walkDeclaration(node, setupScopeVars)
    }

    // Type declarations
    if (node.type === 'VariableDeclaration' && node.declare) {
      s.remove(start, end)
      for (const { id } of node.declarations) {
        if (id.type === 'Identifier') {
          if (
            id.typeAnnotation &&
            id.typeAnnotation.type === 'TSTypeAnnotation'
          ) {
            const typeNode = id.typeAnnotation.typeAnnotation
            const typeString = source.slice(
              typeNode.start! + startOffset,
              typeNode.end! + startOffset
            )
            if (typeNode.type === 'TSTypeLiteral') {
              if (id.name === propsVar) {
                propsType = typeString
                extractRuntimeProps(typeNode, typeDeclaredProps, declaredTypes)
              } else if (id.name === slotsVar) {
                slotsType = typeString
              } else if (id.name === attrsVar) {
                attrsType = typeString
              }
            } else if (
              id.name === emitVar &&
              typeNode.type === 'TSFunctionType'
            ) {
              emitType = typeString
              extractRuntimeEmits(typeNode, typeDeclaredEmits)
            }
          }
        }
      }
    }

    if (
      node.type === 'TSDeclareFunction' &&
      node.id &&
      node.id.name === emitVar
    ) {
      const index = node.id.start! + startOffset
      s.overwrite(index, index + emitVar.length, '__emit__')
      emitType = `typeof __emit__`
      extractRuntimeEmits(node, typeDeclaredEmits)
    }

    // move all type declarations to outer scope
    if (
      node.type.startsWith('TS') ||
      (node.type === 'ExportNamedDeclaration' && node.exportKind === 'type')
    ) {
      recordType(node, declaredTypes)
      s.move(start, end, 0)
    }

    // walk statements & named exports / variable declarations for top level
    // await
    if (
      node.type === 'VariableDeclaration' ||
      (node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.type === 'VariableDeclaration') ||
      node.type.endsWith('Statement')
    ) {
      ;(walk as any)(node, {
        enter(node: Node) {
          if (isFunction(node)) {
            this.skip()
          }
          if (node.type === 'AwaitExpression') {
            hasAwait = true
          }
        }
      })
    }
  }

  // 4. check default export to make sure it doesn't reference setup scope
  // variables
  if (needDefaultExportRefCheck) {
    checkDefaultExport(
      defaultExport!,
      setupScopeVars,
      imports,
      setupExports,
      source,
      startOffset
    )
  }

  // 5. remove non-script content
  if (script) {
    if (startOffset < scriptStartOffset!) {
      // <script setup> before <script>
      s.remove(endOffset, scriptStartOffset!)
      s.remove(scriptEndOffset!, source.length)
    } else {
      // <script> before <script setup>
      s.remove(0, scriptStartOffset!)
      s.remove(scriptEndOffset!, startOffset)
      s.remove(endOffset, source.length)
    }
  } else {
    // only <script setup>
    s.remove(0, startOffset)
    s.remove(endOffset, source.length)
  }

  // 5. finalize setup argument signature.
  let args = ``
  if (isTS) {
    if (slotsType === '__Slots__') {
      s.prepend(`import { Slots as __Slots__ } from 'vue'\n`)
    }
    const ctxType = `{
  emit: ${emitType},
  slots: ${slotsType},
  attrs: ${attrsType}
}`
    if (hasExplicitSignature) {
      // inject types to user signature
      args = setupValue as string
      const ss = new MagicString(args)
      if (propsASTNode) {
        // compensate for () wraper offset
        ss.appendRight(propsASTNode.end! - 1, `: ${propsType}`)
      }
      if (setupCtxASTNode) {
        ss.appendRight(setupCtxASTNode.end! - 1!, `: ${ctxType}`)
      }
      args = ss.toString()
    }
  } else {
    args = hasExplicitSignature ? (setupValue as string) : ``
  }

  // 6. wrap setup code with function.
  // export the content of <script setup> as a named export, `setup`.
  // this allows `import { setup } from '*.vue'` for testing purposes.
  s.prependLeft(
    startOffset,
    `\nexport ${hasAwait ? `async ` : ``}function setup(${args}) {\n`
  )

  // generate return statement
  let returned = `{ ${Object.keys(setupExports).join(', ')} }`

  // handle `export * from`. We need to call `toRefs` on the imported module
  // object before merging.
  if (exportAllIndex > 0) {
    s.prepend(`import { toRefs as __toRefs__ } from 'vue'\n`)
    for (let i = 0; i < exportAllIndex; i++) {
      returned += `,\n  __toRefs__(__export_all_${i}__)`
    }
    returned = `Object.assign(\n  ${returned}\n)`
  }

  // inject `useCssVars` calls
  if (hasCssVars) {
    s.prepend(`import { useCssVars as __useCssVars__ } from 'vue'\n`)
    for (const style of styles) {
      const vars = style.attrs.vars
      if (typeof vars === 'string') {
        s.prependRight(
          endOffset,
          `\n${genCssVarsCode(vars, !!style.scoped, setupExports)}`
        )
      }
    }
  }

  s.appendRight(endOffset, `\nreturn ${returned}\n}\n\n`)

  // 7. finalize default export
  if (isTS) {
    // for TS, make sure the exported type is still valid type with
    // correct props information
    s.prepend(`import { defineComponent as __define__ } from 'vue'\n`)
    // we have to use object spread for types to be merged properly
    // user's TS setting should compile it down to proper targets
    const def = defaultExport ? `\n  ...${defaultTempVar},` : ``
    const runtimeProps = genRuntimeProps(typeDeclaredProps)
    const runtimeEmits = genRuntimeEmits(typeDeclaredEmits)
    s.append(
      `export default __define__({${def}${runtimeProps}${runtimeEmits}\n  setup\n})`
    )
  } else {
    if (defaultExport) {
      s.append(
        `${defaultTempVar}.setup = setup\nexport default ${defaultTempVar}`
      )
    } else {
      s.append(`export default { setup }`)
    }
  }

  // 8. expose bindings for template compiler optimization
  if (scriptAst) {
    Object.assign(bindings, analyzeScriptBindings(scriptAst))
  }
  Object.keys(setupExports).forEach(key => {
    bindings[key] = 'setup'
  })
  Object.keys(typeDeclaredProps).forEach(key => {
    bindings[key] = 'props'
  })
  Object.assign(bindings, analyzeScriptBindings(scriptSetupAst))

  s.trim()
  return {
    ...scriptSetup,
    bindings,
    content: s.toString(),
    map: (s.generateMap({
      source: filename,
      hires: true,
      includeContent: true
    }) as unknown) as RawSourceMap,
    scriptAst,
    scriptSetupAst
  }
}

function walkDeclaration(node: Declaration, bindings: Record<string, boolean>) {
  if (node.type === 'VariableDeclaration') {
    // export const foo = ...
    for (const { id } of node.declarations) {
      if (id.type === 'Identifier') {
        bindings[id.name] = true
      } else if (id.type === 'ObjectPattern') {
        walkObjectPattern(id, bindings)
      } else if (id.type === 'ArrayPattern') {
        walkArrayPattern(id, bindings)
      }
    }
  } else if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassDeclaration'
  ) {
    // export function foo() {} / export class Foo {}
    // export declarations must be named.
    bindings[node.id!.name] = true
  }
}

function walkObjectPattern(
  node: ObjectPattern,
  bindings: Record<string, boolean>
) {
  for (const p of node.properties) {
    if (p.type === 'ObjectProperty') {
      // key can only be Identifier in ObjectPattern
      if (p.key.type === 'Identifier') {
        if (p.key === p.value) {
          // const { x } = ...
          bindings[p.key.name] = true
        } else {
          walkPattern(p.value, bindings)
        }
      }
    } else {
      // ...rest
      // argument can only be identifer when destructuring
      bindings[(p.argument as Identifier).name] = true
    }
  }
}

function walkArrayPattern(
  node: ArrayPattern,
  bindings: Record<string, boolean>
) {
  for (const e of node.elements) {
    e && walkPattern(e, bindings)
  }
}

function walkPattern(node: Node, bindings: Record<string, boolean>) {
  if (node.type === 'Identifier') {
    bindings[node.name] = true
  } else if (node.type === 'RestElement') {
    // argument can only be identifer when destructuring
    bindings[(node.argument as Identifier).name] = true
  } else if (node.type === 'ObjectPattern') {
    walkObjectPattern(node, bindings)
  } else if (node.type === 'ArrayPattern') {
    walkArrayPattern(node, bindings)
  } else if (node.type === 'AssignmentPattern') {
    if (node.left.type === 'Identifier') {
      bindings[node.left.name] = true
    } else {
      walkPattern(node.left, bindings)
    }
  }
}

interface PropTypeData {
  key: string
  type: string[]
  required: boolean
}

function recordType(node: Node, declaredTypes: Record<string, string[]>) {
  if (node.type === 'TSInterfaceDeclaration') {
    declaredTypes[node.id.name] = [`Object`]
  } else if (node.type === 'TSTypeAliasDeclaration') {
    declaredTypes[node.id.name] = inferRuntimeType(
      node.typeAnnotation,
      declaredTypes
    )
  } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    recordType(node.declaration, declaredTypes)
  }
}

function extractRuntimeProps(
  node: TSTypeLiteral,
  props: Record<string, PropTypeData>,
  declaredTypes: Record<string, string[]>
) {
  for (const m of node.members) {
    if (m.type === 'TSPropertySignature' && m.key.type === 'Identifier') {
      props[m.key.name] = {
        key: m.key.name,
        required: !m.optional,
        type:
          __DEV__ && m.typeAnnotation
            ? inferRuntimeType(m.typeAnnotation.typeAnnotation, declaredTypes)
            : [`null`]
      }
    }
  }
}

function inferRuntimeType(
  node: TSType,
  declaredTypes: Record<string, string[]>
): string[] {
  switch (node.type) {
    case 'TSStringKeyword':
      return ['String']
    case 'TSNumberKeyword':
      return ['Number']
    case 'TSBooleanKeyword':
      return ['Boolean']
    case 'TSObjectKeyword':
      return ['Object']
    case 'TSTypeLiteral':
      // TODO (nice to have) generate runtime property validation
      return ['Object']
    case 'TSFunctionType':
      return ['Function']
    case 'TSArrayType':
    case 'TSTupleType':
      // TODO (nice to have) generate runtime element type/length checks
      return ['Array']

    case 'TSLiteralType':
      switch (node.literal.type) {
        case 'StringLiteral':
          return ['String']
        case 'BooleanLiteral':
          return ['Boolean']
        case 'NumericLiteral':
        case 'BigIntLiteral':
          return ['Number']
        default:
          return [`null`]
      }

    case 'TSTypeReference':
      if (node.typeName.type === 'Identifier') {
        if (declaredTypes[node.typeName.name]) {
          return declaredTypes[node.typeName.name]
        }
        switch (node.typeName.name) {
          case 'Array':
          case 'Function':
          case 'Object':
          case 'Set':
          case 'Map':
          case 'WeakSet':
          case 'WeakMap':
            return [node.typeName.name]
          case 'Record':
          case 'Partial':
          case 'Readonly':
          case 'Pick':
          case 'Omit':
          case 'Exclude':
          case 'Extract':
          case 'Required':
          case 'InstanceType':
            return ['Object']
        }
      }
      return [`null`]

    case 'TSUnionType':
      return [
        ...new Set(
          [].concat(node.types.map(t =>
            inferRuntimeType(t, declaredTypes)
          ) as any)
        )
      ]

    case 'TSIntersectionType':
      return ['Object']

    default:
      return [`null`] // no runtime check
  }
}

function genRuntimeProps(props: Record<string, PropTypeData>) {
  const keys = Object.keys(props)
  if (!keys.length) {
    return ``
  }

  if (!__DEV__) {
    // production: generate array version only
    return `\n  props: [\n    ${keys
      .map(k => JSON.stringify(k))
      .join(',\n    ')}\n  ] as unknown as undefined,`
  }

  return `\n  props: {\n    ${keys
    .map(key => {
      const { type, required } = props[key]
      return `${key}: { type: ${toRuntimeTypeString(
        type
      )}, required: ${required} }`
    })
    .join(',\n    ')}\n  } as unknown as undefined,`
}

function toRuntimeTypeString(types: string[]) {
  return types.some(t => t === 'null')
    ? `null`
    : types.length > 1
      ? `[${types.join(', ')}]`
      : types[0]
}

function extractRuntimeEmits(
  node: TSFunctionType | TSDeclareFunction,
  emits: Set<string>
) {
  const eventName =
    node.type === 'TSDeclareFunction' ? node.params[0] : node.parameters[0]
  if (
    eventName.type === 'Identifier' &&
    eventName.typeAnnotation &&
    eventName.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    const typeNode = eventName.typeAnnotation.typeAnnotation
    if (typeNode.type === 'TSLiteralType') {
      emits.add(String(typeNode.literal.value))
    } else if (typeNode.type === 'TSUnionType') {
      for (const t of typeNode.types) {
        if (t.type === 'TSLiteralType') {
          emits.add(String(t.literal.value))
        }
      }
    }
  }
}

function genRuntimeEmits(emits: Set<string>) {
  return emits.size
    ? `\n  emits: [${Array.from(emits)
        .map(p => JSON.stringify(p))
        .join(', ')}] as unknown as undefined,`
    : ``
}

/**
 * export default {} inside `<script setup>` cannot access variables declared
 * inside since it's hoisted. Walk and check to make sure.
 */
function checkDefaultExport(
  root: Node,
  scopeVars: Record<string, boolean>,
  imports: Record<string, string>,
  exports: Record<string, boolean>,
  source: string,
  offset: number
) {
  const knownIds: Record<string, number> = Object.create(null)
  ;(walk as any)(root, {
    enter(node: Node & { scopeIds?: Set<string> }, parent: Node) {
      if (node.type === 'Identifier') {
        if (
          !knownIds[node.name] &&
          !isStaticPropertyKey(node, parent) &&
          (scopeVars[node.name] || (!imports[node.name] && exports[node.name]))
        ) {
          throw new Error(
            `\`export default\` in <script setup> cannot reference locally ` +
              `declared variables because it will be hoisted outside of the ` +
              `setup() function. If your component options requires initialization ` +
              `in the module scope, use a separate normal <script> to export ` +
              `the options instead.\n\n` +
              generateCodeFrame(
                source,
                node.start! + offset,
                node.end! + offset
              )
          )
        }
      } else if (isFunction(node)) {
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
        node.params.forEach(p =>
          (walk as any)(p, {
            enter(child: Node, parent: Node) {
              if (
                child.type === 'Identifier' &&
                // do not record as scope variable if is a destructured key
                !isStaticPropertyKey(child, parent) &&
                // do not record if this is a default value
                // assignment of a destructured variable
                !(
                  parent &&
                  parent.type === 'AssignmentPattern' &&
                  parent.right === child
                )
              ) {
                const { name } = child
                if (node.scopeIds && node.scopeIds.has(name)) {
                  return
                }
                if (name in knownIds) {
                  knownIds[name]++
                } else {
                  knownIds[name] = 1
                }
                ;(node.scopeIds || (node.scopeIds = new Set())).add(name)
              }
            }
          })
        )
      }
    },
    leave(node: Node & { scopeIds?: Set<string> }) {
      if (node.scopeIds) {
        node.scopeIds.forEach((id: string) => {
          knownIds[id]--
          if (knownIds[id] === 0) {
            delete knownIds[id]
          }
        })
      }
    }
  })
}

function isStaticPropertyKey(node: Node, parent: Node): boolean {
  return (
    parent &&
    (parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod') &&
    !parent.computed &&
    parent.key === node
  )
}

function isFunction(node: Node): node is FunctionNode {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}

function getObjectExpressionKeys(node: ObjectExpression): string[] {
  const keys = []
  for (const prop of node.properties) {
    if (
      (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') &&
      !prop.computed
    ) {
      if (prop.key.type === 'Identifier') {
        keys.push(prop.key.name)
      } else if (prop.key.type === 'StringLiteral') {
        keys.push(prop.key.value)
      }
    }
  }
  return keys
}

function getArrayExpressionKeys(node: ArrayExpression): string[] {
  const keys = []
  for (const element of node.elements) {
    if (element && element.type === 'StringLiteral') {
      keys.push(element.value)
    }
  }
  return keys
}

function getObjectOrArrayExpressionKeys(property: ObjectProperty): string[] {
  if (property.value.type === 'ArrayExpression') {
    return getArrayExpressionKeys(property.value)
  }
  if (property.value.type === 'ObjectExpression') {
    return getObjectExpressionKeys(property.value)
  }
  return []
}

/**
 * Analyze bindings in normal `<script>`
 * Note that `compileScriptSetup` already analyzes bindings as part of its
 * compilation process so this should only be used on single `<script>` SFCs.
 */
function analyzeScriptBindings(ast: Statement[]): BindingMetadata {
  const bindings: BindingMetadata = {}

  for (const node of ast) {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      for (const property of node.declaration.properties) {
        if (
          property.type === 'ObjectProperty' &&
          !property.computed &&
          property.key.type === 'Identifier'
        ) {
          // props
          if (property.key.name === 'props') {
            // props: ['foo']
            // props: { foo: ... }
            for (const key of getObjectOrArrayExpressionKeys(property)) {
              bindings[key] = 'props'
            }
          }

          // inject
          else if (property.key.name === 'inject') {
            // inject: ['foo']
            // inject: { foo: {} }
            for (const key of getObjectOrArrayExpressionKeys(property)) {
              bindings[key] = 'options'
            }
          }

          // computed & methods
          else if (
            property.value.type === 'ObjectExpression' &&
            (property.key.name === 'computed' ||
              property.key.name === 'methods')
          ) {
            // methods: { foo() {} }
            // computed: { foo() {} }
            for (const key of getObjectExpressionKeys(property.value)) {
              bindings[key] = 'options'
            }
          }
        }

        // setup & data
        else if (
          property.type === 'ObjectMethod' &&
          property.key.type === 'Identifier' &&
          (property.key.name === 'setup' || property.key.name === 'data')
        ) {
          for (const bodyItem of property.body.body) {
            // setup() {
            //   return {
            //     foo: null
            //   }
            // }
            if (
              bodyItem.type === 'ReturnStatement' &&
              bodyItem.argument &&
              bodyItem.argument.type === 'ObjectExpression'
            ) {
              for (const key of getObjectExpressionKeys(bodyItem.argument)) {
                bindings[key] = property.key.name
              }
            }
          }
        }
      }
    }
  }

  return bindings
}
