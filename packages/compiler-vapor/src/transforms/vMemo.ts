import { NodeTypes, findDir } from '@vue/compiler-dom'
import { VaporErrorCodes, createVaporCompilerError } from '../errors'
import type { NodeTransform } from '../transform'

export const transformVMemo: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return
  const memo = findDir(node, 'memo', true)
  if (memo) {
    context.options.onWarn(
      createVaporCompilerError(
        VaporErrorCodes.X_V_MEMO_NOT_SUPPORTED,
        memo.loc,
      ),
    )
  }
}
