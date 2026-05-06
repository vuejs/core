import type { EffectScope } from '@vue/reactivity'
import type { Block } from './block'

export interface VaporKeepAliveContext {
  processShapeFlag(block: Block): any | false
  cacheBlock(block?: Block): void
  cacheScope(cacheKey: any, scopeLookupKey: any, scope: EffectScope): void
  getScope(key: any): EffectScope | undefined
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
