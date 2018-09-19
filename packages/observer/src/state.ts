import { Autorun } from './autorun'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
export type Dep = Set<Autorun>
export type KeyToDepMap = Map<string | symbol, Dep>
export const targetMap: WeakMap<any, KeyToDepMap> = new WeakMap()

// WeakMaps that store {raw <-> observed} pairs.
export const rawToObserved: WeakMap<any, any> = new WeakMap()
export const observedToRaw: WeakMap<any, any> = new WeakMap()
export const rawToImmutable: WeakMap<any, any> = new WeakMap()
export const immutableToRaw: WeakMap<any, any> = new WeakMap()

// WeakSets for values that are marked immutable or non-reactive during
// observable creation.
export const immutableValues: WeakSet<any> = new WeakSet()
export const nonReactiveValues: WeakSet<any> = new WeakSet()
