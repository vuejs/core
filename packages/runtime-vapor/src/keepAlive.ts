import type { EffectScope } from '@vue/reactivity'
import type { Block } from './block'
import type { DynamicFragment } from './fragment'

export interface VaporKeepAliveContext {
  // pre-render: hand back the kept-alive scope for a branch key, if any
  acquireBranchScope(key: any): EffectScope | undefined
  // wraps a DynamicFragment branch render: sets up the keyed cache-key
  // context and marks shape flags once the render settles
  runBranchRender(frag: DynamicFragment, fn: () => void): void
  // marks shape flags at component / interop boundaries
  processShapeFlag(block: Block): any | false
  cacheBlock(block?: Block): void
  cacheScope(cacheKey: any, scopeLookupKey: any, scope: EffectScope): void
}

export let isKeepAliveEnabled = false
export let currentKeepAliveCtx: VaporKeepAliveContext | null = null
export let currentCacheKey: any | undefined

export function enableKeepAlive(): void {
  isKeepAliveEnabled = true
}

export function withKeepAliveEnabled<T>(value: T): T {
  enableKeepAlive()
  return value
}

export function setCurrentKeepAliveCtx(
  ctx: VaporKeepAliveContext | null,
): VaporKeepAliveContext | null {
  try {
    return currentKeepAliveCtx
  } finally {
    currentKeepAliveCtx = ctx
  }
}

export function withCurrentCacheKey<T>(key: any, fn: () => T): T {
  const prev = currentCacheKey
  currentCacheKey = key
  try {
    return fn()
  } finally {
    currentCacheKey = prev
  }
}
