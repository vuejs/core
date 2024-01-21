import { createSimpleExpression, isSimpleIdentifier } from '@vue/compiler-dom'
import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { WithDirectiveIRNode } from '../ir'

export function genWithDirective(
  oper: WithDirectiveIRNode,
  context: CodegenContext,
) {
  const { push, newline, pushFnCall, pushMulti, vaporHelper, bindingMetadata } =
    context
  const { dir, builtin } = oper

  // TODO merge directive for the same node
  newline()
  pushFnCall(
    vaporHelper('withDirectives'),
    // 1st arg: node
    `n${oper.element}`,
    // 2nd arg: directives
    () => {
      push('[')
      // directive
      pushMulti(['[', ']', ', '], () => {
        if (dir.name === 'show') {
          push(vaporHelper('vShow'))
        } else if (builtin) {
          push(vaporHelper(builtin))
        } else {
          const directiveReference = camelize(`v-${dir.name}`)
          // TODO resolve directive
          if (bindingMetadata[directiveReference]) {
            const directiveExpression =
              createSimpleExpression(directiveReference)
            directiveExpression.ast = null
            genExpression(directiveExpression, context)
          }
        }

        if (dir.exp) {
          push(', () => ')
          genExpression(dir.exp, context)
        } else if (dir.arg || dir.modifiers.length) {
          push(', void 0')
        }

        if (dir.arg) {
          push(', ')
          genExpression(dir.arg, context)
        } else if (dir.modifiers.length) {
          push(', void 0')
        }

        if (dir.modifiers.length) {
          push(', ')
          push('{ ')
          push(genDirectiveModifiers(dir.modifiers))
          push(' }')
        }
      })
      push(']')
    },
  )
}

function genDirectiveModifiers(modifiers: string[]) {
  return modifiers
    .map(
      (value) =>
        `${isSimpleIdentifier(value) ? value : JSON.stringify(value)}: true`,
    )
    .join(', ')
}
