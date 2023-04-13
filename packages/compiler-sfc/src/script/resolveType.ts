import {
  Expression,
  Identifier,
  Node,
  Statement,
  TSCallSignatureDeclaration,
  TSEnumDeclaration,
  TSExpressionWithTypeArguments,
  TSFunctionType,
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
import { UNKNOWN_TYPE, getId, getImportedName } from './utils'
import { ScriptCompileContext, resolveParserPlugins } from './context'
import { ImportBinding, SFCScriptCompileOptions } from '../compileScript'
import { capitalize, hasOwn } from '@vue/shared'
import path from 'path'
import { parse as babelParse } from '@babel/parser'
import { parse } from '../parse'

type Import = Pick<ImportBinding, 'source' | 'imported'>

export interface TypeScope {
  filename: string
  source: string
  imports: Record<string, Import>
  types: Record<
    string,
    Node & {
      // scope types always has ownerScope attached
      _ownerScope: TypeScope
    }
  >
  exportedTypes: Record<
    string,
    Node & {
      // scope types always has ownerScope attached
      _ownerScope: TypeScope
    }
  >
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
  ctx: ScriptCompileContext,
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
  ctx: ScriptCompileContext,
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
      if (
        node.indexType.type === 'TSLiteralType' &&
        node.indexType.literal.type === 'StringLiteral'
      ) {
        const resolved = resolveTypeElements(ctx, node.objectType, scope)
        const key = node.indexType.literal.value
        const targetType = resolved.props[key].typeAnnotation
        if (targetType) {
          return resolveTypeElements(
            ctx,
            targetType.typeAnnotation,
            resolved.props[key]._ownerScope
          )
        } else {
          break
        }
      } else {
        ctx.error(
          `Unsupported index type: ${node.indexType.type}`,
          node.indexType
        )
      }
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
          return resolveBuiltin(ctx, node, typeName as any)
        }
        ctx.error(
          `Failed to resolve type reference, or unsupported built-in utlility type.`,
          node
        )
      }
    }
  }
  ctx.error(`Unresolvable type in SFC macro: ${node.type}`, node)
}

function typeElementsToMap(
  ctx: ScriptCompileContext,
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
        for (const key of resolveTemplateKeys(ctx, e.key)) {
          res.props[key] = e as ResolvedElements['props'][string]
        }
      } else {
        ctx.error(
          `computed keys are not supported in types referenced by SFC macros.`,
          e
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
  ctx: ScriptCompileContext,
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
  ctx: ScriptCompileContext,
  node: TSMappedType,
  scope: TypeScope
): ResolvedElements {
  const res: ResolvedElements = { props: {} }
  if (!node.typeParameter.constraint) {
    ctx.error(`mapped type used in macros must have a finite constraint.`, node)
  }
  const keys = resolveStringType(ctx, node.typeParameter.constraint)
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

function resolveStringType(ctx: ScriptCompileContext, node: Node): string[] {
  switch (node.type) {
    case 'StringLiteral':
      return [node.value]
    case 'TSLiteralType':
      return resolveStringType(ctx, node.literal)
    case 'TSUnionType':
      return node.types.map(t => resolveStringType(ctx, t)).flat()
    case 'TemplateLiteral': {
      return resolveTemplateKeys(ctx, node)
    }
    case 'TSTypeReference': {
      const resolved = resolveTypeReference(ctx, node)
      if (resolved) {
        return resolveStringType(ctx, resolved)
      }
      if (node.typeName.type === 'Identifier') {
        const getParam = (index = 0) =>
          resolveStringType(ctx, node.typeParameters!.params[index])
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
            ctx.error('Failed to resolve type reference', node)
        }
      }
    }
  }
  ctx.error('Failed to resolve string type into finite keys', node)
}

function resolveTemplateKeys(
  ctx: ScriptCompileContext,
  node: TemplateLiteral
): string[] {
  if (!node.expressions.length) {
    return [node.quasis[0].value.raw]
  }

  const res: string[] = []
  const e = node.expressions[0]
  const q = node.quasis[0]
  const leading = q ? q.value.raw : ``
  const resolved = resolveStringType(ctx, e)
  const restResolved = resolveTemplateKeys(ctx, {
    ...node,
    expressions: node.expressions.slice(1),
    quasis: q ? node.quasis.slice(1) : node.quasis
  })

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
  ctx: ScriptCompileContext,
  node: TSTypeReference | TSExpressionWithTypeArguments,
  name: GetSetType<typeof SupportedBuiltinsSet>
): ResolvedElements {
  const t = resolveTypeElements(ctx, node.typeParameters!.params[0])
  switch (name) {
    case 'Partial':
    case 'Required':
    case 'Readonly':
      return t
    case 'Pick': {
      const picked = resolveStringType(ctx, node.typeParameters!.params[1])
      const res: ResolvedElements = { props: {}, calls: t.calls }
      for (const key of picked) {
        res.props[key] = t.props[key]
      }
      return res
    }
    case 'Omit':
      const omitted = resolveStringType(ctx, node.typeParameters!.params[1])
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
  ctx: ScriptCompileContext,
  node: (TSTypeReference | TSExpressionWithTypeArguments) & {
    _resolvedReference?: Node
  },
  scope?: TypeScope,
  name?: string,
  onlyExported = false
): (Node & WithScope) | undefined {
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
  ctx: ScriptCompileContext,
  scope: TypeScope,
  name: string | string[],
  node: TSTypeReference | TSExpressionWithTypeArguments,
  onlyExported: boolean
): Node | undefined {
  if (typeof name === 'string') {
    if (scope.imports[name]) {
      return resolveTypeFromImport(ctx, scope, scope.imports[name], node)
    } else {
      const types = onlyExported ? scope.exportedTypes : scope.types
      return types[name]
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
        true
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

function resolveTypeFromImport(
  ctx: ScriptCompileContext,
  scope: TypeScope,
  { source, imported }: Import,
  node: TSTypeReference | TSExpressionWithTypeArguments
): Node | undefined {
  const fs = ctx.options.fs
  if (!fs) {
    ctx.error(
      `fs options for compileScript are required for resolving imported types`,
      node
    )
  }
  // TODO (hmr) register dependency file on ctx
  const containingFile = scope.filename
  if (source.startsWith('.')) {
    // relative import - fast path
    const filename = path.join(containingFile, '..', source)
    const resolved = resolveExt(filename, fs)
    if (resolved) {
      return resolveTypeReference(
        ctx,
        node,
        fileToScope(ctx, resolved, fs),
        imported,
        true
      )
    } else {
      ctx.error(`Failed to resolve import source for type`, node)
    }
  } else {
    // TODO module or aliased import - use full TS resolution
    return
  }
}

function resolveExt(
  filename: string,
  fs: NonNullable<SFCScriptCompileOptions['fs']>
) {
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

function fileToScope(
  ctx: ScriptCompileContext,
  filename: string,
  fs: NonNullable<SFCScriptCompileOptions['fs']>
): TypeScope {
  // TODO cache
  const source = fs.readFile(filename)
  const body = parseFile(ctx, filename, source)
  const scope: TypeScope = {
    filename,
    source,
    types: Object.create(null),
    exportedTypes: Object.create(null),
    imports: recordImports(body)
  }
  recordTypes(body, scope)
  return scope
}

function parseFile(
  ctx: ScriptCompileContext,
  filename: string,
  content: string
): Statement[] {
  const ext = path.extname(filename)
  if (ext === '.ts' || ext === '.tsx') {
    return babelParse(content, {
      plugins: resolveParserPlugins(
        ext.slice(1),
        ctx.options.babelParserPlugins
      ),
      sourceType: 'module'
    }).program.body
  } else if (ext === '.vue') {
    const {
      descriptor: { script, scriptSetup }
    } = parse(content)
    const scriptContent = (script?.content || '') + (scriptSetup?.content || '')
    const lang = script?.lang || scriptSetup?.lang
    return babelParse(scriptContent, {
      plugins: resolveParserPlugins(lang!, ctx.options.babelParserPlugins),
      sourceType: 'module'
    }).program.body
  }
  return []
}

function ctxToScope(ctx: ScriptCompileContext): TypeScope {
  if (ctx.scope) {
    return ctx.scope
  }

  const scope: TypeScope = {
    filename: ctx.descriptor.filename,
    source: ctx.descriptor.source,
    imports: Object.create(ctx.userImports),
    types: Object.create(null),
    exportedTypes: Object.create(null)
  }

  const body = ctx.scriptAst
    ? [...ctx.scriptAst.body, ...ctx.scriptSetupAst!.body]
    : ctx.scriptSetupAst!.body

  recordTypes(body, scope)

  return (ctx.scope = scope)
}

function moduleDeclToScope(
  node: TSModuleDeclaration & { _resolvedChildScope?: TypeScope },
  parent: TypeScope
): TypeScope {
  if (node._resolvedChildScope) {
    return node._resolvedChildScope
  }
  const scope: TypeScope = {
    ...parent,
    types: Object.create(parent.types),
    imports: Object.create(parent.imports)
  }
  recordTypes((node.body as TSModuleBlock).body, scope)
  return (node._resolvedChildScope = scope)
}

function recordTypes(body: Statement[], scope: TypeScope) {
  const { types, exportedTypes, imports } = scope
  for (const stmt of body) {
    recordType(stmt, types)
  }
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
  for (const key of Object.keys(types)) {
    types[key]._ownerScope = scope
  }
}

function recordType(node: Node, types: Record<string, Node>) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
    case 'TSEnumDeclaration':
    case 'TSModuleDeclaration': {
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
  ctx: ScriptCompileContext,
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
          return inferRuntimeType(ctx, resolved, scope)
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
      if (
        node.indexType.type === 'TSLiteralType' &&
        node.indexType.literal.type === 'StringLiteral'
      ) {
        const resolved = resolveTypeElements(ctx, node.objectType)
        const key = node.indexType.literal.value
        return inferRuntimeType(ctx, resolved.props[key])
      }
    }

    default:
      return [UNKNOWN_TYPE] // no runtime check
  }
}

function flattenTypes(
  ctx: ScriptCompileContext,
  types: TSType[],
  scope: TypeScope
): string[] {
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
