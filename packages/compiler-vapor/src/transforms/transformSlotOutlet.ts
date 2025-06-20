import {
  type AttributeNode,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
  isStaticArgOf,
  isStaticExp,
} from '@vue/compiler-dom'
import type { NodeTransform, TransformContext } from '../transform'
import {
  type BlockIRNode,
  type DirectiveIRNode,
  DynamicFlag,
  IRNodeTypes,
  type IRProps,
  type VaporDirectiveNode,
} from '../ir'
import { camelize, extend } from '@vue/shared'
import { newBlock } from './utils'
import { buildProps } from './transformElement'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT || node.tag !== 'slot') {
    return
  }
  const id = context.reference()
  context.dynamic.flags |= DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE
  const [fallback, exitBlock] = createFallback(
    node,
    context as TransformContext<ElementNode>,
  )

  let slotName: SimpleExpressionNode | undefined
  const slotProps: (AttributeNode | VaporDirectiveNode)[] = []
  for (const prop of node.props as (AttributeNode | VaporDirectiveNode)[]) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (prop.value) {
        if (prop.name === 'name') {
          slotName = createSimpleExpression(prop.value.content, true, prop.loc)
        } else {
          slotProps.push(extend({}, prop, { name: camelize(prop.name) }))
        }
      }
    } else if (prop.name === 'bind' && isStaticArgOf(prop.arg, 'name')) {
      if (prop.exp) {
        slotName = prop.exp!
      } else {
        // v-bind shorthand syntax
        slotName = createSimpleExpression(
          camelize(prop.arg!.content),
          false,
          prop.arg!.loc,
        )
        slotName.ast = null
      }
    } else {
      let slotProp = prop
      if (
        slotProp.name === 'bind' &&
        slotProp.arg &&
        isStaticExp(slotProp.arg)
      ) {
        slotProp = extend({}, prop, {
          arg: extend({}, slotProp.arg, {
            content: camelize(slotProp.arg!.content),
          }),
        })
      }
      slotProps.push(slotProp)
    }
  }

  slotName ||= createSimpleExpression('default', true)
  let irProps: IRProps[] = []
  if (slotProps.length) {
    const [isDynamic, props] = buildProps(
      extend({}, node, { props: slotProps }),
      context as TransformContext<ElementNode>,
      true,
    )
    irProps = isDynamic ? props : [props]

    const runtimeDirective = context.block.operation.find(
      (oper): oper is DirectiveIRNode =>
        oper.type === IRNodeTypes.DIRECTIVE && oper.element === id,
    )
    if (runtimeDirective) {
      context.options.onError(
        createCompilerError(
          ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
          runtimeDirective.dir.loc,
        ),
      )
    }
  }

  return () => {
    exitBlock && exitBlock()
    context.dynamic.operation = {
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id,
      name: slotName,
      props: irProps,
      fallback,
    }
  }
}

function createFallback(
  node: ElementNode,
  context: TransformContext<ElementNode>,
): [block?: BlockIRNode, exit?: () => void] {
  if (!node.children.length) {
    return []
  }

  context.node = node = extend({}, node, {
    type: NodeTypes.ELEMENT,
    tag: 'template',
    props: [],
    tagType: ElementTypes.TEMPLATE,
    children: node.children,
  })

  const fallback = newBlock(node)
  const exitBlock = context.enterBlock(fallback)
  context.reference()
  return [fallback, exitBlock]
}
