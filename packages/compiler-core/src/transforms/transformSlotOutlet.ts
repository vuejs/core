import { NodeTransform, TransformContext } from '../transform'
import {
  NodeTypes,
  CallExpression,
  createCallExpression,
  ExpressionNode,
  SlotOutletNode,
  createFunctionExpression
} from '../ast'
import { isSlotOutlet, findProp } from '../utils'
import { buildProps, PropsExpression } from './transformElement'
import { createCompilerError, ErrorCodes } from '../errors'
import { RENDER_SLOT } from '../runtimeHelpers'
import { camelize } from '@vue/shared/'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { children, loc } = node
    const { slotName, slotProps } = processSlotOutlet(node, context)

    const slotArgs: CallExpression['arguments'] = [
      context.prefixIdentifiers ? `_ctx.$slots` : `$slots`,
      slotName
    ]

    if (slotProps) {
      slotArgs.push(slotProps)
    }

    if (children.length) {
      if (!slotProps) {
        slotArgs.push(`{}`)
      }
      slotArgs.push(createFunctionExpression([], children, false, false, loc))
    }

    node.codegenNode = createCallExpression(
      context.helper(RENDER_SLOT),
      slotArgs,
      loc
    )
  }
}

interface SlotOutletProcessResult {
  slotName: string | ExpressionNode
  slotProps: PropsExpression | undefined
}

export function processSlotOutlet(
  node: SlotOutletNode,
  context: TransformContext
): SlotOutletProcessResult {
  let slotName: string | ExpressionNode = `"default"`
  let slotProps: PropsExpression | undefined = undefined

  // check for <slot name="xxx" OR :name="xxx" />
  const name = findProp(node, 'name')
  if (name) {
    if (name.type === NodeTypes.ATTRIBUTE && name.value) {
      // static name
      slotName = JSON.stringify(name.value.content)
    } else if (name.type === NodeTypes.DIRECTIVE && name.exp) {
      // dynamic name
      slotName = name.exp
    }
  }

  const propsWithoutName = name
    ? node.props.filter(p => p !== name)
    : node.props
  if (propsWithoutName.length > 0) {
    const { props, directives } = buildProps(node, context, propsWithoutName)
    slotProps = props

    //#2488
    if (
      slotProps &&
      (slotProps as any).properties &&
      (slotProps as any).properties.length > 0
    ) {
      for (let i = 0; i < (slotProps as any).properties.length; i++) {
        const prop = (slotProps as any).properties[i]
        prop.key.content = camelize(prop.key.content)
      }
    }

    if (directives.length) {
      context.onError(
        createCompilerError(
          ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
          directives[0].loc
        )
      )
    }
  }

  return {
    slotName,
    slotProps
  }
}
