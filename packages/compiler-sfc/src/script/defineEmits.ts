import type {
  ArrayPattern,
  Identifier,
  LVal,
  Node,
  ObjectPattern,
  RestElement,
} from '@babel/types'
import { isCallOf } from './utils'
import type { ScriptCompileContext } from './context'
import {
  type TypeResolveContext,
  resolveEnumMemberValue,
  resolveTypeElements,
  resolveTypeReference,
  resolveUnionType,
} from './resolveType'

export const DEFINE_EMITS = 'defineEmits'

export function processDefineEmits(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal,
): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }
  if (ctx.hasDefineEmitCall) {
    ctx.error(`duplicate ${DEFINE_EMITS}() call`, node)
  }
  ctx.hasDefineEmitCall = true
  ctx.emitsRuntimeDecl = node.arguments[0]
  if (node.typeParameters) {
    if (ctx.emitsRuntimeDecl) {
      ctx.error(
        `${DEFINE_EMITS}() cannot accept both type and non-type arguments ` +
          `at the same time. Use one or the other.`,
        node,
      )
    }
    ctx.emitsTypeDecl = node.typeParameters.params[0]
  }

  ctx.emitDecl = declId

  return true
}

export function genRuntimeEmits(ctx: ScriptCompileContext): string | undefined {
  let emitsDecl = ''
  if (ctx.emitsRuntimeDecl) {
    emitsDecl = ctx.getString(ctx.emitsRuntimeDecl).trim()
  } else if (ctx.emitsTypeDecl) {
    const typeDeclaredEmits = extractRuntimeEmits(ctx)
    emitsDecl = typeDeclaredEmits.size
      ? `[${Array.from(typeDeclaredEmits)
          .map(k => JSON.stringify(k))
          .join(', ')}]`
      : ``
  }
  if (ctx.hasDefineModelCall) {
    let modelEmitsDecl = `[${Object.keys(ctx.modelDecls)
      .map(n => JSON.stringify(`update:${n}`))
      .join(', ')}]`
    emitsDecl = emitsDecl
      ? `/*@__PURE__*/${ctx.helper(
          'mergeModels',
        )}(${emitsDecl}, ${modelEmitsDecl})`
      : modelEmitsDecl
  }
  return emitsDecl
}

export function extractRuntimeEmits(ctx: TypeResolveContext): Set<string> {
  const emits = new Set<string>()
  const node = ctx.emitsTypeDecl!

  if (node.type === 'TSFunctionType') {
    extractEventNames(ctx, node.parameters[0], emits)
    return emits
  }

  const { props, calls } = resolveTypeElements(ctx, node)

  let hasProperty = false
  for (const key in props) {
    emits.add(key)
    hasProperty = true
  }

  if (calls) {
    if (hasProperty) {
      ctx.error(
        `defineEmits() type cannot mixed call signature and property syntax.`,
        node,
      )
    }
    for (const call of calls) {
      extractEventNames(ctx, call.parameters[0], emits)
    }
  }

  return emits
}

function extractEventNames(
  ctx: TypeResolveContext,
  eventName: ArrayPattern | Identifier | ObjectPattern | RestElement,
  emits: Set<string>,
) {
  if (
    eventName.type === 'Identifier' &&
    eventName.typeAnnotation &&
    eventName.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    const typeNode = eventName.typeAnnotation.typeAnnotation
    const types = resolveUnionType(ctx, typeNode)

    for (const type of types) {
      if (type.type === 'TSLiteralType') {
        if (
          type.literal.type !== 'UnaryExpression' &&
          type.literal.type !== 'TemplateLiteral'
        ) {
          emits.add(String(type.literal.value))
        }
      } else if (type.type === 'TSEnumDeclaration') {
        if (
          typeNode.type === 'TSTypeReference' &&
          typeNode.typeName.type === 'TSQualifiedName'
        ) {
          const memberValue = resolveEnumMemberValue(
            ctx,
            type,
            typeNode.typeName.right.name,
          )
          if (memberValue) emits.add(memberValue)
        }
      } else if (type.type === 'TSTypeReference') {
        if (
          type.typeName.type === 'TSQualifiedName' &&
          type.typeName.left.type === 'Identifier'
        ) {
          const resolved = resolveTypeReference(
            ctx,
            type,
            undefined,
            type.typeName.left.name,
          )
          if (resolved && resolved.type === 'TSEnumDeclaration') {
            const memberValue = resolveEnumMemberValue(
              ctx,
              resolved,
              type.typeName.right.name,
            )
            if (memberValue) emits.add(memberValue)
          }
        }
      }
    }
  }
}
