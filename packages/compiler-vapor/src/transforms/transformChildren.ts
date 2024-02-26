import {
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
} from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  transformNode,
} from '../transform'
import { DynamicFlag, type IRDynamicInfo, IRNodeTypes } from '../ir'
import { extend } from '@vue/shared'
import { genDefaultDynamic } from './utils'

export const transformChildren: NodeTransform = (node, context) => {
  const isFragment =
    node.type === NodeTypes.ROOT ||
    (node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.TEMPLATE)

  if (!isFragment && node.type !== NodeTypes.ELEMENT) return

  for (const [i, child] of node.children.entries()) {
    const childContext = createContext(
      child,
      context as TransformContext<RootNode | ElementNode>,
      i,
    )
    transformNode(childContext)

    if (isFragment) {
      childContext.reference()
      childContext.registerTemplate()

      if (
        !(childContext.dynamic.flags & DynamicFlag.NON_TEMPLATE) ||
        childContext.dynamic.flags & DynamicFlag.INSERT
      ) {
        context.block.returns.push(childContext.dynamic.id!)
      }
    } else {
      context.childrenTemplate.push(childContext.template)
    }

    context.dynamic.children[i] = childContext.dynamic
  }

  if (!isFragment) {
    processDynamicChildren(context as TransformContext<ElementNode>)
  }
}

function processDynamicChildren(context: TransformContext<ElementNode>) {
  let prevDynamics: IRDynamicInfo[] = []
  let hasStaticTemplate = false
  const children = context.dynamic.children

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      prevDynamics.push(child)
    }

    if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
      if (prevDynamics.length) {
        if (hasStaticTemplate) {
          context.childrenTemplate[index - prevDynamics.length] = `<!>`

          prevDynamics[0].flags -= DynamicFlag.NON_TEMPLATE
          const anchor = (prevDynamics[0].anchor = context.increaseId())

          context.registerOperation({
            type: IRNodeTypes.INSERT_NODE,
            elements: prevDynamics.map(child => child.id!),
            parent: context.reference(),
            anchor,
          })
        } else {
          context.registerOperation({
            type: IRNodeTypes.PREPEND_NODE,
            elements: prevDynamics.map(child => child.id!),
            parent: context.reference(),
          })
        }
        prevDynamics = []
      }
      hasStaticTemplate = true
    }
  }

  if (prevDynamics.length) {
    context.registerOperation({
      type: IRNodeTypes.INSERT_NODE,
      elements: prevDynamics.map(child => child.id!),
      parent: context.reference(),
    })
  }
}

function createContext<T extends TemplateChildNode>(
  node: T,
  parent: TransformContext<RootNode | ElementNode>,
  index: number,
): TransformContext<T> {
  return extend({}, parent, {
    node,
    parent,
    index,

    template: '',
    childrenTemplate: [],
    dynamic: genDefaultDynamic(),
  } satisfies Partial<TransformContext<T>>) satisfies TransformContext<T>
}
