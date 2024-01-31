import { createSimpleExpression, isSimpleIdentifier } from '@vue/compiler-dom'
import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { WithDirectiveIRNode } from '../ir'

export function genWithDirective(
  opers: WithDirectiveIRNode[],
  context: CodegenContext,
): CodeFragment[] {
  const { call, multi, vaporHelper } = context

  const element = `n${opers[0].element}`
  const directiveItems = opers.map(genDirective)
  const directives = multi(['[', ']', ', '], ...directiveItems)

  return [NEWLINE, ...call(vaporHelper('withDirectives'), element, directives)]

  function genDirective({ dir, builtin }: WithDirectiveIRNode): CodeFragment[] {
    const NULL = 'void 0'

    const directive = genDirective()
    const value = dir.exp
      ? ['() => ', ...genExpression(dir.exp, context)]
      : dir.arg || dir.modifiers.length
        ? NULL
        : false
    const argument = dir.arg
      ? genExpression(dir.arg, context)
      : dir.modifiers.length
        ? NULL
        : false
    const modifiers = dir.modifiers.length
      ? ['{ ', genDirectiveModifiers(), ' }']
      : false

    return multi(['[', ']', ', '], directive, value, argument, modifiers)

    function genDirective() {
      const {
        vaporHelper,
        options: { bindingMetadata },
      } = context
      if (dir.name === 'show') {
        return [vaporHelper('vShow')]
      } else if (builtin) {
        return [vaporHelper(builtin)]
      } else {
        const directiveReference = camelize(`v-${dir.name}`)
        // TODO resolve directive
        if (bindingMetadata[directiveReference]) {
          const directiveExpression = createSimpleExpression(directiveReference)
          directiveExpression.ast = null
          return genExpression(directiveExpression, context)
        } else {
          return `${vaporHelper('resolveDirective')}("${directiveReference}")`
        }
      }
    }

    function genDirectiveModifiers() {
      return dir.modifiers
        .map(
          value =>
            `${isSimpleIdentifier(value) ? value : JSON.stringify(value)}: true`,
        )
        .join(', ')
    }
  }
}
