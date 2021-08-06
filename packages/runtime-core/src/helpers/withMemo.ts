import { currentBlock, isBlockTreeEnabled, VNode } from '../vnode'

export function withMemo(
  memo: any[],
  render: () => VNode<any, any>,
  cache: any[],
  index: number
) {
  const cached = cache[index] as VNode | undefined
  if (cached && isMemoSame(cached, memo)) {
    return cached
  }
  const ret = render()
  ret.memo = memo
  return (cache[index] = ret)
}

export function isMemoSame(cached: VNode | undefined, memo: any[]) {
  if (!cached) return false

  const prev: any[] = cached.memo!
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== memo[i]) {
      return false
    }
  }

  // make sure to let parent block track it when returning cached
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(cached)
  }
  return true
}
