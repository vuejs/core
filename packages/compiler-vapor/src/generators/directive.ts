import { createSimpleExpression, isSimpleIdentifier } from '@vue/compiler-dom'
import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { WithDirectiveIRNode } from '../ir'

export function genWithDirective(
  opers: WithDirectiveIRNode[],
  context: CodegenContext,
) {
  const {
    push,
    newline,
    pushCall,
    pushMulti,
    vaporHelper,
    options: { bindingMetadata },
  } = context

  newline()
  pushCall(
    vaporHelper('withDirectives'),
    // 1st arg: node
    `n${opers[0].element}`,
    // 2nd arg: directives
    () => {
      // directive
      pushMulti(
        ['[', ']', ', '],
        ...opers.map(oper => () => {
          push('[')

          const { dir, builtin } = oper
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
            } else {
              push(vaporHelper(`resolveDirective("${directiveReference}")`))
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

          push(']')
        }),
      )
    },
  )
}

function genDirectiveModifiers(modifiers: string[]) {
  return modifiers
    .map(
      value =>
        `${isSimpleIdentifier(value) ? value : JSON.stringify(value)}: true`,
    )
    .join(', ')
}
