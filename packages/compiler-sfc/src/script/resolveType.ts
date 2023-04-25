import {
  Expression,
  Identifier,
  Node,
  Statement,
  TSCallSignatureDeclaration,
  TSEnumDeclaration,
  TSExpressionWithTypeArguments,
  TSFunctionType,
  TSImportType,
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
  TSTypeLiteral,
  TSTypeQuery,
  TSTypeReference,
  TemplateLiteral
} from '@babel/types'
import {
  UNKNOWN_TYPE,
  createGetCanonicalFileName,
  getId,
  getImportedName,
  normalizePath,
  joinPaths
} from './utils'
import { ScriptCompileContext, resolveParserPlugins } from './context'
import { ImportBinding, SFCScriptCompileOptions } from '../compileScript'
import { capitalize, hasOwn } from '@vue/shared'
import { parse as babelParse } from '@babel/parser'
import { parse } from '../parse'
import { createCache } from '../cache'
import type TS from 'typescript'
import { extname, dirname } from 'path'
import { minimatch as isMatch } from 'minimatch'

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

interface WithScope {
  _ownerScope: TypeScope
}

// scope types always has ownerScope attached
type ScopeTypeNode = Node &
  WithScope & { _ns?: TSModuleDeclaration & WithScope }

export class TypeScope {
  constructor(
    public filename: string,
    public source: string,
    public offset: number = 0,
    public imports: Record<string, Import> = Object.create(null),
    public types: Record<string, ScopeTypeNode> = Object.create(null),
    public declares: Record<string, ScopeTypeNode> = Object.create(null)
  ) {}

  resolvedImportSources: Record<string, string> = Object.create(null)
  exportedTypes: Record<string, ScopeTypeNode> = Object.create(null)
  exportedDeclares: Record<string, ScopeTypeNode> = Object.create(null)
}

export interface MaybeWithScope {
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
  node: Node & MaybeWithScope & { _resolvedElements?: ResolvedElements },
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
      const typeName = getReferenceName(node)
      if (
        typeName === 'ExtractPropTypes' &&
        node.typeParameters &&
        scope.imports[typeName]?.source === 'vue'
      ) {
        return resolveExtractPropTypes(
          resolveTypeElements(ctx, node.typeParameters.params[0], scope),
          scope
        )
      }
      const resolved = resolveTypeReference(ctx, node, scope)
      if (resolved) {
        return resolveTypeElements(ctx, resolved, resolved._ownerScope)
      } else {
        if (typeof typeName === 'string') {
          if (
            // @ts-ignore
            SupportedBuiltinsSet.has(typeName)
          ) {
            return resolveBuiltin(ctx, node, typeName as any, scope)
          } else if (typeName === 'ReturnType' && node.typeParameters) {
            // limited support, only reference types
            const ret = resolveReturnType(
              ctx,
              node.typeParameters.params[0],
              scope
            )
            if (ret) {
              return resolveTypeElements(ctx, ret, scope)
            }
          }
        }
        return ctx.error(
          `Unresolvable type reference or unsupported built-in utility type`,
          node,
          scope
        )
      }
    }
    case 'TSImportType': {
      if (
        getId(node.argument) === 'vue' &&
        node.qualifier?.type === 'Identifier' &&
        node.qualifier.name === 'ExtractPropTypes' &&
        node.typeParameters
      ) {
        return resolveExtractPropTypes(
          resolveTypeElements(ctx, node.typeParameters.params[0], scope),
          scope
        )
      }
      const sourceScope = importSourceToScope(
        ctx,
        node.argument,
        scope,
        node.argument.value
      )
      const resolved = resolveTypeReference(ctx, node, sourceScope)
      if (resolved) {
        return resolveTypeElements(ctx, resolved, resolved._ownerScope)
      }
    }
    case 'TSTypeQuery': {
      const resolved = resolveTypeReference(ctx, node, scope)
      if (resolved) {
        return resolveTypeElements(ctx, resolved, resolved._ownerScope)
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
      ;(e as MaybeWithScope)._ownerScope = scope
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
          baseProps[key]._ownerScope,
          baseProps[key].optional || props[key].optional
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
  scope: TypeScope,
  optional: boolean
): TSPropertySignature & WithScope {
  return {
    type: 'TSPropertySignature',
    key,
    kind: 'get',
    optional,
    typeAnnotation: {
      type: 'TSTypeAnnotation',
      typeAnnotation
    },
    _ownerScope: scope
  }
}

function resolveInterfaceMembers(
  ctx: TypeResolveContext,
  node: TSInterfaceDeclaration & MaybeWithScope,
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
      scope,
      !!node.optional
    )
  }
  return res
}

function resolveIndexType(
  ctx: TypeResolveContext,
  node: TSIndexedAccessType,
  scope: TypeScope
): (TSType & MaybeWithScope)[] {
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
      ;(targetType as TSType & MaybeWithScope)._ownerScope =
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
    case 'Partial': {
      const res: ResolvedElements = { props: {}, calls: t.calls }
      Object.keys(t.props).forEach(key => {
        res.props[key] = { ...t.props[key], optional: true }
      })
      return res
    }
    case 'Required': {
      const res: ResolvedElements = { props: {}, calls: t.calls }
      Object.keys(t.props).forEach(key => {
        res.props[key] = { ...t.props[key], optional: false }
      })
      return res
    }
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

type ReferenceTypes =
  | TSTypeReference
  | TSExpressionWithTypeArguments
  | TSImportType
  | TSTypeQuery

function resolveTypeReference(
  ctx: TypeResolveContext,
  node: ReferenceTypes & {
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
  node: ReferenceTypes,
  onlyExported: boolean
): ScopeTypeNode | undefined {
  if (typeof name === 'string') {
    if (scope.imports[name]) {
      return resolveTypeFromImport(ctx, node, name, scope)
    } else {
      const lookupSource =
        node.type === 'TSTypeQuery'
          ? onlyExported
            ? scope.exportedDeclares
            : scope.declares
          : onlyExported
          ? scope.exportedTypes
          : scope.types
      if (lookupSource[name]) {
        return lookupSource[name]
      } else {
        // fallback to global
        const globalScopes = resolveGlobalScope(ctx)
        if (globalScopes) {
          for (const s of globalScopes) {
            const src = node.type === 'TSTypeQuery' ? s.declares : s.types
            if (src[name]) {
              ;(ctx.deps || (ctx.deps = new Set())).add(s.filename)
              return src[name]
            }
          }
        }
      }
    }
  } else {
    let ns = innerResolveTypeReference(ctx, scope, name[0], node, onlyExported)
    if (ns) {
      if (ns.type !== 'TSModuleDeclaration') {
        // namespace merged with other types, attached as _ns
        ns = ns._ns
      }
      if (ns) {
        const childScope = moduleDeclToScope(ctx, ns, ns._ownerScope || scope)
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
}

function getReferenceName(node: ReferenceTypes): string | string[] {
  const ref =
    node.type === 'TSTypeReference'
      ? node.typeName
      : node.type === 'TSExpressionWithTypeArguments'
      ? node.expression
      : node.type === 'TSImportType'
      ? node.qualifier
      : node.exprName
  if (ref?.type === 'Identifier') {
    return ref.name
  } else if (ref?.type === 'TSQualifiedName') {
    return qualifiedNameToPath(ref)
  } else {
    return 'default'
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
      fileToScope(ctx, normalizePath(file), true)
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
  node: ReferenceTypes,
  name: string,
  scope: TypeScope
): ScopeTypeNode | undefined {
  const { source, imported } = scope.imports[name]
  const sourceScope = importSourceToScope(ctx, node, scope, source)
  return resolveTypeReference(ctx, node, sourceScope, imported, true)
}

function importSourceToScope(
  ctx: TypeResolveContext,
  node: Node,
  scope: TypeScope,
  source: string
): TypeScope {
  const fs: FS = ctx.options.fs || ts?.sys
  if (!fs) {
    ctx.error(
      `No fs option provided to \`compileScript\` in non-Node environment. ` +
        `File system access is required for resolving imported types.`,
      node,
      scope
    )
  }

  let resolved: string | undefined = scope.resolvedImportSources[source]
  if (!resolved) {
    if (source.startsWith('.')) {
      // relative import - fast path
      const filename = joinPaths(scope.filename, '..', source)
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
          `Failed to resolve import source ${JSON.stringify(source)}. ` +
            `typescript is required as a peer dep for vue in order ` +
            `to support resolving types from module imports.`,
          node,
          scope
        )
      }
      resolved = resolveWithTS(scope.filename, source, fs)
    }
    if (resolved) {
      resolved = scope.resolvedImportSources[source] = normalizePath(resolved)
    }
  }
  if (resolved) {
    // (hmr) register dependency file on ctx
    ;(ctx.deps || (ctx.deps = new Set())).add(resolved)
    return fileToScope(ctx, resolved)
  } else {
    return ctx.error(
      `Failed to resolve import source ${JSON.stringify(source)}.`,
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
    tryResolve(joinPaths(filename, `index.ts`)) ||
    tryResolve(joinPaths(filename, `index.d.ts`))
  )
}

interface CachedConfig {
  config: TS.ParsedCommandLine
  cache?: TS.ModuleResolutionCache
}

const tsConfigCache = createCache<CachedConfig[]>()
const tsConfigRefMap = new Map<string, string>()

function resolveWithTS(
  containingFile: string,
  source: string,
  fs: FS
): string | undefined {
  if (!__NODE_JS__) return

  // 1. resolve tsconfig.json
  const configPath = ts.findConfigFile(containingFile, fs.fileExists)
  // 2. load tsconfig.json
  let tsCompilerOptions: TS.CompilerOptions
  let tsResolveCache: TS.ModuleResolutionCache | undefined
  if (configPath) {
    let configs: CachedConfig[]
    const normalizedConfigPath = normalizePath(configPath)
    const cached = tsConfigCache.get(normalizedConfigPath)
    if (!cached) {
      configs = loadTSConfig(configPath, fs).map(config => ({ config }))
      tsConfigCache.set(normalizedConfigPath, configs)
    } else {
      configs = cached
    }
    let matchedConfig: CachedConfig | undefined
    if (configs.length === 1) {
      matchedConfig = configs[0]
    } else {
      // resolve which config matches the current file
      for (const c of configs) {
        const base = normalizePath(
          (c.config.options.pathsBasePath as string) ||
            dirname(c.config.options.configFilePath as string)
        )
        const included: string[] = c.config.raw?.include
        const excluded: string[] = c.config.raw?.exclude
        if (
          (!included && (!base || containingFile.startsWith(base))) ||
          included.some(p => isMatch(containingFile, joinPaths(base, p)))
        ) {
          if (
            excluded &&
            excluded.some(p => isMatch(containingFile, joinPaths(base, p)))
          ) {
            continue
          }
          matchedConfig = c
          break
        }
      }
      if (!matchedConfig) {
        matchedConfig = configs[configs.length - 1]
      }
    }
    tsCompilerOptions = matchedConfig.config.options
    tsResolveCache =
      matchedConfig.cache ||
      (matchedConfig.cache = ts.createModuleResolutionCache(
        process.cwd(),
        createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames),
        tsCompilerOptions
      ))
  } else {
    tsCompilerOptions = {}
  }

  // 3. resolve
  const res = ts.resolveModuleName(
    source,
    containingFile,
    tsCompilerOptions,
    fs,
    tsResolveCache
  )

  if (res.resolvedModule) {
    return res.resolvedModule.resolvedFileName
  }
}

function loadTSConfig(configPath: string, fs: FS): TS.ParsedCommandLine[] {
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
  const config = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, fs.readFile).config,
    parseConfigHost,
    dirname(configPath),
    undefined,
    configPath
  )
  const res = [config]
  if (config.projectReferences) {
    for (const ref of config.projectReferences) {
      tsConfigRefMap.set(ref.path, configPath)
      res.unshift(...loadTSConfig(ref.path, fs))
    }
  }
  return res
}

const fileToScopeCache = createCache<TypeScope>()

/**
 * @private
 */
export function invalidateTypeCache(filename: string) {
  filename = normalizePath(filename)
  fileToScopeCache.delete(filename)
  tsConfigCache.delete(filename)
  const affectedConfig = tsConfigRefMap.get(filename)
  if (affectedConfig) tsConfigCache.delete(affectedConfig)
}

export function fileToScope(
  ctx: TypeResolveContext,
  filename: string,
  asGlobal = false
): TypeScope {
  const cached = fileToScopeCache.get(filename)
  if (cached) {
    return cached
  }
  // fs should be guaranteed to exist here
  const fs = ctx.options.fs || ts?.sys
  const source = fs.readFile(filename) || ''
  const body = parseFile(filename, source, ctx.options.babelParserPlugins)
  const scope = new TypeScope(filename, source, 0, recordImports(body))
  recordTypes(ctx, body, scope, asGlobal)
  fileToScopeCache.set(filename, scope)
  return scope
}

function parseFile(
  filename: string,
  content: string,
  parserPlugins?: SFCScriptCompileOptions['babelParserPlugins']
): Statement[] {
  const ext = extname(filename)
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

  const scope = new TypeScope(
    ctx.filename,
    ctx.source,
    'startOffset' in ctx ? ctx.startOffset! : 0,
    'userImports' in ctx ? Object.create(ctx.userImports) : recordImports(body)
  )

  recordTypes(ctx, body, scope)

  return (ctx.scope = scope)
}

function moduleDeclToScope(
  ctx: TypeResolveContext,
  node: TSModuleDeclaration & { _resolvedChildScope?: TypeScope },
  parentScope: TypeScope
): TypeScope {
  if (node._resolvedChildScope) {
    return node._resolvedChildScope
  }

  const scope = new TypeScope(
    parentScope.filename,
    parentScope.source,
    parentScope.offset,
    Object.create(parentScope.imports),
    Object.create(parentScope.types),
    Object.create(parentScope.declares)
  )

  if (node.body.type === 'TSModuleDeclaration') {
    const decl = node.body as TSModuleDeclaration & WithScope
    decl._ownerScope = scope
    const id = getId(decl.id)
    scope.types[id] = scope.exportedTypes[id] = decl
  } else {
    recordTypes(ctx, node.body.body, scope)
  }

  return (node._resolvedChildScope = scope)
}

const importExportRE = /^Import|^Export/

function recordTypes(
  ctx: TypeResolveContext,
  body: Statement[],
  scope: TypeScope,
  asGlobal = false
) {
  const { types, declares, exportedTypes, exportedDeclares, imports } = scope
  const isAmbient = asGlobal
    ? !body.some(s => importExportRE.test(s.type))
    : false
  for (const stmt of body) {
    if (asGlobal) {
      if (isAmbient) {
        if ((stmt as any).declare) {
          recordType(stmt, types, declares)
        }
      } else if (stmt.type === 'TSModuleDeclaration' && stmt.global) {
        for (const s of (stmt.body as TSModuleBlock).body) {
          recordType(s, types, declares)
        }
      }
    } else {
      recordType(stmt, types, declares)
    }
  }
  if (!asGlobal) {
    for (const stmt of body) {
      if (stmt.type === 'ExportNamedDeclaration') {
        if (stmt.declaration) {
          recordType(stmt.declaration, types, declares)
          recordType(stmt.declaration, exportedTypes, exportedDeclares)
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
      } else if (stmt.type === 'ExportAllDeclaration') {
        const sourceScope = importSourceToScope(
          ctx,
          stmt.source,
          scope,
          stmt.source.value
        )
        Object.assign(scope.exportedTypes, sourceScope.exportedTypes)
      }
    }
  }
  for (const key of Object.keys(types)) {
    const node = types[key]
    node._ownerScope = scope
    if (node._ns) node._ns._ownerScope = scope
  }
  for (const key of Object.keys(declares)) {
    declares[key]._ownerScope = scope
  }
}

function recordType(
  node: Node,
  types: Record<string, Node>,
  declares: Record<string, Node>
) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
    case 'TSEnumDeclaration':
    case 'TSModuleDeclaration': {
      const id = getId(node.id)
      let existing = types[id]
      if (existing) {
        if (node.type === 'TSModuleDeclaration') {
          if (existing.type === 'TSModuleDeclaration') {
            mergeNamespaces(existing as typeof node, node)
          } else {
            attachNamespace(existing, node)
          }
          break
        }
        if (existing.type === 'TSModuleDeclaration') {
          // replace and attach namespace
          types[id] = node
          attachNamespace(node, existing)
          break
        }

        if (existing.type !== node.type) {
          // type-level error
          break
        }
        if (node.type === 'TSInterfaceDeclaration') {
          ;(existing as typeof node).body.body.push(...node.body.body)
        } else {
          ;(existing as typeof node).members.push(...node.members)
        }
      } else {
        types[id] = node
      }
      break
    }
    case 'ClassDeclaration':
      types[getId(node.id)] = node
      break
    case 'TSTypeAliasDeclaration':
      types[node.id.name] = node.typeAnnotation
      break
    case 'TSDeclareFunction':
      if (node.id) declares[node.id.name] = node
      break
    case 'VariableDeclaration': {
      if (node.declare) {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier' && decl.id.typeAnnotation) {
            declares[decl.id.name] = (
              decl.id.typeAnnotation as TSTypeAnnotation
            ).typeAnnotation
          }
        }
      }
      break
    }
  }
}

function mergeNamespaces(to: TSModuleDeclaration, from: TSModuleDeclaration) {
  const toBody = to.body
  const fromBody = from.body
  if (toBody.type === 'TSModuleDeclaration') {
    if (fromBody.type === 'TSModuleDeclaration') {
      // both decl
      mergeNamespaces(toBody, fromBody)
    } else {
      // to: decl -> from: block
      fromBody.body.push({
        type: 'ExportNamedDeclaration',
        declaration: toBody,
        exportKind: 'type',
        specifiers: []
      })
    }
  } else if (fromBody.type === 'TSModuleDeclaration') {
    // to: block <- from: decl
    toBody.body.push({
      type: 'ExportNamedDeclaration',
      declaration: fromBody,
      exportKind: 'type',
      specifiers: []
    })
  } else {
    // both block
    toBody.body.push(...fromBody.body)
  }
}

function attachNamespace(
  to: Node & { _ns?: TSModuleDeclaration },
  ns: TSModuleDeclaration
) {
  if (!to._ns) {
    to._ns = ns
  } else {
    mergeNamespaces(to._ns, ns)
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
  node: Node & MaybeWithScope,
  scope = node._ownerScope || ctxToScope(ctx)
): string[] {
  try {
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
          return inferRuntimeType(
            ctx,
            node.typeAnnotation.typeAnnotation,
            scope
          )
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

      case 'TSTypeReference': {
        const resolved = resolveTypeReference(ctx, node, scope)
        if (resolved) {
          return inferRuntimeType(ctx, resolved, resolved._ownerScope)
        }
        if (node.typeName.type === 'Identifier') {
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
                return inferRuntimeType(
                  ctx,
                  node.typeParameters.params[1],
                  scope
                )
              }
              break
            case 'Exclude':
            case 'OmitThisParameter':
              if (node.typeParameters && node.typeParameters.params[0]) {
                return inferRuntimeType(
                  ctx,
                  node.typeParameters.params[0],
                  scope
                )
              }
              break
          }
        }
        // cannot infer, fallback to UNKNOWN: ThisParameterType
        break
      }

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
        const types = resolveIndexType(ctx, node, scope)
        return flattenTypes(ctx, types, scope)
      }

      case 'ClassDeclaration':
        return ['Object']

      case 'TSImportType': {
        const sourceScope = importSourceToScope(
          ctx,
          node.argument,
          scope,
          node.argument.value
        )
        const resolved = resolveTypeReference(ctx, node, sourceScope)
        if (resolved) {
          return inferRuntimeType(ctx, resolved, resolved._ownerScope)
        }
        break
      }

      case 'TSTypeQuery': {
        const id = node.exprName
        if (id.type === 'Identifier') {
          // typeof only support identifier in local scope
          const matched = scope.declares[id.name]
          if (matched) {
            return inferRuntimeType(ctx, matched, matched._ownerScope)
          }
        }
        break
      }
    }
  } catch (e) {
    // always soft fail on failed runtime type inference
  }
  return [UNKNOWN_TYPE] // no runtime check
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

/**
 * support for the `ExtractPropTypes` helper - it's non-exhaustive, mostly
 * tailored towards popular component libs like element-plus and antd-vue.
 */
function resolveExtractPropTypes(
  { props }: ResolvedElements,
  scope: TypeScope
): ResolvedElements {
  const res: ResolvedElements = { props: {} }
  for (const key in props) {
    const raw = props[key]
    res.props[key] = reverseInferType(
      raw.key,
      raw.typeAnnotation!.typeAnnotation,
      scope
    )
  }
  return res
}

function reverseInferType(
  key: Expression,
  node: TSType,
  scope: TypeScope,
  optional = true,
  checkObjectSyntax = true
): TSPropertySignature & WithScope {
  if (checkObjectSyntax && node.type === 'TSTypeLiteral') {
    // check { type: xxx }
    const typeType = findStaticPropertyType(node, 'type')
    if (typeType) {
      const requiredType = findStaticPropertyType(node, 'required')
      const optional =
        requiredType &&
        requiredType.type === 'TSLiteralType' &&
        requiredType.literal.type === 'BooleanLiteral'
          ? !requiredType.literal.value
          : true
      return reverseInferType(key, typeType, scope, optional, false)
    }
  } else if (
    node.type === 'TSTypeReference' &&
    node.typeName.type === 'Identifier'
  ) {
    if (node.typeName.name.endsWith('Constructor')) {
      return createProperty(
        key,
        ctorToType(node.typeName.name),
        scope,
        optional
      )
    } else if (node.typeName.name === 'PropType' && node.typeParameters) {
      // PropType<{}>
      return createProperty(key, node.typeParameters.params[0], scope, optional)
    }
  }
  if (
    (node.type === 'TSTypeReference' || node.type === 'TSImportType') &&
    node.typeParameters
  ) {
    // try if we can catch Foo.Bar<XXXConstructor>
    for (const t of node.typeParameters.params) {
      const inferred = reverseInferType(key, t, scope, optional)
      if (inferred) return inferred
    }
  }
  return createProperty(key, { type: `TSNullKeyword` }, scope, optional)
}

function ctorToType(ctorType: string): TSType {
  const ctor = ctorType.slice(0, -11)
  switch (ctor) {
    case 'String':
    case 'Number':
    case 'Boolean':
      return { type: `TS${ctor}Keyword` }
    case 'Array':
    case 'Function':
    case 'Object':
    case 'Set':
    case 'Map':
    case 'WeakSet':
    case 'WeakMap':
    case 'Date':
    case 'Promise':
      return {
        type: 'TSTypeReference',
        typeName: { type: 'Identifier', name: ctor }
      }
  }
  // fallback to null
  return { type: `TSNullKeyword` }
}

function findStaticPropertyType(node: TSTypeLiteral, key: string) {
  const prop = node.members.find(
    m =>
      m.type === 'TSPropertySignature' &&
      !m.computed &&
      getId(m.key) === key &&
      m.typeAnnotation
  )
  return prop && prop.typeAnnotation!.typeAnnotation
}

function resolveReturnType(
  ctx: TypeResolveContext,
  arg: Node,
  scope: TypeScope
) {
  let resolved: Node | undefined = arg
  if (
    arg.type === 'TSTypeReference' ||
    arg.type === 'TSTypeQuery' ||
    arg.type === 'TSImportType'
  ) {
    resolved = resolveTypeReference(ctx, arg, scope)
  }
  if (!resolved) return
  if (resolved.type === 'TSFunctionType') {
    return resolved.typeAnnotation?.typeAnnotation
  }
  if (resolved.type === 'TSDeclareFunction') {
    return resolved.returnType
  }
}
