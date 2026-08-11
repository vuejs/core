import {
  type GenericComponentInstance,
  isAsyncWrapper,
  isKeepAlive,
} from '@vue/runtime-dom'
import type { EffectScope } from '@vue/reactivity'
import type { Block } from './block'
import type { DynamicFragment } from './fragment'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'

export interface VaporKeepAliveContext {
  isolatePropSources(rawProps: RawProps): RawProps
  isolateSlotSources(rawSlots: RawSlots): RawSlots
  // caches or stops the outgoing branch scope and returns whether its DOM
  // removal must wait for the incoming cache decision
  prepareBranchRemoval(frag: DynamicFragment, scope: EffectScope): boolean
  // acquires the incoming branch scope, sets up the keyed cache-key context,
  // marks shape flags, then runs any deferred outgoing removal
  runBranchRender(
    frag: DynamicFragment,
    fn: () => void,
    useScope: boolean,
    removePrevious?: () => void,
  ): void
  // marks shape flags at component / interop boundaries
  processShapeFlag(block: Block): any | false
  cacheBlock(block?: Block): void
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
