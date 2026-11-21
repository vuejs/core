import { remove } from '@vue/shared'
import { queuePostFlushCb } from '@vue/runtime-dom'
import type { LooseRawProps } from './component'
import type { RawSlots } from './componentSlots'
import type { TeleportFragment } from './components/Teleport'
import { TELEPORT } from './fragmentFlags'

type VaporTeleportLike = {
  process(
    props: LooseRawProps,
    slots?: RawSlots | null,
    adoptAnchor?: Node,
  ): TeleportFragment
}

export let isTeleportEnabled = false

export function enableTeleport<T>(value: T): T {
  isTeleportEnabled = true
  return value
}

export function isVaporTeleport(value: unknown): value is VaporTeleportLike {
  return !!(value && (value as any).__isTeleport && (value as any).__vapor)
}

export function isTeleportFragment(value: unknown): value is TeleportFragment {
  return !!(value && (value as any).__vf & TELEPORT)
}

export type TeleportHost = Node & { $tp?: TeleportFragment[] }

// vdom components created by a vapor render but not mounted yet: they mount
// on insertion, so a teleport in them is created then. A vapor teleport
// created after one waits for it: it does not claim its target place on
// creation, and mounts (or queues its deferred mount) after it. One not
// inserted by the end of the flush (discarded, or cached by a KeepAlive) is
// not waited on.
const pendingVdomMounts = new Set<object>()
let clearQueued = false

// the last vdom component created that has not mounted yet
export function lastPendingVdomMount(): object | undefined {
  let last: object | undefined
  for (const key of pendingVdomMounts) last = key
  return last
}

export function isVdomMountPending(key: object): boolean {
  return pendingVdomMounts.has(key)
}

export function addPendingVdomMount(key: object): void {
  pendingVdomMounts.add(key)
  if (!clearQueued) {
    clearQueued = true
    queuePostFlushCb(clearPendingVdomMounts)
  }
}

export function settlePendingVdomMount(key: object): void {
  pendingVdomMounts.delete(key)
}

// work held back until a vdom component has mounted, in the order it was
// held back: the queued mount of a deferred teleport created after it
let vdomMountWaiters: { key: object; fn: () => void }[] | undefined

export function afterVdomMount(key: object, fn: () => void): void {
  ;(vdomMountWaiters || (vdomMountWaiters = [])).push({ key, fn })
}

// a pending vdom component has mounted
export function finishVdomMount(): void {
  const waiters = vdomMountWaiters
  if (!waiters) return
  const ready = waiters.filter(w => !pendingVdomMounts.has(w.key))
  if (!ready.length) return
  const rest = waiters.filter(w => pendingVdomMounts.has(w.key))
  vdomMountWaiters = rest.length ? rest : undefined
  for (const w of ready) w.fn()
}

function clearPendingVdomMounts(): void {
  clearQueued = false
  pendingVdomMounts.clear()
  finishVdomMount()
}

// A teleport inserted into a detached element waits on that element's
// topmost ancestor and mounts when the ancestor enters the document, at the
// position vdom would mount it.
export let waitingTeleports = 0
// set while a teleport mounts its content before its own source is in the
// document: teleports waiting in that content wait for the source instead
export let earlyHost: TeleportHost | undefined

export function setEarlyHost(
  host: TeleportHost | undefined,
): TeleportHost | undefined {
  const prev = earlyHost
  earlyHost = host
  return prev
}

export function waitForConnect(
  teleport: TeleportFragment,
  host: TeleportHost,
): void {
  ;(host.$tp || (host.$tp = [])).push(teleport)
  teleport.connectHost = host
  waitingTeleports++
}

export function stopWaiting(teleport: TeleportFragment): void {
  const host = teleport.connectHost
  if (!host) return
  teleport.connectHost = undefined
  waitingTeleports--
  const list = host.$tp
  if (list) {
    remove(list, teleport)
    if (!list.length) host.$tp = undefined
  }
}

// `node` was inserted into `parent`
export function connectTeleports(node: TeleportHost, parent: ParentNode): void {
  const list = node.$tp!
  node.$tp = undefined
  const host: TeleportHost | undefined =
    earlyHost || (parent.isConnected ? undefined : parent.getRootNode())
  if (host) {
    const hostList = host.$tp || (host.$tp = [])
    for (const teleport of list) {
      teleport.connectHost = host
      hostList.push(teleport)
    }
  } else {
    for (const teleport of list) teleport.connect()
  }
}
