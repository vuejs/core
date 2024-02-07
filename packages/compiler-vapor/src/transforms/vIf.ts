import {
  type ElementNode,
  ErrorCodes,
  NodeTypes,
  type TemplateChildNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import {
  type TransformContext,
  createStructuralDirectiveTransform,
  genDefaultDynamic,
  wrapTemplate,
} from '../transform'
import {
  type BlockFunctionIRNode,
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  type OperationNode,
  type VaporDirectiveNode,
} from '../ir'
import { extend } from '@vue/shared'

export const transformVIf = createStructuralDirectiveTransform(
  ['if', 'else', 'else-if'],
  processIf,
)

export function processIf(
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
) {
  if (dir.name !== 'else' && (!dir.exp || !dir.exp.content.trim())) {
    const loc = dir.exp ? dir.exp.loc : node.loc
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc),
    )
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE
  if (dir.name === 'if') {
    const id = context.reference()
    context.dynamic.flags |= DynamicFlag.INSERT
    const [branch, onExit] = createIfBranch(node, context)

    return () => {
      onExit()
      context.registerOperation({
        type: IRNodeTypes.IF,
        id,
        condition: dir.exp!,
        positive: branch,
      })
    }
  } else {
    // check the adjacent v-if
    const parent = context.parent!
    const siblings = parent.node.children
    const templates = parent.childrenTemplate
    const siblingsDynamic = parent.dynamic.children

    const comments = []
    let sibling: TemplateChildNode | undefined
    let i = siblings.indexOf(node)
    while (i-- >= -1) {
      sibling = siblings[i]

      if (
        sibling &&
        (sibling.type === NodeTypes.COMMENT ||
          (sibling.type === NodeTypes.TEXT && !sibling.content.trim().length))
      ) {
        if (__DEV__ && sibling.type === NodeTypes.COMMENT)
          comments.unshift(sibling)
        siblingsDynamic[i].flags |= DynamicFlag.NON_TEMPLATE
        templates[i] = null
      } else {
        break
      }
    }

    const { operation } = context.block
    let lastIfNode: OperationNode
    if (
      // check if v-if is the sibling node
      !sibling ||
      sibling.type !== NodeTypes.ELEMENT ||
      !sibling.props.some(
        ({ type, name }) =>
          type === NodeTypes.DIRECTIVE && ['if', 'else-if'].includes(name),
      ) ||
      // check if IFNode is the last operation and get the root IFNode
      !(lastIfNode = operation[operation.length - 1]) ||
      lastIfNode.type !== IRNodeTypes.IF
    ) {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
      )
      return
    }

    while (lastIfNode.negative && lastIfNode.negative.type === IRNodeTypes.IF) {
      lastIfNode = lastIfNode.negative
    }

    // Check if v-else was followed by v-else-if
    if (dir.name === 'else-if' && lastIfNode.negative) {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
      )
    }

    // TODO ignore comments if the v-if is direct child of <transition> (PR #3622)
    if (__DEV__ && comments.length) {
      node = wrapTemplate(node, ['else-if', 'else'])
      context.node = node = extend({}, node, {
        children: [...comments, ...node.children],
      })
    }

    const [branch, onExit] = createIfBranch(node, context)

    if (dir.name === 'else') {
      lastIfNode.negative = branch
    } else {
      lastIfNode.negative = {
        type: IRNodeTypes.IF,
        id: -1,
        condition: dir.exp!,
        positive: branch,
      }
    }

    return () => onExit()
  }
}

export function createIfBranch(
  node: ElementNode,
  context: TransformContext<ElementNode>,
): [BlockFunctionIRNode, () => void] {
  context.node = node = wrapTemplate(node, ['if', 'else-if', 'else'])

  const branch: BlockFunctionIRNode = {
    type: IRNodeTypes.BLOCK_FUNCTION,
    node,
    templateIndex: -1,
    dynamic: extend(genDefaultDynamic(), {
      flags: DynamicFlag.REFERENCED,
    } satisfies Partial<IRDynamicInfo>),
    effect: [],
    operation: [],
  }

  const exitBlock = context.enterBlock(branch)
  context.reference()
  const onExit = () => {
    context.registerTemplate()
    exitBlock()
  }
  return [branch, onExit]
}
