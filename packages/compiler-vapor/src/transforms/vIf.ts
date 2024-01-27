import {
  ElementTypes,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
  type TemplateNode,
} from '@vue/compiler-dom'
import {
  type TransformContext,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  type BlockFunctionIRNode,
  IRNodeTypes,
  type IfIRNode,
  type VaporDirectiveNode,
} from '../ir'
import { extend } from '@vue/shared'

export const transformVIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  processIf,
)

export function processIf(
  node: RootNode | TemplateChildNode,
  dir: VaporDirectiveNode,
  context: TransformContext<RootNode | TemplateChildNode>,
) {
  // TODO refactor this
  const parentContext = extend({}, context, {
    currentScopeIR: context.block,
  })

  if (dir.name === 'if') {
    const id = context.reference()
    context.dynamic.ghost = true
    const [branch, onExit] = createIfBranch(node, dir, context)
    const operation: IfIRNode = {
      type: IRNodeTypes.IF,
      id,
      loc: dir.loc,
      condition: dir.exp!,
      positive: branch,
    }
    parentContext.registerOperation(operation)
    return onExit
  }
}

export function createIfBranch(
  node: RootNode | TemplateChildNode,
  dir: VaporDirectiveNode,
  context: TransformContext<RootNode | TemplateChildNode>,
): [BlockFunctionIRNode, () => void] {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType !== ElementTypes.TEMPLATE
  ) {
    node = extend({}, node, {
      tagType: ElementTypes.TEMPLATE,
      children: [node],
    } as TemplateNode)
    context.node = node
  }

  const branch: BlockFunctionIRNode = {
    type: IRNodeTypes.BLOCK_FUNCTION,
    loc: dir.loc,
    node: node,
    templateIndex: -1,
    dynamic: {
      id: null,
      referenced: true,
      ghost: true,
      placeholder: null,
      children: {},
    },
    effect: [],
    operation: [],
  }

  const exitBlock = context.enterBlock(branch)
  context.reference()
  const onExit = () => {
    context.template += context.childrenTemplate.join('')
    context.registerTemplate()
    exitBlock()
  }
  return [branch, onExit]
}
