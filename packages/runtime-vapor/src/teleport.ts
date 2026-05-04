import type { LooseRawProps, LooseRawSlots } from './component'
import type { TeleportFragment } from './components/Teleport'

type VaporTeleportLike = {
  process(props: LooseRawProps, slots?: LooseRawSlots | null): TeleportFragment
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
  return !!(value && (value as any).__isTeleportFragment)
}
