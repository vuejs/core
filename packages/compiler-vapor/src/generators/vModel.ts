import type { CodegenContext } from '../generate'
import type { DirectiveIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'
import { genExpression } from './expression'

const helperMap = {
  text: 'applyTextModel',
  radio: 'applyRadioModel',
  checkbox: 'applyCheckboxModel',
  select: 'applySelectModel',
  dynamic: 'applyDynamicModel',
} as const

// This is only for built-in v-model on native elements.
export function genVModel(
  oper: DirectiveIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    modelType,
    element,
    dir: { exp, modifiers },
  } = oper

  return [
    NEWLINE,
    ...genCall(
      context.helper(helperMap[modelType!]),
      `n${element}`,
      // getter
      [`() => (`, ...genExpression(exp!, context), `)`],
      // setter
      [
        `${context.options.isTS ? `($event: any)` : `$event`} => (`,
        ...genExpression(exp!, context, '$event'),
        ')',
      ],
      // modifiers
      modifiers.length
        ? `{ ${modifiers.map(e => e.content + ': true').join(',')} }`
        : undefined,
    ),
  ]
}
