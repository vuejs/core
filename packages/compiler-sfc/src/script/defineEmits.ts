import {
  Identifier,
  LVal,
  Node,
  RestElement,
  TSFunctionType,
  TSInterfaceBody,
  TSTypeLiteral
} from '@babel/types'
import { FromNormalScript, isCallOf } from './utils'
import { ScriptCompileContext } from './context'
import { resolveQualifiedType } from './resolveType'

export const DEFINE_EMITS = 'defineEmits'

export type EmitsDeclType = FromNormalScript<
  TSFunctionType | TSTypeLiteral | TSInterfaceBody
>

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

    const emitsTypeDeclRaw = node.typeParameters.params[0]
    ctx.emitsTypeDecl = resolveQualifiedType(
      ctx,
      emitsTypeDeclRaw,
      node => node.type === 'TSFunctionType' || node.type === 'TSTypeLiteral'
    ) as EmitsDeclType | undefined

    if (!ctx.emitsTypeDecl) {
      ctx.error(
        `type argument passed to ${DEFINE_EMITS}() must be a function type, ` +
          `a literal type with call signatures, or a reference to the above types.`,
        emitsTypeDeclRaw
      )
    }
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
  if (node.type === 'TSTypeLiteral' || node.type === 'TSInterfaceBody') {
    const members = node.type === 'TSTypeLiteral' ? node.members : node.body
    let hasCallSignature = false
    let hasProperty = false
    for (let t of members) {
      if (t.type === 'TSCallSignatureDeclaration') {
        extractEventNames(t.parameters[0], emits)
        hasCallSignature = true
      }
      if (t.type === 'TSPropertySignature') {
        if (t.key.type === 'Identifier' && !t.computed) {
          emits.add(t.key.name)
          hasProperty = true
        } else if (t.key.type === 'StringLiteral' && !t.computed) {
          emits.add(t.key.value)
          hasProperty = true
        } else {
          ctx.error(`defineEmits() type cannot use computed keys.`, t.key)
        }
      }
    }
    if (hasCallSignature && hasProperty) {
      ctx.error(
        `defineEmits() type cannot mixed call signature and property syntax.`,
        node
      )
    }
  } else {
    extractEventNames(node.parameters[0], emits)
  }
  return emits
}

function extractEventNames(
  eventName: Identifier | RestElement,
  emits: Set<string>
) {
  if (
    eventName.type === 'Identifier' &&
    eventName.typeAnnotation &&
    eventName.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    const typeNode = eventName.typeAnnotation.typeAnnotation
    if (typeNode.type === 'TSLiteralType') {
      if (
        typeNode.literal.type !== 'UnaryExpression' &&
        typeNode.literal.type !== 'TemplateLiteral'
      ) {
        emits.add(String(typeNode.literal.value))
      }
    } else if (typeNode.type === 'TSUnionType') {
      for (const t of typeNode.types) {
        if (
          t.type === 'TSLiteralType' &&
          t.literal.type !== 'UnaryExpression' &&
          t.literal.type !== 'TemplateLiteral'
        ) {
          emits.add(String(t.literal.value))
        }
      }
    }
  }
}
