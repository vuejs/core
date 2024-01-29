import {
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
  type TemplateNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import {
  type TransformContext,
  createStructuralDirectiveTransform,
  genDefaultDynamic,
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
  context: TransformContext<RootNode | TemplateChildNode>,
) {
  if (dir.name !== 'else' && (!dir.exp || !dir.exp.content.trim())) {
    const loc = dir.exp ? dir.exp.loc : node.loc
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc),
    )
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  if (dir.name === 'if') {
    const id = context.reference()
    context.dynamic.dynamicFlags |= DynamicFlag.INSERT
    const [branch, onExit] = createIfBranch(node, context)

    return () => {
      onExit()
      context.registerOperation({
        type: IRNodeTypes.IF,
        id,
        loc: dir.loc,
        condition: dir.exp!,
        positive: branch,
      })
    }
  } else {
    context.dynamic.dynamicFlags |= DynamicFlag.NON_TEMPLATE

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
        siblingsDynamic[i].dynamicFlags |= DynamicFlag.NON_TEMPLATE
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
      node = wrapTemplate(node)
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
        loc: dir.loc,
        condition: dir.exp!,
        positive: branch,
      }
    }

    return () => onExit()
  }
}

export function createIfBranch(
  node: ElementNode,
  context: TransformContext<RootNode | TemplateChildNode>,
): [BlockFunctionIRNode, () => void] {
  context.node = node = wrapTemplate(node)

  const branch: BlockFunctionIRNode = {
    type: IRNodeTypes.BLOCK_FUNCTION,
    loc: node.loc,
    node,
    templateIndex: -1,
    dynamic: extend(genDefaultDynamic(), {
      dynamicFlags: DynamicFlag.REFERENCED | DynamicFlag.INSERT,
    } satisfies Partial<IRDynamicInfo>),
    effect: [],
    operation: [],
  }

  const exitBlock = context.enterBlock(branch)
  context.reference()
  const onExit = () => {
    context.template += context.childrenTemplate.filter(Boolean).join('')
    context.registerTemplate()
    exitBlock()
  }
  return [branch, onExit]
}

function wrapTemplate(node: ElementNode): TemplateNode {
  if (node.tagType === ElementTypes.TEMPLATE) {
    return node
  }
  return extend({}, node, {
    type: NodeTypes.ELEMENT,
    tag: 'template',
    props: [],
    tagType: ElementTypes.TEMPLATE,
    children: [
      extend({}, node, {
        props: node.props.filter(
          p => p.type !== NodeTypes.DIRECTIVE && p.name !== 'if',
        ),
      } as TemplateChildNode),
    ],
  } as Partial<TemplateNode>)
}
