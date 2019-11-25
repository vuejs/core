import { DirectiveTransform } from '@vue/compiler-core'
import { createDOMCompilerError, DOMErrorCodes } from '../errors'
import { V_SHOW } from '../runtimeHelpers'

export const transformShow: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION, loc)
    )
  }

  return {
    props: [],
    needRuntime: context.helper(V_SHOW)
  }
}
