import { CollectionUnwrapRefs } from './dist/reactivity'

export * from './dist/reactivity'

declare global {
  interface Map<K, V> {
    get<T extends ThisType<Map<K, V>>>(this: T, key: K): CollectionUnwrapRefs<T, V> | undefined
    forEach<T extends ThisType<Map<K, V>>>(this: T, callbackfn: (value: CollectionUnwrapRefs<T, V>, key: CollectionUnwrapRefs<T, K>, map: T) => void, thisArg?: any): void;
  }
  interface WeakMap<K, V> {
    get<T extends ThisType<WeakMap<K, V>>>(this: T, key: K): CollectionUnwrapRefs<T, V> | undefined
    forEach<T extends ThisType<WeakMap<K, V>>>(this: T, callbackfn: (value: CollectionUnwrapRefs<T, V>, key: CollectionUnwrapRefs<T, K>, map: T) => void, thisArg?: any): void;
  }
  interface Set<T> {
    forEach<TT extends ThisType<Set<T>>>(this: TT, callbackfn: (value1: CollectionUnwrapRefs<TT, T>, value2: CollectionUnwrapRefs<TT, T>, set: TT) => void, thisArg?: any): void;
  }
  interface WeakSet<T> {
    forEach<TT extends ThisType<WeakSet<T>>>(this: TT, callbackfn: (value1: CollectionUnwrapRefs<TT, T>, value2: CollectionUnwrapRefs<TT, T>, set: TT) => void, thisArg?: any): void;
  }
}
