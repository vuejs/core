import {
  type DirectiveTransform,
  ErrorCodes,
  createCompilerError,
} from '@vue/compiler-dom'

/**
 * v-model directive transform for spatial templates.
 * v-model on <text-field> → TextField(..., text: vm.binding("key"))
 * v-model on <toggle> → Toggle(..., isOn: vm.binding("key"))
 *
 * The actual code generation is handled in spatialTransformElement.ts
 * where the v-model directive is inspected during element processing.
 * This transform just validates usage.
 */
export const spatialTransformModel: DirectiveTransform = (
  dir,
  _node,
  context,
) => {
  if (!dir.exp) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_NO_EXPRESSION, dir.loc),
    )
  }

  // v-model processing is handled in element transform
  return { props: [] }
}
