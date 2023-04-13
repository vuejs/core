import {
  Node,
  Statement,
  TSCallSignatureDeclaration,
  TSEnumDeclaration,
  TSExpressionWithTypeArguments,
  TSFunctionType,
  TSMappedType,
  TSMethodSignature,
  TSPropertySignature,
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
import { capitalize, hasOwn, isArray } from '@vue/shared'
import { Expression } from '@babel/types'

export interface TypeScope {
  filename: string
  body: Statement[]
  imports: Record<string, ImportBinding>
  types: Record<string, Node>
}

type ResolvedElements = Record<
  string,
  TSPropertySignature | TSMethodSignature
> & {
  __callSignatures?: (TSCallSignatureDeclaration | TSFunctionType)[]
}

/**
 * Resolve arbitrary type node to a list of type elements that can be then
 * mapped to runtime props or emits.
 */
export function resolveTypeElements(
  ctx: ScriptCompileContext,
  node: Node & { _resolvedElements?: ResolvedElements }
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
      return typeElementsToMap(ctx, node.members)
    case 'TSInterfaceDeclaration':
      return resolveInterfaceMembers(ctx, node)
    case 'TSTypeAliasDeclaration':
    case 'TSParenthesizedType':
      return resolveTypeElements(ctx, node.typeAnnotation)
    case 'TSFunctionType': {
      const ret: ResolvedElements = {}
      addCallSignature(ret, node)
      return ret
    }
    case 'TSExpressionWithTypeArguments': // referenced by interface extends
    case 'TSTypeReference': {
      const resolved = resolveTypeReference(ctx, node)
      if (resolved) {
        return resolveTypeElements(ctx, resolved)
      } else {
        // TODO Pick / Omit
        ctx.error(`Failed to resolved type reference`, node)
      }
    }
    case 'TSUnionType':
    case 'TSIntersectionType':
      return mergeElements(
        node.types.map(t => resolveTypeElements(ctx, t)),
        node.type
      )
    case 'TSMappedType':
      return resolveMappedType(ctx, node)
  }
  ctx.error(`Unsupported type in SFC macro: ${node.type}`, node)
}

function addCallSignature(
  elements: ResolvedElements,
  node:
    | TSCallSignatureDeclaration
    | TSFunctionType
    | (TSCallSignatureDeclaration | TSFunctionType)[]
) {
  if (!elements.__callSignatures) {
    Object.defineProperty(elements, '__callSignatures', {
      enumerable: false,
      value: isArray(node) ? node : [node]
    })
  } else {
    if (isArray(node)) {
      elements.__callSignatures.push(...node)
    } else {
      elements.__callSignatures.push(node)
    }
  }
}

function typeElementsToMap(
  ctx: ScriptCompileContext,
  elements: TSTypeElement[]
): ResolvedElements {
  const ret: ResolvedElements = {}
  for (const e of elements) {
    if (e.type === 'TSPropertySignature' || e.type === 'TSMethodSignature') {
      const name =
        e.key.type === 'Identifier'
          ? e.key.name
          : e.key.type === 'StringLiteral'
          ? e.key.value
          : null
      if (name && !e.computed) {
        ret[name] = e
      } else if (e.key.type === 'TemplateLiteral') {
        for (const key of resolveTemplateKeys(ctx, e.key)) {
          ret[key] = e
        }
      } else {
        ctx.error(
          `computed keys are not supported in types referenced by SFC macros.`,
          e
        )
      }
    } else if (e.type === 'TSCallSignatureDeclaration') {
      addCallSignature(ret, e)
    }
  }
  return ret
}

function mergeElements(
  maps: ResolvedElements[],
  type: 'TSUnionType' | 'TSIntersectionType'
): ResolvedElements {
  const res: ResolvedElements = Object.create(null)
  for (const m of maps) {
    for (const key in m) {
      if (!(key in res)) {
        res[key] = m[key]
      } else {
        res[key] = createProperty(res[key].key, {
          type,
          // @ts-ignore
          types: [res[key], m[key]]
        })
      }
    }
    if (m.__callSignatures) {
      addCallSignature(res, m.__callSignatures)
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
  node: TSInterfaceDeclaration
): ResolvedElements {
  const base = typeElementsToMap(ctx, node.body.body)
  if (node.extends) {
    for (const ext of node.extends) {
      const resolvedExt = resolveTypeElements(ctx, ext)
      for (const key in resolvedExt) {
        if (!hasOwn(base, key)) {
          base[key] = resolvedExt[key]
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
  const res: ResolvedElements = {}
  if (!node.typeParameter.constraint) {
    ctx.error(`mapped type used in macros must have a finite constraint.`, node)
  }
  const keys = resolveStringType(ctx, node.typeParameter.constraint)
  for (const key of keys) {
    res[key] = createProperty(
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

function resolveTypeReference(
  ctx: ScriptCompileContext,
  node: TSTypeReference | TSExpressionWithTypeArguments,
  scope = getRootScope(ctx)
): Node | undefined {
  const ref = node.type === 'TSTypeReference' ? node.typeName : node.expression
  if (ref.type === 'Identifier') {
    if (scope.imports[ref.name]) {
      // TODO external import
    } else if (scope.types[ref.name]) {
      return scope.types[ref.name]
    }
  } else {
    // TODO qualified name, e.g. Foo.Bar
    // return resolveTypeReference()
  }
}

function getRootScope(ctx: ScriptCompileContext): TypeScope {
  if (ctx.scope) {
    return ctx.scope
  }

  const body = ctx.scriptAst
    ? [...ctx.scriptAst.body, ...ctx.scriptSetupAst!.body]
    : ctx.scriptSetupAst!.body

  return (ctx.scope = {
    filename: ctx.descriptor.filename,
    imports: ctx.userImports,
    types: recordTypes(body),
    body
  })
}

function recordTypes(body: Statement[]) {
  const types: Record<string, Node> = Object.create(null)
  for (const s of body) {
    recordType(s, types)
  }
  return types
}

function recordType(node: Node, types: Record<string, Node>) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
    case 'TSEnumDeclaration':
      types[node.id.name] = node
      break
    case 'TSTypeAliasDeclaration':
      types[node.id.name] = node.typeAnnotation
      break
    case 'ExportNamedDeclaration': {
      if (node.exportKind === 'type') {
        recordType(node.declaration!, types)
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
  scope = getRootScope(ctx)
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
        return inferRuntimeType(ctx, node.typeAnnotation.typeAnnotation)
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
