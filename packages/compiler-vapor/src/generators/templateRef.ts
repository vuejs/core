import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { DeclareOldRefIRNode, SetTemplateRefIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export const setTemplateRefIdent = `_setTemplateRef`

export function genSetTemplateRef(
  oper: SetTemplateRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    oper.effect && `r${oper.element} = `,
    ...genCall(
      setTemplateRefIdent, // will be generated in root scope
      `n${oper.element}`,
      genExpression(oper.value, context),
      oper.effect ? `r${oper.element}` : oper.refFor ? 'void 0' : undefined,
      oper.refFor && 'true',
    ),
  ]
}

export function genDeclareOldRef(oper: DeclareOldRefIRNode): CodeFragment[] {
  return [NEWLINE, `let r${oper.id}`]
}
