import {
  Dep,
  Flags,
  type Link,
  type ReactiveEffect,
  type Subscriber,
  refreshComputed,
} from './effect'
import type { Ref } from './ref'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export class ComputedRefImpl implements Subscriber {
  // A computed is a ref
  _value: any = undefined
  dep: Dep
  // A computed is also a subscriber that tracks other deps
  deps?: Link = undefined
  // track variaous states
  flags = Flags.DIRTY

  constructor(public getter: ComputedGetter<any>) {
    this.dep = new Dep(this)
  }

  notify() {
    if (!(this.flags & Flags.NOTIFIED)) {
      this.flags |= Flags.DIRTY | Flags.NOTIFIED
      this.dep.notify()
    }
  }

  get value() {
    const link = this.dep.track()
    refreshComputed(this)
    // sync version after evaluation
    if (link) {
      link.version = this.dep.version
    }
    return this._value
  }
}

export function computed<T>(getter: ComputedGetter<T>) {
  return new ComputedRefImpl(getter)
}
