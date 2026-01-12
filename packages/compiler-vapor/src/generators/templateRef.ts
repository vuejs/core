import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { SetTemplateRefIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'
import { BindingTypes, type SimpleExpressionNode } from '@vue/compiler-dom'

export const setTemplateRefIdent = `_setTemplateRef`

export function genSetTemplateRef(
  oper: SetTemplateRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const [refValue, refKey] = genRefValue(oper.value, context)
  return [
    NEWLINE,
    ...genCall(
      setTemplateRefIdent, // will be generated in root scope
      `n${oper.element}`,
      refValue,
      oper.refFor && 'true',
      refKey,
    ),
  ]
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
      return [[value.content], JSON.stringify(value.content)]
    }
  }
  return [genExpression(value, context)]
}
