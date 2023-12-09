import { createCompilerError, ErrorCodes } from '@vue/compiler-core'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes, KeyOverride } from '../ir'
import { resolveModifiers } from '@vue/compiler-dom'

export const transformVOn: DirectiveTransform = (dir, node, context) => {
  let { arg, exp, loc, modifiers } = dir
  if (!exp && !modifiers.length) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc),
    )
  }

  if (!arg) {
    // TODO support v-on="{}"
    return
  }

  const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
    resolveModifiers(
      arg.isStatic ? `on${arg.content}` : arg,
      modifiers,
      null,
      loc,
    )

  let keyOverride: KeyOverride | undefined

  // normalize click.right and click.middle since they don't actually fire

  const isStaticClick = arg.isStatic && arg.content.toLowerCase() === 'click'

  if (nonKeyModifiers.includes('right')) {
    if (isStaticClick) {
      arg = { ...arg, content: 'contextmenu' }
    } else if (!arg.isStatic) {
      keyOverride = ['click', 'contextmenu']
    }
  }
  if (nonKeyModifiers.includes('middle')) {
    if (keyOverride) {
      // TODO error here
    }
    if (isStaticClick) {
      arg = { ...arg, content: 'mouseup' }
    } else if (!arg.isStatic) {
      keyOverride = ['click', 'mouseup']
    }
  }

  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    loc,
    element: context.reference(),
    key: arg,
    value: exp,
    modifiers: {
      keys: keyModifiers,
      nonKeys: nonKeyModifiers,
      options: eventOptionModifiers,
    },
    keyOverride,
  })
}
