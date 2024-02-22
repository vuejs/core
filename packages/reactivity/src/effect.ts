import type { ComputedRefImpl } from './computed'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import type { Dep } from './dep'
import type { EffectScope } from './effectScope'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: Subscriber
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  scope?: EffectScope
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export let activeSub: Subscriber | undefined

export enum Flags {
  ACTIVE = 1 << 0,
  RUNNING = 1 << 1,
  TRACKING = 1 << 2,
  NOTIFIED = 1 << 3,
  DIRTY = 1 << 4,
  HAS_ERROR = 1 << 5,
}

/**
 * Subscriber is a type that tracks (or subscribes to) a list of deps.
 */
export interface Subscriber extends DebuggerOptions {
  /**
   * doubly linked list representing the deps
   * set to tail before effect run
   * points to tail during effect run
   * set to head after effect run
   */
  deps?: Link
  flags: Flags
  notify(): void
}

/**
 * Represents a link between a source (Dep) and a subscriber (Effect or Computed).
 * Deps and subs have a many-to-many relationship - each link between a
 * dep and a sub is represented by a Link instance.
 *
 * A Link is also a node in two doubly-linked lists - one for the associated
 * sub to track all its deps, and one for the associated dep to track all its
 * subs.
 */
export interface Link {
  dep: Dep
  sub: Subscriber

  /**
   * - Before each effect run, all previous dep links' version are reset to -1
   * - During the run, a link's version is synced with the source dep on access
   * - After the run, links with version -1 (that were never used) are cleaned
   *   up
   */
  version: number

  /**
   * Pointers for doubly-linked lists
   */
  nextDep?: Link
  prevDep?: Link

  nextSub?: Link
  prevSub?: Link

  prevActiveLink?: Link
}

export class ReactiveEffect<T = any> implements Subscriber {
  /**
   * @internal
   */
  deps?: Link = undefined
  /**
   * @internal
   */
  flags: Flags = Flags.ACTIVE | Flags.TRACKING
  /**
   * @internal
   */
  nextEffect?: ReactiveEffect = undefined
  /**
   * @internal
   */
  fn: () => T
  /**
   * @internal TODO
   */
  allowRecurse?: boolean

  scheduler?: EffectScheduler = undefined
  onStop?: () => void
  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  constructor(fn: () => T) {
    this.fn = fn
  }

  /**
   * @internal
   */
  notify() {
    if (!(this.flags & Flags.NOTIFIED)) {
      this.flags |= Flags.NOTIFIED
      this.nextEffect = batchedEffect
      batchedEffect = this
    }
  }

  run() {
    this.flags |= Flags.RUNNING

    // TODO cleanupEffect

    if (!(this.flags & Flags.ACTIVE)) {
      // stopped during cleanup
      return
    }

    prepareDeps(this)
    batchDepth++
    const prevEffect = activeSub
    activeSub = this

    try {
      return this.fn()
    } finally {
      // TODO make this dev only
      if (activeSub !== this) {
        throw new Error('active effect was not restored correctly')
      }
      cleanupDeps(this)
      activeSub = prevEffect
      this.flags &= ~Flags.RUNNING
      endBatch()
    }
  }

  stop() {
    if (this.flags & Flags.ACTIVE) {
      this.flags &= ~Flags.ACTIVE
      for (let link = this.deps; link !== undefined; link = link.nextDep) {
        removeSub(link)
      }
      this.deps = undefined
    }
  }
}

let batchDepth = 0
let batchedEffect: ReactiveEffect | undefined

export function startBatch() {
  batchDepth++
}

/**
 * Run batched effects when all batches have ended
 */
export function endBatch() {
  if (batchDepth > 1) {
    batchDepth--
    return
  }

  let error: unknown
  while (batchedEffect) {
    let e: ReactiveEffect | undefined = batchedEffect
    batchedEffect = undefined
    while (e) {
      const next: ReactiveEffect | undefined = e.nextEffect
      e.nextEffect = undefined
      e.flags &= ~Flags.NOTIFIED
      if (e.flags & Flags.ACTIVE && isDirty(e)) {
        try {
          if (e.scheduler) {
            e.scheduler()
          } else {
            e.run()
          }
        } catch (err) {
          if (!error) error = err
        }
      }
      e = next
    }
  }

  batchDepth--
  if (error) throw error
}

function prepareDeps(sub: Subscriber) {
  // Prepare deps for tracking, starting from the head
  for (let link = sub.deps; link !== undefined; link = link.nextDep) {
    // set all previous deps' (if any) version to -1 so that we can track
    // which ones are unused after the run
    link.version = -1
    // store previous active sub if link was being used in another context
    link.prevActiveLink = link.dep.activeLink
    link.dep.activeLink = link
    if (!link.nextDep) {
      // point deps to the tail
      sub.deps = link
      break
    }
  }
}

function cleanupDeps(sub: Subscriber) {
  // Cleanup unsued deps, starting from the tail
  let link = sub.deps
  let head
  while (link) {
    if (link.version === -1) {
      // unused - remove it from the dep's subscribing effect list
      removeSub(link)
      // also remove it from this effect's dep list
      removeDep(link)
    } else {
      // The new head is the last node seen which wasn't removed
      // from the doubly-linked list
      head = link
    }

    // restore previous active link if any
    link.dep.activeLink = link.prevActiveLink
    link.prevActiveLink = undefined

    link = link.prevDep
  }
  // set the new head
  sub.deps = head
}

function isDirty(sub: Subscriber): boolean {
  for (let link = sub.deps; link !== undefined; link = link.nextDep) {
    if (
      link.dep.version !== link.version ||
      (link.dep.computed && refreshComputed(link.dep.computed) === false) ||
      link.dep.version !== link.version
    ) {
      return true
    }
  }
  return false
}

/**
 * Returning false indicates the refresh failed
 */
export function refreshComputed(computed: ComputedRefImpl) {
  computed.flags &= ~Flags.NOTIFIED

  if (computed.flags & Flags.RUNNING) {
    return false
  }
  if (computed.flags & Flags.TRACKING && !(computed.flags & Flags.DIRTY)) {
    return
  }
  computed.flags &= ~Flags.DIRTY

  // TODO global version fast path

  const dep = computed.dep
  computed.flags |= Flags.RUNNING
  if (dep.version > 0 && !isDirty(computed)) {
    computed.flags &= ~Flags.RUNNING
    return
  }

  const prevSub = activeSub
  activeSub = computed
  try {
    prepareDeps(computed)
    const value = computed.getter()
    if (dep.version === 0 || !Object.is(value, computed._value)) {
      computed._value = value
      dep.version++
    }
  } catch (err) {
    // TODO error recovery?
    dep.version++
  }

  activeSub = prevSub
  cleanupDeps(computed)
  computed.flags &= ~Flags.RUNNING
}

function removeSub(link: Link) {
  const prevEffect = link.prevSub
  const nextEffect = link.nextSub
  if (prevEffect) {
    prevEffect.nextSub = nextEffect
    link.prevSub = undefined
  }
  if (nextEffect) {
    nextEffect.prevSub = prevEffect
    link.nextSub = undefined
  }
  if (link.dep.subs === link) {
    // was previous tail, point new tail to prev
    link.dep.subs = prevEffect
  }

  // computed dep has lost its last subscriber
  // turn off tracking flag and also unsubscribe it from all its deps
  const computed = link.dep.computed
  if (computed && link.dep.subs === undefined) {
    computed.flags &= ~Flags.TRACKING
    for (let l = computed.deps; l !== undefined; l = l.nextDep) {
      removeSub(l)
    }
  }
}

function removeDep(link: Link) {
  const prevDep = link.prevDep
  const nextDep = link.nextDep
  if (prevDep) {
    prevDep.nextDep = nextDep
    link.prevDep = undefined
  }
  if (nextDep) {
    nextDep.prevDep = prevDep
    link.nextDep = undefined
  }
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner<T> {
  const e = new ReactiveEffect(fn)
  try {
    e.run()
  } catch (err) {
    e.stop()
    throw err
  }
  const runner = e.run.bind(e) as ReactiveEffectRunner
  runner.effect = e
  return runner
}

/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}
