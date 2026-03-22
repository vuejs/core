import {
  DOMErrorCodes,
  type DirectiveTransform,
  createDOMCompilerError,
} from '@vue/compiler-dom'

/**
 * v-show directive transform for spatial templates.
 * v-show="visible" → .opacity(vm.get("visible") ? 1 : 0)
 *
 * The actual code generation is handled in spatialTransformElement.ts.
 * This transform just validates usage.
 */
export const spatialTransformShow: DirectiveTransform = (
  dir,
  _node,
  context,
) => {
  if (!dir.exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION),
    )
  }

  return { props: [] }
}
