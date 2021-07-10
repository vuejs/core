import { currentBlock, isBlockTreeEnabled, VNode } from '../vnode'

export function withMemo(
  memo: any[],
  render: () => VNode,
  cache: any[],
  index: number
) {
  const cached = cache[index] as VNode | undefined
  if (cached && isMemoSame(cached.memo!, memo)) {
    // make sure to let parent block track it when returning cached
    if (isBlockTreeEnabled > 0 && currentBlock) {
      currentBlock.push(cached)
    }
    return cached
  }
  const ret = render()
  ret.memo = memo
  return (cache[index] = ret)
}

export function isMemoSame(prev: any[], next: any[]) {
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) {
      return false
    }
  }
  return true
}
