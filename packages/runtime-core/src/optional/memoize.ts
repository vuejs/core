// Used for memoizing trees inside render functions.
//
// Example (equivalent of v-once):
//
//   render() {
//     return memoize(h('div', this.msg), this, 0)
//   }
//
// Memoize baesd on keys:
//
//   render() {
//     return memoize(h('div', this.msg + this.count), this, 0, [this.msg])
//   }

import { Component } from '../component'
import { warn } from '../warning'

const memoizeMap = new WeakMap()

export function memoize<T>(
  getter: () => T,
  instance: Component,
  id: number,
  keys?: any[]
): T {
  if (__DEV__ && arguments.length > 3 && !Array.isArray(keys)) {
    warn(
      `keys passed to v-memo or memoize must be an array. Got ${String(keys)}`
    )
  }
  let storage = memoizeMap.get(instance)
  if (!storage) {
    storage = []
    memoizeMap.set(instance, storage)
  }
  const record = storage[id]
  if (!record) {
    const value = getter()
    storage[id] = [value, keys]
    return value
  } else {
    const [prevValue, prevKeys] = record
    record[1] = keys
    if (keys) {
      for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== prevKeys[i]) {
          return (record[0] = getter())
        }
      }
    }
    return prevValue
  }
}
