import { DirectiveTransform } from '../transform'
import { createObjectProperty, createExpression } from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'

// v-bind without arg is handled directly in ./element.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind: DirectiveTransform = (dir, context) => {
  if (!dir.exp) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, dir.loc)
    )
  }
  // TODO handle .prop modifier
  // TODO handle .sync modifier
  return {
    props: createObjectProperty(
      dir.arg!,
      dir.exp || createExpression('', true, dir.loc),
      dir.loc
    ),
    needRuntime: false
  }
}
