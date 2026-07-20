import {
  type GenericComponentInstance,
  isAsyncWrapper,
  isKeepAlive,
} from '@vue/runtime-dom'
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
  getStorageContainer(): ParentNode
}

export let isKeepAliveEnabled = false
export let currentCacheKey: any | undefined

export function enableKeepAlive(): void {
  isKeepAliveEnabled = true
}

export function withKeepAliveEnabled<T>(value: T): T {
  enableKeepAlive()
  return value
}

export function getKeepAliveContext(
  instance: GenericComponentInstance | null,
): VaporKeepAliveContext | null {
  let owner = instance
  // Async wrappers are transparent for KeepAlive context lookup: their setup
  // and resolved renders still belong to the outer KeepAlive owner.
  while (owner && owner.vapor && isAsyncWrapper(owner)) {
    owner = owner.parent
  }

  return owner && owner.vapor && isKeepAlive(owner)
    ? (owner as GenericComponentInstance & { ctx: VaporKeepAliveContext }).ctx
    : null
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
