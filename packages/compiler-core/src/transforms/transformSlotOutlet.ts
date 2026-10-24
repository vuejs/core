import type { NodeTransform, TransformContext } from '../transform'
import {
  type CallExpression,
  type ExpressionNode,
  type JSChildNode,
  NodeTypes,
  type ObjectExpression,
  type SlotOutletNode,
  createCallExpression,
  createFunctionExpression,
  createSimpleExpression,
} from '../ast'
import {
  isSimpleIdentifier,
  isSlotOutlet,
  isStaticArgOf,
  isStaticExp,
} from '../utils'
import { type PropsExpression, buildProps } from './transformElement'
import { ErrorCodes, createCompilerError } from '../errors'
import { MERGE_PROPS, NORMALIZE_PROPS, RENDER_SLOT } from '../runtimeHelpers'
import { camelize } from '@vue/shared'
import { processExpression } from './transformExpression'
import { BindingTypes } from '../options'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { children, loc } = node
    const { slotName, slotProps } = processSlotOutlet(node, context)

    const slotArgs: CallExpression['arguments'] = [
      context.prefixIdentifiers ? `_ctx.$slots` : `$slots`,
      slotName,
      '{}',
      'undefined',
      'true',
    ]
    let expectedLen = 2

    if (slotProps) {
      slotArgs[2] = slotProps
      expectedLen = 3
    }

    if (children.length) {
      slotArgs[3] = createFunctionExpression([], children, false, false, loc)
      expectedLen = 4
    }

    if (context.scopeId && !context.slotted) {
      expectedLen = 5
    }
    slotArgs.splice(expectedLen) // remove unused arguments

    node.codegenNode = createCallExpression(
      context.helper(RENDER_SLOT),
      slotArgs,
      loc,
    )
  }
}

interface SlotOutletProcessResult {
  slotName: string | ExpressionNode
  slotProps: PropsExpression | undefined
}

export function processSlotOutlet(
  node: SlotOutletNode,
  context: TransformContext,
): SlotOutletProcessResult {
  let slotName: string | ExpressionNode = `"default"`
  let slotProps: PropsExpression | undefined = undefined

  const nonNameProps = []
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.value) {
        if (p.name === 'name') {
          slotName = JSON.stringify(p.value.content)
        } else {
          p.name = camelize(p.name)
          nonNameProps.push(p)
        }
      }
    } else {
      if (p.name === 'bind' && isStaticArgOf(p.arg, 'name')) {
        if (p.exp) {
          slotName = p.exp
        } else if (p.arg && p.arg.type === NodeTypes.SIMPLE_EXPRESSION) {
          const name = camelize(p.arg.content)
          slotName = p.exp = createSimpleExpression(name, false, p.arg.loc)
          if (!__BROWSER__) {
            slotName = p.exp = processExpression(p.exp, context)
          }
        }
      } else {
        if (p.name === 'bind' && p.arg && isStaticExp(p.arg)) {
          p.arg.content = camelize(p.arg.content)
        }
        nonNameProps.push(p)
      }
    }
  }

  if (nonNameProps.length > 0) {
    const lazyEvalExps = new Set<JSChildNode>()
    if (context.bindingMetadata) {
      for (const p of nonNameProps) {
        if (
          p.type === NodeTypes.DIRECTIVE &&
          p.name === 'bind' &&
          p.arg &&
          p.exp &&
          p.exp.type === NodeTypes.SIMPLE_EXPRESSION
        ) {
          const originalIdent = p.exp.loc.source.trim()
          if (isSimpleIdentifier(originalIdent)) {
            const bindingType = context.bindingMetadata[originalIdent]
            if (
              bindingType === BindingTypes.SETUP_COMPUTED ||
              bindingType === BindingTypes.SETUP_MAYBE_REF ||
              bindingType === BindingTypes.SETUP_LET
            ) {
              lazyEvalExps.add(p.exp)
            }
          }
        }
      }
    }

    const { props, directives } = buildProps(
      node,
      context,
      nonNameProps,
      false,
      false,
    )
    slotProps = props

    if (lazyEvalExps.size > 0 && slotProps) {
      const propsObjects: ObjectExpression[] = []
      if (slotProps.type === NodeTypes.JS_OBJECT_EXPRESSION) {
        propsObjects.push(slotProps)
      } else if (slotProps.type === NodeTypes.JS_CALL_EXPRESSION) {
        if (
          slotProps.callee === NORMALIZE_PROPS &&
          slotProps.arguments[0] &&
          (slotProps.arguments[0] as any).type ===
            NodeTypes.JS_OBJECT_EXPRESSION
        ) {
          propsObjects.push(slotProps.arguments[0] as ObjectExpression)
        } else if (slotProps.callee === MERGE_PROPS) {
          for (const arg of slotProps.arguments) {
            if ((arg as any).type === NodeTypes.JS_OBJECT_EXPRESSION) {
              propsObjects.push(arg as ObjectExpression)
            }
          }
        }
      }
      for (const propsObject of propsObjects) {
        for (const prop of propsObject.properties) {
          if (prop.type === NodeTypes.JS_PROPERTY) {
            if (lazyEvalExps.has(prop.value)) {
              prop.isGetter = true
            }
          }
        }
      }
    }

    if (directives.length) {
      context.onError(
        createCompilerError(
          ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
          directives[0].loc,
        ),
      )
    }
  }

  return {
    slotName,
    slotProps,
  }
}
