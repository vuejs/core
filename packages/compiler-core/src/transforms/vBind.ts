import { DirectiveTransform } from '../transform'
import { createObjectProperty, createExpression } from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { camelize } from '@vue/shared'

// v-bind without arg is handled directly in ./element.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind: DirectiveTransform = (
  { exp, arg, modifiers, loc },
  context
) => {
  if (!exp) {
    context.onError(createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc))
  }
  // .prop is no longer necessary due to new patch behavior
  // .sync is replced by v-model:arg
  if (modifiers.includes('camel')) {
    arg!.content = camelize(arg!.content)
  }
  return {
    props: createObjectProperty(
      arg!,
      exp || createExpression('', true, loc),
      loc
    ),
    needRuntime: false
  }
}
