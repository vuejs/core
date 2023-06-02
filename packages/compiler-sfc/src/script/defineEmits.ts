import {
  Identifier,
  LVal,
  Node,
  RestElement,
  TSEnumDeclaration
} from '@babel/types'
import { isCallOf } from './utils'
import { ScriptCompileContext } from './context'
import {
  resolveTypeElements,
  resolveUnionType,
  resolveTypeReference
} from './resolveType'

export const DEFINE_EMITS = 'defineEmits'

export function processDefineEmits(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal
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
        node
      )
    }
    ctx.emitsTypeDecl = node.typeParameters.params[0]
  }

  if (declId) {
    ctx.emitIdentifier =
      declId.type === 'Identifier' ? declId.name : ctx.getString(declId)
  }

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
      ? `${ctx.helper('mergeModels')}(${emitsDecl}, ${modelEmitsDecl})`
      : modelEmitsDecl
  }
  return emitsDecl
}

function extractRuntimeEmits(ctx: ScriptCompileContext): Set<string> {
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
        node
      )
    }
    for (const call of calls) {
      extractEventNames(ctx, call.parameters[0], emits)
    }
  }

  return emits
}

function extractEventNames(
  ctx: ScriptCompileContext,
  eventName: Identifier | RestElement,
  emits: Set<string>
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
        if (typeNode.type === 'TSTypeReference') {
          if (typeNode.typeName.type === 'TSQualifiedName') {
            extractEnumValue(type, typeNode.typeName.right.name, emits)
          }
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
            type.typeName.left.name
          )
          if (resolved && resolved.type === 'TSEnumDeclaration') {
            extractEnumValue(resolved, type.typeName.right.name, emits)
          }
        }
      }
    }
  }
}
function extractEnumValue(
  typeNode: TSEnumDeclaration,
  typeName: string,
  emits: Set<string>
) {
  for (const m of typeNode.members) {
    if (
      m.id.type === 'Identifier' &&
      m.id.name === typeName &&
      m.initializer &&
      m.initializer.type === 'StringLiteral'
    ) {
      emits.add(String(m.initializer.value))
    }
  }
}
