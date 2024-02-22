import { isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import { ComputedRefImpl } from './computed'
import { type TrackOpTypes, TriggerOpTypes } from './constants'
import { Flags, type Link, activeSub, endBatch, startBatch } from './effect'

export class Dep {
  version = 0
  /**
   * Link between this dep and the current active effect
   */
  activeLink?: Link = undefined
  /**
   * Doubly linked list representing the subscribing effects (tail)
   */
  subs?: Link = undefined

  constructor(public computed?: ComputedRefImpl) {}

  track(): Link | undefined {
    if (activeSub === undefined) {
      return
    }

    let link = this.activeLink
    if (link === undefined || link.sub !== activeSub) {
      link = this.activeLink = {
        dep: this,
        sub: activeSub,
        version: this.version,
        nextDep: undefined,
        prevDep: activeSub.deps,
        nextSub: undefined,
        prevSub: undefined,
        prevActiveLink: undefined,
      }

      // add the link to the activeEffect as a dep (as tail)
      if (activeSub.deps) {
        activeSub.deps.nextDep = link
      }
      activeSub.deps = link

      // add the link to this dep as a subscriber (as tail)
      if (activeSub.flags & Flags.TRACKING) {
        const computed = this.computed
        if (computed && !this.subs) {
          // a computed dep getting its first subscriber, enable tracking +
          // lazily subscribe to all its deps
          computed.flags |= Flags.TRACKING | Flags.DIRTY
          for (let l = computed.deps; l !== undefined; l = l.nextDep) {
            l.dep.addSub(l)
          }
        }
        this.addSub(link)
      }
    } else if (link.version === -1) {
      // reused from last run - already a sub, just sync version
      link.version = this.version

      // If this dep has a next, it means it's not at the tail - move it to the
      // tail. This ensures the effect's dep list is in the order they are
      // accessed during evaluation.
      if (link.nextDep) {
        link.nextDep.prevDep = link.prevDep
        if (link.prevDep) {
          link.prevDep.nextDep = link.nextDep
        }

        link.prevDep = activeSub.deps
        link.nextDep = undefined

        activeSub.deps!.nextDep = link
        activeSub.deps = link
      }
    }
    return link
  }

  addSub(link: Link) {
    if (this.subs !== link) {
      link.prevSub = this.subs
      if (this.subs) {
        this.subs.nextSub = link
      }
      this.subs = link
    }
  }

  trigger() {
    this.version++
    this.notify()
  }

  notify() {
    if (!(activeSub instanceof ComputedRefImpl)) {
      startBatch()
      try {
        for (let link = this.subs; link !== undefined; link = link.prevSub) {
          link.sub.notify()
        }
      } finally {
        endBatch()
      }
    } else if (__DEV__) {
      // reactive side effect triggered during computed evaluation
      // TODO warning
    }
  }
}

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Maps to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<object, KeyToDepMap>()

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map iterate' : '')

export let shouldTrack = true
export let pauseScheduleStack = 0

const trackStack: boolean[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

/**
 * Tracks access to a reactive property.
 *
 * This will check which effect is running at the moment and record it as dep
 * which records all effects that depend on the reactive property.
 *
 * @param target - Object holding the reactive property.
 * @param type - Defines the type of access to the reactive property.
 * @param key - Identifier of the reactive property to track.
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Dep()))
    }
    // TODO track info
    dep.track()
  }
}

/**
 * Finds all deps associated with the target (or a specific property) and
 * triggers the effects stored within.
 *
 * @param target - The reactive object.
 * @param type - Defines the type of the operation that needs to trigger effects.
 * @param key - Can be used to target a specific reactive property in the target object.
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      if (key === 'length' || (!isSymbol(key) && key >= newLength)) {
        deps.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  for (const dep of deps) {
    if (dep) {
      dep.trigger()
      // triggerEffects(
      //   dep,
      //   DirtyLevels.Dirty,
      //   __DEV__
      //     ? {
      //         target,
      //         type,
      //         key,
      //         newValue,
      //         oldValue,
      //         oldTarget,
      //       }
      //     : void 0,
      // )
    }
  }
}

export function getDepFromReactive(object: any, key: string | number | symbol) {
  return targetMap.get(object)?.get(key)
}
