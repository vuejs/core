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
  if (context.staticTemplateRefHelperCandidate === oper) {
    return genSetStaticTemplateRef(oper, refValue, refKey, context)
  }
  if (context.staticTemplateRefBindingCandidate === oper) {
    return genSetTemplateRefBinding(oper, context)
  }

  context.needsTemplateRefSetter = true
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

function genSetStaticTemplateRef(
  oper: SetTemplateRefIRNode,
  refValue: CodeFragment[],
  refKey: string | undefined,
  context: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...genCall(
      context.helper('setStaticTemplateRef'),
      `n${oper.element}`,
      refValue,
      oper.refFor && 'true',
      refKey,
    ),
  ]
}

export function genSetTemplateRefBinding(
  oper: SetTemplateRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const [refValue, refKey] = genRefValue(oper.value, context)
  const setter = context.inSlotBlock && setTemplateRefIdent
  if (context.inSlotBlock) {
    context.needsTemplateRefSetter = true
  }
  return [
    NEWLINE,
    ...genCall(
      [context.helper('setTemplateRefBinding'), 'undefined'],
      `n${oper.element}`,
      ['() => ', ...refValue],
      ...(setter || oper.refFor || refKey
        ? [setter, oper.refFor && 'true', refKey]
        : []),
    ),
  ]
}

function genRefValue(
  value: SimpleExpressionNode,
  context: CodegenContext,
): [CodeFragment[], string?] {
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
