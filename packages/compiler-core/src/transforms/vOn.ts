import { DirectiveTransform } from '../transform'
import { createObjectProperty, createExpression } from '../ast'
import { capitalize } from '@vue/shared'
import { CAPITALIZE } from '../runtimeConstants'

// v-on without arg is handled directly in ./element.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-on
// *with* args.
export const transformOn: DirectiveTransform = (dir, context) => {
  const arg = dir.arg!
  const eventName = arg.isStatic
    ? createExpression(`on${capitalize(arg.content)}`, true, arg.loc)
    : createExpression(`'on' + ${CAPITALIZE}(${arg.content})`, false, arg.loc)
  // TODO .once modifier handling since it is platform agnostic
  // other modifiers are handled in compiler-dom
  return {
    props: createObjectProperty(
      eventName,
      dir.exp || createExpression(`() => {}`, false, dir.loc),
      dir.loc
    ),
    needRuntime: false
  }
}
