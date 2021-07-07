import { ReactiveEffect, getTrackOpBit } from './effect'

export type Dep = Set<ReactiveEffect> & TrackedMarkers

/**
 * wasTracked and newTracked maintain the status for several levels of effect
 * tracking recursion. One bit per level is used to define wheter the dependency
 * was/is tracked.
 */
type TrackedMarkers = { wasTracked: number; newTracked: number }

export function createDep(effects?: ReactiveEffect[]): Dep {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  dep.wasTracked = 0
  dep.newTracked = 0
  return dep
}

export function wasTracked(dep: Dep): boolean {
  return hasBit(dep.wasTracked, getTrackOpBit())
}

export function newTracked(dep: Dep): boolean {
  return hasBit(dep.newTracked, getTrackOpBit())
}

export function setWasTracked(dep: Dep) {
  dep.wasTracked = setBit(dep.wasTracked, getTrackOpBit())
}

export function setNewTracked(dep: Dep) {
  dep.newTracked = setBit(dep.newTracked, getTrackOpBit())
}

export function resetTracked(dep: Dep) {
  const trackOpBit = getTrackOpBit()
  dep.wasTracked = clearBit(dep.wasTracked, trackOpBit)
  dep.newTracked = clearBit(dep.newTracked, trackOpBit)
}

function hasBit(value: number, bit: number): boolean {
  return (value & bit) > 0
}

function setBit(value: number, bit: number): number {
  return value | bit
}

function clearBit(value: number, bit: number): number {
  return value & ~bit
}
