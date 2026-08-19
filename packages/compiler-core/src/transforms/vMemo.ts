import type { NodeTransform, TransformContext } from '../transform'
import { findDir, findProp } from '../utils'
import {
  type BlockCodegenNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type ForIteratorExpression,
  type ForNode,
  type ForRenderListExpression,
  type MemoExpression,
  NodeTypes,
  type PlainElementNode,
  convertToBlock,
  createBlockStatement,
  createCallExpression,
  createCompoundExpression,
  createFunctionExpression,
  createSimpleExpression,
} from '../ast'
import { IS_MEMO_SAME, WITH_MEMO } from '../runtimeHelpers'
import { createForLoopParams } from './vFor'

const seen = new WeakSet()

export const transformMemo: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const dir = findDir(node, 'memo')
    if (!dir || seen.has(node) || context.inSSR) {
      return
    }
    seen.add(node)

    return () => {
      // When the host element was also the target of v-for, it has been
      // replaced by a ForNode whose renderList call is complete by now
      // (v-for's exit callback runs before this one due to the transform
      // registration order). The memo cache must wrap the renderList
      // *iterator* instead of the element's own vnode, so rewrite the
      // finished iterator in place.
      if (context.currentNode && context.currentNode.type === NodeTypes.FOR) {
        rewriteForIterator(
          node,
          dir.exp!,
          context.currentNode as ForNode,
          context,
        )
        return
      }

      const codegenNode =
        node.codegenNode ||
        (context.currentNode as PlainElementNode).codegenNode
      if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
        // non-component sub tree should be turned into a block
        if (node.tagType !== ElementTypes.COMPONENT) {
          convertToBlock(codegenNode, context)
        }
        node.codegenNode = createCallExpression(context.helper(WITH_MEMO), [
          dir.exp!,
          createFunctionExpression(undefined, codegenNode),
          `_cache`,
          String(context.cached.length),
        ]) as MemoExpression
        // increment cache count
        context.cached.push(null)
      }
    }
  }
}

function rewriteForIterator(
  node: ElementNode,
  memoExp: ExpressionNode,
  forNode: ForNode,
  context: TransformContext,
): void {
  const renderList = forNode.codegenNode!.children as ForRenderListExpression
  const childBlock = (renderList.arguments[1] as ForIteratorExpression)
    .returns as BlockCodegenNode

  // the key expression has been processed by the time this runs (during
  // <template v-for> entry for templates, or during child traversal
  // otherwise)
  const keyProp = findProp(node, `key`, false, true)
  const keyExp =
    keyProp && keyProp.type === NodeTypes.ATTRIBUTE
      ? keyProp.value
        ? createSimpleExpression(keyProp.value.content, true)
        : undefined
      : keyProp
        ? keyProp.exp
        : undefined

  const loop = createFunctionExpression(
    createForLoopParams(forNode.parseResult, [
      createSimpleExpression(`_cached`),
    ]),
  )
  loop.body = createBlockStatement([
    createCompoundExpression([`const _memo = (`, memoExp, `)`]),
    createCompoundExpression([
      `if (_cached && _cached.el`,
      ...(keyExp ? [` && _cached.key === `, keyExp] : []),
      ` && ${context.helperString(
        IS_MEMO_SAME,
      )}(_cached, _memo)) return _cached`,
    ]),
    createCompoundExpression([`const _item = `, childBlock as any]),
    createSimpleExpression(`_item.memo = _memo`),
    createSimpleExpression(`return _item`),
  ])
  renderList.arguments.splice(
    1,
    1,
    loop as ForIteratorExpression,
    createSimpleExpression(`_cache`),
    createSimpleExpression(String(context.cached.length)),
  )
  // increment cache count
  context.cached.push(null)
}
