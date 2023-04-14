import {
  Identifier,
  Node as _Node,
  Statement,
  TSCallSignatureDeclaration,
  TSEnumDeclaration,
  TSExpressionWithTypeArguments,
  TSFunctionType,
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
import { UNKNOWN_TYPE } from './utils'
import { ScriptCompileContext } from './context'
import { ImportBinding } from '../compileScript'
import { TSInterfaceDeclaration } from '@babel/types'
import { capitalize, hasOwn } from '@vue/shared'
import { Expression } from '@babel/types'

export interface TypeScope {
  filename: string
  imports: Record<string, ImportBinding>
  types: Record<string, Node>
  parent?: TypeScope
}

interface WithScope {
  _ownerScope?: TypeScope
}

interface ResolvedElements {
  props: Record<string, (TSPropertySignature | TSMethodSignature) & WithScope>
  calls?: (TSCallSignatureDeclaration | TSFunctionType)[]
}

type Node = _Node &
  WithScope & {
    _resolvedElements?: ResolvedElements
  }

/**
 * Resolve arbitrary type node to a list of type elements that can be then
 * mapped to runtime props or emits.
 */
export function resolveTypeElements(
  ctx: ScriptCompileContext,
  node: Node
): ResolvedElements {
  if (node._resolvedElements) {
    return node._resolvedElements
  }
  return (node._resolvedElements = innerResolveTypeElements(ctx, node))
}

function innerResolveTypeElements(
  ctx: ScriptCompileContext,
  node: Node
): ResolvedElements {
  switch (node.type) {
    case 'TSTypeLiteral':
      return typeElementsToMap(ctx, node.members, node._ownerScope)
    case 'TSInterfaceDeclaration':
      return resolveInterfaceMembers(ctx, node)
    case 'TSTypeAliasDeclaration':
    case 'TSParenthesizedType':
      return resolveTypeElements(ctx, node.typeAnnotation)
    case 'TSFunctionType': {
      return { props: {}, calls: [node] }
    }
    case 'TSUnionType':
    case 'TSIntersectionType':
      return mergeElements(
        node.types.map(t => resolveTypeElements(ctx, t)),
        node.type
      )
    case 'TSMappedType':
      return resolveMappedType(ctx, node)
    case 'TSIndexedAccessType': {
      if (
        node.indexType.type === 'TSLiteralType' &&
        node.indexType.literal.type === 'StringLiteral'
      ) {
        const resolved = resolveTypeElements(ctx, node.objectType)
        const key = node.indexType.literal.value
        const targetType = resolved.props[key].typeAnnotation
        if (targetType) {
          return resolveTypeElements(ctx, targetType.typeAnnotation)
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
      const resolved = resolveTypeReference(ctx, node)
      if (resolved) {
        return resolveTypeElements(ctx, resolved)
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
          `Failed to resolved type reference, or unsupported built-in utlility type.`,
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
      ;(e as Node)._ownerScope = scope
      const name =
        e.key.type === 'Identifier'
          ? e.key.name
          : e.key.type === 'StringLiteral'
          ? e.key.value
          : null
      if (name && !e.computed) {
        res.props[name] = e
      } else if (e.key.type === 'TemplateLiteral') {
        for (const key of resolveTemplateKeys(ctx, e.key)) {
          res.props[key] = e
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
        baseProps[key] = createProperty(baseProps[key].key, {
          type,
          // @ts-ignore
          types: [baseProps[key], props[key]]
        })
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
  typeAnnotation: TSType
): TSPropertySignature {
  return {
    type: 'TSPropertySignature',
    key,
    kind: 'get',
    typeAnnotation: {
      type: 'TSTypeAnnotation',
      typeAnnotation
    }
  }
}

function resolveInterfaceMembers(
  ctx: ScriptCompileContext,
  node: TSInterfaceDeclaration & WithScope
): ResolvedElements {
  const base = typeElementsToMap(ctx, node.body.body, node._ownerScope)
  if (node.extends) {
    for (const ext of node.extends) {
      const { props } = resolveTypeElements(ctx, ext)
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
  node: TSMappedType
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
      node.typeAnnotation!
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
  scope = ctxToScope(ctx)
): Node | undefined {
  if (node._resolvedReference) {
    return node._resolvedReference
  }
  const name = getReferenceName(node)
  return (node._resolvedReference = innerResolveTypeReference(scope, name))
}

function innerResolveTypeReference(
  scope: TypeScope,
  name: string | string[]
): Node | undefined {
  if (typeof name === 'string') {
    if (scope.imports[name]) {
      // TODO external import
    } else if (scope.types[name]) {
      return scope.types[name]
    }
  } else {
    const ns = innerResolveTypeReference(scope, name[0])
    if (ns && ns.type === 'TSModuleDeclaration') {
      const childScope = moduleDeclToScope(ns, scope)
      return innerResolveTypeReference(
        childScope,
        name.length > 2 ? name.slice(1) : name[name.length - 1]
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

function ctxToScope(ctx: ScriptCompileContext): TypeScope {
  if (ctx.scope) {
    return ctx.scope
  }

  const body = ctx.scriptAst
    ? [...ctx.scriptAst.body, ...ctx.scriptSetupAst!.body]
    : ctx.scriptSetupAst!.body

  return (ctx.scope = {
    filename: ctx.descriptor.filename,
    imports: ctx.userImports,
    types: recordTypes(body)
  })
}

function moduleDeclToScope(
  node: TSModuleDeclaration & { _resolvedChildScope?: TypeScope },
  parent: TypeScope
): TypeScope {
  if (node._resolvedChildScope) {
    return node._resolvedChildScope
  }
  const types: TypeScope['types'] = Object.create(parent.types)
  const scope: TypeScope = {
    filename: parent.filename,
    imports: Object.create(parent.imports),
    types: recordTypes((node.body as TSModuleBlock).body, types),
    parent
  }
  for (const key of Object.keys(types)) {
    types[key]._ownerScope = scope
  }
  return (node._resolvedChildScope = scope)
}

function recordTypes(
  body: Statement[],
  types: Record<string, Node> = Object.create(null)
) {
  for (const s of body) {
    recordType(s, types)
  }
  return types
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
    case 'ExportNamedDeclaration': {
      if (node.declaration) {
        recordType(node.declaration, types)
      }
      break
    }
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

export function inferRuntimeType(
  ctx: ScriptCompileContext,
  node: Node,
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
