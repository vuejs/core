import {
  Expression,
  Identifier,
  Node,
  Statement,
  TSCallSignatureDeclaration,
  TSEnumDeclaration,
  TSExpressionWithTypeArguments,
  TSFunctionType,
  TSIndexedAccessType,
  TSInterfaceDeclaration,
  TSMappedType,
  TSMethodSignature,
  TSModuleBlock,
  TSModuleDeclaration,
  TSPropertySignature,
  TSQualifiedName,
  TSType,
  TSTypeAnnotation,
  TSTypeElement,
  TSTypeReference,
  TemplateLiteral
} from '@babel/types'
import {
  UNKNOWN_TYPE,
  createGetCanonicalFileName,
  getId,
  getImportedName,
  normalizePath
} from './utils'
import { ScriptCompileContext, resolveParserPlugins } from './context'
import { ImportBinding, SFCScriptCompileOptions } from '../compileScript'
import { capitalize, hasOwn } from '@vue/shared'
import { parse as babelParse } from '@babel/parser'
import { parse } from '../parse'
import { createCache } from '../cache'
import type TS from 'typescript'
import path from 'path'

/**
 * TypeResolveContext is compatible with ScriptCompileContext
 * but also allows a simpler version of it with minimal required properties
 * when resolveType needs to be used in a non-SFC context, e.g. in a babel
 * plugin. The simplest context can be just:
 * ```ts
 * const ctx: SimpleTypeResolveContext = {
 *   filename: '...',
 *   source: '...',
 *   options: {},
 *   error() {},
 *   ast: []
 * }
 * ```
 */
export type SimpleTypeResolveContext = Pick<
  ScriptCompileContext,
  // required
  'source' | 'filename' | 'error' | 'options'
> &
  Partial<Pick<ScriptCompileContext, 'scope' | 'globalScopes' | 'deps'>> & {
    ast: Statement[]
  }

export type TypeResolveContext = ScriptCompileContext | SimpleTypeResolveContext

type Import = Pick<ImportBinding, 'source' | 'imported'>

type ScopeTypeNode = Node & {
  // scope types always has ownerScope attached
  _ownerScope: TypeScope
}

export interface TypeScope {
  filename: string
  source: string
  offset: number
  imports: Record<string, Import>
  types: Record<string, ScopeTypeNode>
  exportedTypes: Record<string, ScopeTypeNode>
}

export interface WithScope {
  _ownerScope?: TypeScope
}

interface ResolvedElements {
  props: Record<
    string,
    (TSPropertySignature | TSMethodSignature) & {
      // resolved props always has ownerScope attached
      _ownerScope: TypeScope
    }
  >
  calls?: (TSCallSignatureDeclaration | TSFunctionType)[]
}

/**
 * Resolve arbitrary type node to a list of type elements that can be then
 * mapped to runtime props or emits.
 */
export function resolveTypeElements(
  ctx: TypeResolveContext,
  node: Node & WithScope & { _resolvedElements?: ResolvedElements },
  scope?: TypeScope
): ResolvedElements {
  if (node._resolvedElements) {
    return node._resolvedElements
  }
  return (node._resolvedElements = innerResolveTypeElements(
    ctx,
    node,
    node._ownerScope || scope || ctxToScope(ctx)
  ))
}

function innerResolveTypeElements(
  ctx: TypeResolveContext,
  node: Node,
  scope: TypeScope
): ResolvedElements {
  switch (node.type) {
    case 'TSTypeLiteral':
      return typeElementsToMap(ctx, node.members, scope)
    case 'TSInterfaceDeclaration':
      return resolveInterfaceMembers(ctx, node, scope)
    case 'TSTypeAliasDeclaration':
    case 'TSParenthesizedType':
      return resolveTypeElements(ctx, node.typeAnnotation, scope)
    case 'TSFunctionType': {
      return { props: {}, calls: [node] }
    }
    case 'TSUnionType':
    case 'TSIntersectionType':
      return mergeElements(
        node.types.map(t => resolveTypeElements(ctx, t, scope)),
        node.type
      )
    case 'TSMappedType':
      return resolveMappedType(ctx, node, scope)
    case 'TSIndexedAccessType': {
      const types = resolveIndexType(ctx, node, scope)
      return mergeElements(
        types.map(t => resolveTypeElements(ctx, t, t._ownerScope)),
        'TSUnionType'
      )
    }
    case 'TSExpressionWithTypeArguments': // referenced by interface extends
    case 'TSTypeReference': {
      const resolved = resolveTypeReference(ctx, node, scope)
      if (resolved) {
        return resolveTypeElements(ctx, resolved, resolved._ownerScope)
      } else {
        const typeName = getReferenceName(node)
        if (
          typeof typeName === 'string' &&
          // @ts-ignore
          SupportedBuiltinsSet.has(typeName)
        ) {
          return resolveBuiltin(ctx, node, typeName as any, scope)
        }
        return ctx.error(
          `Unresolvable type reference or unsupported built-in utlility type`,
          node,
          scope
        )
      }
    }
  }
  return ctx.error(`Unresolvable type: ${node.type}`, node, scope)
}

function typeElementsToMap(
  ctx: TypeResolveContext,
  elements: TSTypeElement[],
  scope = ctxToScope(ctx)
): ResolvedElements {
  const res: ResolvedElements = { props: {} }
  for (const e of elements) {
    if (e.type === 'TSPropertySignature' || e.type === 'TSMethodSignature') {
      ;(e as WithScope)._ownerScope = scope
      const name = getId(e.key)
      if (name && !e.computed) {
        res.props[name] = e as ResolvedElements['props'][string]
      } else if (e.key.type === 'TemplateLiteral') {
        for (const key of resolveTemplateKeys(ctx, e.key, scope)) {
          res.props[key] = e as ResolvedElements['props'][string]
        }
      } else {
        ctx.error(
          `Unsupported computed key in type referenced by a macro`,
          e.key,
          scope
        )
      }
    } else if (e.type === 'TSCallSignatureDeclaration') {
      ;(res.calls || (res.calls = [])).push(e)
    }
  }
  return res
}

function mergeElements(
  maps: ResolvedElements[],
  type: 'TSUnionType' | 'TSIntersectionType'
): ResolvedElements {
  if (maps.length === 1) return maps[0]
  const res: ResolvedElements = { props: {} }
  const { props: baseProps } = res
  for (const { props, calls } of maps) {
    for (const key in props) {
      if (!hasOwn(baseProps, key)) {
        baseProps[key] = props[key]
      } else {
        baseProps[key] = createProperty(
          baseProps[key].key,
          {
            type,
            // @ts-ignore
            types: [baseProps[key], props[key]]
          },
          baseProps[key]._ownerScope
        )
      }
    }
    if (calls) {
      ;(res.calls || (res.calls = [])).push(...calls)
    }
  }
  return res
}

function createProperty(
  key: Expression,
  typeAnnotation: TSType,
  scope: TypeScope
): TSPropertySignature & { _ownerScope: TypeScope } {
  return {
    type: 'TSPropertySignature',
    key,
    kind: 'get',
    typeAnnotation: {
      type: 'TSTypeAnnotation',
      typeAnnotation
    },
    _ownerScope: scope
  }
}

function resolveInterfaceMembers(
  ctx: TypeResolveContext,
  node: TSInterfaceDeclaration & WithScope,
  scope: TypeScope
): ResolvedElements {
  const base = typeElementsToMap(ctx, node.body.body, node._ownerScope)
  if (node.extends) {
    for (const ext of node.extends) {
      const { props } = resolveTypeElements(ctx, ext, scope)
      for (const key in props) {
        if (!hasOwn(base.props, key)) {
          base.props[key] = props[key]
        }
      }
    }
  }
  return base
}

function resolveMappedType(
  ctx: TypeResolveContext,
  node: TSMappedType,
  scope: TypeScope
): ResolvedElements {
  const res: ResolvedElements = { props: {} }
  const keys = resolveStringType(ctx, node.typeParameter.constraint!, scope)
  for (const key of keys) {
    res.props[key] = createProperty(
      {
        type: 'Identifier',
        name: key
      },
      node.typeAnnotation!,
      scope
    )
  }
  return res
}

function resolveIndexType(
  ctx: TypeResolveContext,
  node: TSIndexedAccessType,
  scope: TypeScope
): (TSType & WithScope)[] {
  if (node.indexType.type === 'TSNumberKeyword') {
    return resolveArrayElementType(ctx, node.objectType, scope)
  }

  const { indexType, objectType } = node
  const types: TSType[] = []
  let keys: string[]
  let resolved: ResolvedElements
  if (indexType.type === 'TSStringKeyword') {
    resolved = resolveTypeElements(ctx, objectType, scope)
    keys = Object.keys(resolved.props)
  } else {
    keys = resolveStringType(ctx, indexType, scope)
    resolved = resolveTypeElements(ctx, objectType, scope)
  }
  for (const key of keys) {
    const targetType = resolved.props[key]?.typeAnnotation?.typeAnnotation
    if (targetType) {
      ;(targetType as TSType & WithScope)._ownerScope =
        resolved.props[key]._ownerScope
      types.push(targetType)
    }
  }
  return types
}

function resolveArrayElementType(
  ctx: TypeResolveContext,
  node: Node,
  scope: TypeScope
): TSType[] {
  // type[]
  if (node.type === 'TSArrayType') {
    return [node.elementType]
  }
  // tuple
  if (node.type === 'TSTupleType') {
    return node.elementTypes.map(t =>
      t.type === 'TSNamedTupleMember' ? t.elementType : t
    )
  }
  if (node.type === 'TSTypeReference') {
    // Array<type>
    if (getReferenceName(node) === 'Array' && node.typeParameters) {
      return node.typeParameters.params
    } else {
      const resolved = resolveTypeReference(ctx, node, scope)
      if (resolved) {
        return resolveArrayElementType(ctx, resolved, scope)
      }
    }
  }
  return ctx.error(
    'Failed to resolve element type from target type',
    node,
    scope
  )
}

function resolveStringType(
  ctx: TypeResolveContext,
  node: Node,
  scope: TypeScope
): string[] {
  switch (node.type) {
    case 'StringLiteral':
      return [node.value]
    case 'TSLiteralType':
      return resolveStringType(ctx, node.literal, scope)
    case 'TSUnionType':
      return node.types.map(t => resolveStringType(ctx, t, scope)).flat()
    case 'TemplateLiteral': {
      return resolveTemplateKeys(ctx, node, scope)
    }
    case 'TSTypeReference': {
      const resolved = resolveTypeReference(ctx, node, scope)
      if (resolved) {
        return resolveStringType(ctx, resolved, scope)
      }
      if (node.typeName.type === 'Identifier') {
        const getParam = (index = 0) =>
          resolveStringType(ctx, node.typeParameters!.params[index], scope)
        switch (node.typeName.name) {
          case 'Extract':
            return getParam(1)
          case 'Exclude': {
            const excluded = getParam(1)
            return getParam().filter(s => !excluded.includes(s))
          }
          case 'Uppercase':
            return getParam().map(s => s.toUpperCase())
          case 'Lowercase':
            return getParam().map(s => s.toLowerCase())
          case 'Capitalize':
            return getParam().map(capitalize)
          case 'Uncapitalize':
            return getParam().map(s => s[0].toLowerCase() + s.slice(1))
          default:
            ctx.error(
              'Unsupported type when resolving index type',
              node.typeName,
              scope
            )
        }
      }
    }
  }
  return ctx.error('Failed to resolve index type into finite keys', node, scope)
}

function resolveTemplateKeys(
  ctx: TypeResolveContext,
  node: TemplateLiteral,
  scope: TypeScope
): string[] {
  if (!node.expressions.length) {
    return [node.quasis[0].value.raw]
  }

  const res: string[] = []
  const e = node.expressions[0]
  const q = node.quasis[0]
  const leading = q ? q.value.raw : ``
  const resolved = resolveStringType(ctx, e, scope)
  const restResolved = resolveTemplateKeys(
    ctx,
    {
      ...node,
      expressions: node.expressions.slice(1),
      quasis: q ? node.quasis.slice(1) : node.quasis
    },
    scope
  )

  for (const r of resolved) {
    for (const rr of restResolved) {
      res.push(leading + r + rr)
    }
  }

  return res
}

const SupportedBuiltinsSet = new Set([
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit'
] as const)

type GetSetType<T> = T extends Set<infer V> ? V : never

function resolveBuiltin(
  ctx: TypeResolveContext,
  node: TSTypeReference | TSExpressionWithTypeArguments,
  name: GetSetType<typeof SupportedBuiltinsSet>,
  scope: TypeScope
): ResolvedElements {
  const t = resolveTypeElements(ctx, node.typeParameters!.params[0])
  switch (name) {
    case 'Partial':
    case 'Required':
    case 'Readonly':
      return t
    case 'Pick': {
      const picked = resolveStringType(
        ctx,
        node.typeParameters!.params[1],
        scope
      )
      const res: ResolvedElements = { props: {}, calls: t.calls }
      for (const key of picked) {
        res.props[key] = t.props[key]
      }
      return res
    }
    case 'Omit':
      const omitted = resolveStringType(
        ctx,
        node.typeParameters!.params[1],
        scope
      )
      const res: ResolvedElements = { props: {}, calls: t.calls }
      for (const key in t.props) {
        if (!omitted.includes(key)) {
          res.props[key] = t.props[key]
        }
      }
      return res
  }
}

function resolveTypeReference(
  ctx: TypeResolveContext,
  node: (TSTypeReference | TSExpressionWithTypeArguments) & {
    _resolvedReference?: ScopeTypeNode
  },
  scope?: TypeScope,
  name?: string,
  onlyExported = false
): ScopeTypeNode | undefined {
  if (node._resolvedReference) {
    return node._resolvedReference
  }
  return (node._resolvedReference = innerResolveTypeReference(
    ctx,
    scope || ctxToScope(ctx),
    name || getReferenceName(node),
    node,
    onlyExported
  ))
}

function innerResolveTypeReference(
  ctx: TypeResolveContext,
  scope: TypeScope,
  name: string | string[],
  node: TSTypeReference | TSExpressionWithTypeArguments,
  onlyExported: boolean
): ScopeTypeNode | undefined {
  if (typeof name === 'string') {
    if (scope.imports[name]) {
      return resolveTypeFromImport(ctx, node, name, scope)
    } else {
      const types = onlyExported ? scope.exportedTypes : scope.types
      if (types[name]) {
        return types[name]
      } else {
        // fallback to global
        const globalScopes = resolveGlobalScope(ctx)
        if (globalScopes) {
          for (const s of globalScopes) {
            if (s.types[name]) {
              ;(ctx.deps || (ctx.deps = new Set())).add(s.filename)
              return s.types[name]
            }
          }
        }
      }
    }
  } else {
    const ns = innerResolveTypeReference(
      ctx,
      scope,
      name[0],
      node,
      onlyExported
    )
    if (ns && ns.type === 'TSModuleDeclaration') {
      const childScope = moduleDeclToScope(ns, scope)
      return innerResolveTypeReference(
        ctx,
        childScope,
        name.length > 2 ? name.slice(1) : name[name.length - 1],
        node,
        !ns.declare
      )
    }
  }
}

function getReferenceName(
  node: TSTypeReference | TSExpressionWithTypeArguments
): string | string[] {
  const ref = node.type === 'TSTypeReference' ? node.typeName : node.expression
  if (ref.type === 'Identifier') {
    return ref.name
  } else {
    return qualifiedNameToPath(ref)
  }
}

function qualifiedNameToPath(node: Identifier | TSQualifiedName): string[] {
  if (node.type === 'Identifier') {
    return [node.name]
  } else {
    return [...qualifiedNameToPath(node.left), node.right.name]
  }
}

function resolveGlobalScope(ctx: TypeResolveContext): TypeScope[] | undefined {
  if (ctx.options.globalTypeFiles) {
    const fs: FS = ctx.options.fs || ts?.sys
    if (!fs) {
      throw new Error('[vue/compiler-sfc] globalTypeFiles requires fs access.')
    }
    return ctx.options.globalTypeFiles.map(file =>
      fileToScope(normalizePath(file), fs, ctx.options.babelParserPlugins, true)
    )
  }
}

let ts: typeof TS

/**
 * @private
 */
export function registerTS(_ts: any) {
  ts = _ts
}

type FS = NonNullable<SFCScriptCompileOptions['fs']>

function resolveTypeFromImport(
  ctx: TypeResolveContext,
  node: TSTypeReference | TSExpressionWithTypeArguments,
  name: string,
  scope: TypeScope
): ScopeTypeNode | undefined {
  const fs: FS = ctx.options.fs || ts?.sys
  if (!fs) {
    ctx.error(
      `No fs option provided to \`compileScript\` in non-Node environment. ` +
        `File system access is required for resolving imported types.`,
      node
    )
  }

  const containingFile = scope.filename
  const { source, imported } = scope.imports[name]

  let resolved: string | undefined

  if (source.startsWith('.')) {
    // relative import - fast path
    const filename = path.join(containingFile, '..', source)
    resolved = resolveExt(filename, fs)
  } else {
    // module or aliased import - use full TS resolution, only supported in Node
    if (!__NODE_JS__) {
      ctx.error(
        `Type import from non-relative sources is not supported in the browser build.`,
        node,
        scope
      )
    }
    if (!ts) {
      ctx.error(
        `Failed to resolve type ${imported} from module ${JSON.stringify(
          source
        )}. ` +
          `typescript is required as a peer dep for vue in order ` +
          `to support resolving types from module imports.`,
        node,
        scope
      )
    }
    resolved = resolveWithTS(containingFile, source, fs)
  }

  if (resolved) {
    resolved = normalizePath(resolved)

    // (hmr) register dependency file on ctx
    ;(ctx.deps || (ctx.deps = new Set())).add(resolved)

    return resolveTypeReference(
      ctx,
      node,
      fileToScope(resolved, fs, ctx.options.babelParserPlugins),
      imported,
      true
    )
  } else {
    ctx.error(
      `Failed to resolve import source ${JSON.stringify(
        source
      )} for type ${name}`,
      node,
      scope
    )
  }
}

function resolveExt(filename: string, fs: FS) {
  const tryResolve = (filename: string) => {
    if (fs.fileExists(filename)) return filename
  }
  return (
    tryResolve(filename) ||
    tryResolve(filename + `.ts`) ||
    tryResolve(filename + `.d.ts`) ||
    tryResolve(filename + `/index.ts`) ||
    tryResolve(filename + `/index.d.ts`)
  )
}

const tsConfigCache = createCache<{
  options: TS.CompilerOptions
  cache: TS.ModuleResolutionCache
}>()

function resolveWithTS(
  containingFile: string,
  source: string,
  fs: FS
): string | undefined {
  if (!__NODE_JS__) return

  // 1. resolve tsconfig.json
  const configPath = ts.findConfigFile(containingFile, fs.fileExists)
  // 2. load tsconfig.json
  let options: TS.CompilerOptions
  let cache: TS.ModuleResolutionCache | undefined
  if (configPath) {
    const normalizedConfigPath = normalizePath(configPath)
    const cached = tsConfigCache.get(normalizedConfigPath)
    if (!cached) {
      // The only case where `fs` is NOT `ts.sys` is during tests.
      // parse config host requires an extra `readDirectory` method
      // during tests, which is stubbed.
      const parseConfigHost = __TEST__
        ? {
            ...fs,
            useCaseSensitiveFileNames: true,
            readDirectory: () => []
          }
        : ts.sys
      const parsed = ts.parseJsonConfigFileContent(
        ts.readConfigFile(configPath, fs.readFile).config,
        parseConfigHost,
        path.dirname(configPath),
        undefined,
        configPath
      )
      options = parsed.options
      cache = ts.createModuleResolutionCache(
        process.cwd(),
        createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames),
        options
      )
      tsConfigCache.set(normalizedConfigPath, { options, cache })
    } else {
      ;({ options, cache } = cached)
    }
  } else {
    options = {}
  }

  // 3. resolve
  const res = ts.resolveModuleName(source, containingFile, options, fs, cache)

  if (res.resolvedModule) {
    return res.resolvedModule.resolvedFileName
  }
}

const fileToScopeCache = createCache<TypeScope>()

/**
 * @private
 */
export function invalidateTypeCache(filename: string) {
  filename = normalizePath(filename)
  fileToScopeCache.delete(filename)
  tsConfigCache.delete(filename)
}

export function fileToScope(
  filename: string,
  fs: FS,
  parserPlugins: SFCScriptCompileOptions['babelParserPlugins'],
  asGlobal = false
): TypeScope {
  const cached = fileToScopeCache.get(filename)
  if (cached) {
    return cached
  }

  const source = fs.readFile(filename) || ''
  const body = parseFile(filename, source, parserPlugins)
  const scope: TypeScope = {
    filename,
    source,
    offset: 0,
    imports: recordImports(body),
    types: Object.create(null),
    exportedTypes: Object.create(null)
  }
  recordTypes(body, scope, asGlobal)

  fileToScopeCache.set(filename, scope)
  return scope
}

function parseFile(
  filename: string,
  content: string,
  parserPlugins?: SFCScriptCompileOptions['babelParserPlugins']
): Statement[] {
  const ext = path.extname(filename)
  if (ext === '.ts' || ext === '.tsx') {
    return babelParse(content, {
      plugins: resolveParserPlugins(ext.slice(1), parserPlugins),
      sourceType: 'module'
    }).program.body
  } else if (ext === '.vue') {
    const {
      descriptor: { script, scriptSetup }
    } = parse(content)
    if (!script && !scriptSetup) {
      return []
    }

    // ensure the correct offset with original source
    const scriptOffset = script ? script.loc.start.offset : Infinity
    const scriptSetupOffset = scriptSetup
      ? scriptSetup.loc.start.offset
      : Infinity
    const firstBlock = scriptOffset < scriptSetupOffset ? script : scriptSetup
    const secondBlock = scriptOffset < scriptSetupOffset ? scriptSetup : script

    let scriptContent =
      ' '.repeat(Math.min(scriptOffset, scriptSetupOffset)) +
      firstBlock!.content
    if (secondBlock) {
      scriptContent +=
        ' '.repeat(secondBlock.loc.start.offset - script!.loc.end.offset) +
        secondBlock.content
    }
    const lang = script?.lang || scriptSetup?.lang
    return babelParse(scriptContent, {
      plugins: resolveParserPlugins(lang!, parserPlugins),
      sourceType: 'module'
    }).program.body
  }
  return []
}

function ctxToScope(ctx: TypeResolveContext): TypeScope {
  if (ctx.scope) {
    return ctx.scope
  }

  const body =
    'ast' in ctx
      ? ctx.ast
      : ctx.scriptAst
      ? [...ctx.scriptAst.body, ...ctx.scriptSetupAst!.body]
      : ctx.scriptSetupAst!.body

  const scope: TypeScope = {
    filename: ctx.filename,
    source: ctx.source,
    offset: 'startOffset' in ctx ? ctx.startOffset! : 0,
    imports:
      'userImports' in ctx
        ? Object.create(ctx.userImports)
        : recordImports(body),
    types: Object.create(null),
    exportedTypes: Object.create(null)
  }

  recordTypes(body, scope)

  return (ctx.scope = scope)
}

function moduleDeclToScope(
  node: TSModuleDeclaration & { _resolvedChildScope?: TypeScope },
  parentScope: TypeScope
): TypeScope {
  if (node._resolvedChildScope) {
    return node._resolvedChildScope
  }
  const scope: TypeScope = {
    ...parentScope,
    types: Object.create(parentScope.types),
    imports: Object.create(parentScope.imports)
  }
  recordTypes((node.body as TSModuleBlock).body, scope)
  return (node._resolvedChildScope = scope)
}

const importExportRE = /^Import|^Export/

function recordTypes(body: Statement[], scope: TypeScope, asGlobal = false) {
  const { types, exportedTypes, imports } = scope
  const isAmbient = asGlobal
    ? !body.some(s => importExportRE.test(s.type))
    : false
  for (const stmt of body) {
    if (asGlobal) {
      if (isAmbient) {
        if ((stmt as any).declare) {
          recordType(stmt, types)
        }
      } else if (stmt.type === 'TSModuleDeclaration' && stmt.global) {
        for (const s of (stmt.body as TSModuleBlock).body) {
          recordType(s, types)
        }
      }
    } else {
      recordType(stmt, types)
    }
  }
  if (!asGlobal) {
    for (const stmt of body) {
      if (stmt.type === 'ExportNamedDeclaration') {
        if (stmt.declaration) {
          recordType(stmt.declaration, types)
          recordType(stmt.declaration, exportedTypes)
        } else {
          for (const spec of stmt.specifiers) {
            if (spec.type === 'ExportSpecifier') {
              const local = spec.local.name
              const exported = getId(spec.exported)
              if (stmt.source) {
                // re-export, register an import + export as a type reference
                imports[local] = {
                  source: stmt.source.value,
                  imported: local
                }
                exportedTypes[exported] = {
                  type: 'TSTypeReference',
                  typeName: {
                    type: 'Identifier',
                    name: local
                  },
                  _ownerScope: scope
                }
              } else if (types[local]) {
                // exporting local defined type
                exportedTypes[exported] = types[local]
              }
            }
          }
        }
      }
    }
  }
  for (const key of Object.keys(types)) {
    types[key]._ownerScope = scope
  }
}

function recordType(node: Node, types: Record<string, Node>) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
    case 'TSEnumDeclaration':
    case 'TSModuleDeclaration':
    case 'ClassDeclaration': {
      const id = node.id.type === 'Identifier' ? node.id.name : node.id.value
      types[id] = node
      break
    }
    case 'TSTypeAliasDeclaration':
      types[node.id.name] = node.typeAnnotation
      break
    case 'VariableDeclaration': {
      if (node.declare) {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier' && decl.id.typeAnnotation) {
            types[decl.id.name] = (
              decl.id.typeAnnotation as TSTypeAnnotation
            ).typeAnnotation
          }
        }
      }
      break
    }
  }
}

export function recordImports(body: Statement[]) {
  const imports: TypeScope['imports'] = Object.create(null)
  for (const s of body) {
    recordImport(s, imports)
  }
  return imports
}

function recordImport(node: Node, imports: TypeScope['imports']) {
  if (node.type !== 'ImportDeclaration') {
    return
  }
  for (const s of node.specifiers) {
    imports[s.local.name] = {
      imported: getImportedName(s),
      source: node.source.value
    }
  }
}

export function inferRuntimeType(
  ctx: TypeResolveContext,
  node: Node & WithScope,
  scope = node._ownerScope || ctxToScope(ctx)
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
    case 'TSNullKeyword':
      return ['null']
    case 'TSTypeLiteral':
    case 'TSInterfaceDeclaration': {
      // TODO (nice to have) generate runtime property validation
      const types = new Set<string>()
      const members =
        node.type === 'TSTypeLiteral' ? node.members : node.body.body
      for (const m of members) {
        if (
          m.type === 'TSCallSignatureDeclaration' ||
          m.type === 'TSConstructSignatureDeclaration'
        ) {
          types.add('Function')
        } else {
          types.add('Object')
        }
      }
      return types.size ? Array.from(types) : ['Object']
    }
    case 'TSPropertySignature':
      if (node.typeAnnotation) {
        return inferRuntimeType(ctx, node.typeAnnotation.typeAnnotation, scope)
      }
    case 'TSMethodSignature':
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
          return [UNKNOWN_TYPE]
      }

    case 'TSTypeReference':
      if (node.typeName.type === 'Identifier') {
        const resolved = resolveTypeReference(ctx, node, scope)
        if (resolved) {
          return inferRuntimeType(ctx, resolved, resolved._ownerScope)
        }
        switch (node.typeName.name) {
          case 'Array':
          case 'Function':
          case 'Object':
          case 'Set':
          case 'Map':
          case 'WeakSet':
          case 'WeakMap':
          case 'Date':
          case 'Promise':
            return [node.typeName.name]

          // TS built-in utility types
          // https://www.typescriptlang.org/docs/handbook/utility-types.html
          case 'Partial':
          case 'Required':
          case 'Readonly':
          case 'Record':
          case 'Pick':
          case 'Omit':
          case 'InstanceType':
            return ['Object']

          case 'Uppercase':
          case 'Lowercase':
          case 'Capitalize':
          case 'Uncapitalize':
            return ['String']

          case 'Parameters':
          case 'ConstructorParameters':
            return ['Array']

          case 'NonNullable':
            if (node.typeParameters && node.typeParameters.params[0]) {
              return inferRuntimeType(
                ctx,
                node.typeParameters.params[0],
                scope
              ).filter(t => t !== 'null')
            }
            break
          case 'Extract':
            if (node.typeParameters && node.typeParameters.params[1]) {
              return inferRuntimeType(ctx, node.typeParameters.params[1], scope)
            }
            break
          case 'Exclude':
          case 'OmitThisParameter':
            if (node.typeParameters && node.typeParameters.params[0]) {
              return inferRuntimeType(ctx, node.typeParameters.params[0], scope)
            }
            break
        }
      }
      // cannot infer, fallback to UNKNOWN: ThisParameterType
      return [UNKNOWN_TYPE]

    case 'TSParenthesizedType':
      return inferRuntimeType(ctx, node.typeAnnotation, scope)

    case 'TSUnionType':
      return flattenTypes(ctx, node.types, scope)
    case 'TSIntersectionType': {
      return flattenTypes(ctx, node.types, scope).filter(
        t => t !== UNKNOWN_TYPE
      )
    }

    case 'TSEnumDeclaration':
      return inferEnumType(node)

    case 'TSSymbolKeyword':
      return ['Symbol']

    case 'TSIndexedAccessType': {
      try {
        const types = resolveIndexType(ctx, node, scope)
        return flattenTypes(ctx, types, scope)
      } catch (e) {
        // avoid hard error, fallback to unknown
        return [UNKNOWN_TYPE]
      }
    }

    case 'ClassDeclaration':
      return ['Object']

    default:
      return [UNKNOWN_TYPE] // no runtime check
  }
}

function flattenTypes(
  ctx: TypeResolveContext,
  types: TSType[],
  scope: TypeScope
): string[] {
  if (types.length === 1) {
    return inferRuntimeType(ctx, types[0], scope)
  }
  return [
    ...new Set(
      ([] as string[]).concat(
        ...types.map(t => inferRuntimeType(ctx, t, scope))
      )
    )
  ]
}

function inferEnumType(node: TSEnumDeclaration): string[] {
  const types = new Set<string>()
  for (const m of node.members) {
    if (m.initializer) {
      switch (m.initializer.type) {
        case 'StringLiteral':
          types.add('String')
          break
        case 'NumericLiteral':
          types.add('Number')
          break
      }
    }
  }
  return types.size ? [...types] : ['Number']
}
