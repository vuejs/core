import type { TransformContext as CoreTransformContext } from '@vue/compiler-core'
import type { TransformContext as VaporTransformContext } from '@vue/compiler-vapor'

export function isVapor(
  context: CoreTransformContext | VaporTransformContext,
): boolean {
  return 'vapor' in context
    ? (context as CoreTransformContext).vapor
    : (context as VaporTransformContext).options.vapor
}
