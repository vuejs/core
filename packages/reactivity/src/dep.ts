import type { ComputedRefImpl } from './computed'
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
    startBatch()
    try {
      for (let link = this.subs; link !== undefined; link = link.prevSub) {
        link.sub.notify()
      }
    } finally {
      endBatch()
    }
  }
}
