import { NodeTransform } from '../transform'
import {
  NodeTypes,
  CallExpression,
  createCallExpression,
  ExpressionNode
} from '../ast'
import { isSlotOutlet } from '../utils'
import { buildProps } from './transformElement'
import { createCompilerError, ErrorCodes } from '../errors'
import { RENDER_SLOT } from '../runtimeHelpers'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { props, children, loc } = node
    const $slots = context.prefixIdentifiers ? `_ctx.$slots` : `$slots`
    let slotName: string | ExpressionNode = `"default"`

    // check for <slot name="xxx" OR :name="xxx" />
    let nameIndex: number = -1
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (prop.name === `name` && prop.value) {
          // static name="xxx"
          slotName = JSON.stringify(prop.value.content)
          nameIndex = i
          break
        }
      } else if (prop.name === `bind`) {
        const { arg, exp } = prop
        if (
          arg &&
          exp &&
          arg.type === NodeTypes.SIMPLE_EXPRESSION &&
          arg.isStatic &&
          arg.content === `name`
        ) {
          // dynamic :name="xxx"
          slotName = exp
          nameIndex = i
          break
        }
      }
    }

    const slotArgs: CallExpression['arguments'] = [$slots, slotName]
    const propsWithoutName =
      nameIndex > -1
        ? props.slice(0, nameIndex).concat(props.slice(nameIndex + 1))
        : props
    let hasProps = propsWithoutName.length > 0
    if (hasProps) {
      const { props: propsExpression, directives } = buildProps(
        propsWithoutName,
        loc,
        context
      )
      if (directives.length) {
        context.onError(
          createCompilerError(
            ErrorCodes.X_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
            directives[0].loc
          )
        )
      }
      if (propsExpression) {
        slotArgs.push(propsExpression)
      } else {
        hasProps = false
      }
    }

    if (children.length) {
      if (!hasProps) {
        slotArgs.push(`{}`)
      }
      slotArgs.push(children)
    }

    node.codegenNode = createCallExpression(
      context.helper(RENDER_SLOT),
      slotArgs,
      loc
    )
  }
}
