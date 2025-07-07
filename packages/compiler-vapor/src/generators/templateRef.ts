import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { DeclareOldRefIRNode, SetTemplateRefIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'
import { BindingTypes, type SimpleExpressionNode } from '@vue/compiler-dom'

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
      genRefValue(oper.value, context),
      oper.effect ? `r${oper.element}` : oper.refFor ? 'void 0' : undefined,
      oper.refFor && 'true',
    ),
  ]
}

export function genDeclareOldRef(oper: DeclareOldRefIRNode): CodeFragment[] {
  return [NEWLINE, `let r${oper.id}`]
}

function genRefValue(value: SimpleExpressionNode, context: CodegenContext) {
  // in inline mode there is no setupState object, so we can't use string
  // keys to set the ref. Instead, we need to transform it to pass the
  // actual ref instead.
  if (!__BROWSER__ && value && context.options.inline) {
    const binding = context.options.bindingMetadata[value.content]
    if (
      binding === BindingTypes.SETUP_LET ||
      binding === BindingTypes.SETUP_REF ||
      binding === BindingTypes.SETUP_MAYBE_REF
    ) {
      return [value.content]
    }
  }
  return genExpression(value, context)
}
