import { isArray, isDate, isMap, isObject, isSet, isSymbol } from './general'

function looseCompareArrays(a: any[], b: any[]) {
  if (a.length !== b.length) return false
  let equal = true
  for (let i = 0; equal && i < a.length; i++) {
    equal = looseEqual(a[i], b[i])
  }
  return equal
}

function looseCompareCollections(
  a: Map<any, any> | Set<any>,
  b: Map<any, any> | Set<any>,
) {
  if (a.size !== b.size) return false
  const unmatched = Array.from(b)
  for (const item of a) {
    const index = unmatched.findIndex(other => looseEqual(item, other))
    if (index < 0) return false
    unmatched.splice(index, 1)
  }
  return true
}

export function looseEqual(a: any, b: any): boolean {
  if (a === b) return true
  let aValidType = isDate(a)
  let bValidType = isDate(b)
  if (aValidType || bValidType) {
    return aValidType && bValidType ? a.getTime() === b.getTime() : false
  }
  aValidType = isSymbol(a)
  bValidType = isSymbol(b)
  if (aValidType || bValidType) {
    return a === b
  }
  aValidType = isArray(a)
  bValidType = isArray(b)
  if (aValidType || bValidType) {
    return aValidType && bValidType ? looseCompareArrays(a, b) : false
  }
  aValidType = isObject(a)
  bValidType = isObject(b)
  if (aValidType || bValidType) {
    if (!aValidType || !bValidType) {
      return false
    }
    aValidType = isMap(a)
    bValidType = isMap(b)
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareCollections(a, b) : false
    }
    aValidType = isSet(a)
    bValidType = isSet(b)
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareCollections(a, b) : false
    }
    const aKeysCount = Object.keys(a).length
    const bKeysCount = Object.keys(b).length
    if (aKeysCount !== bKeysCount) {
      return false
    }
    for (const key in a) {
      const aHasKey = a.hasOwnProperty(key)
      const bHasKey = b.hasOwnProperty(key)
      if (
        (aHasKey && !bHasKey) ||
        (!aHasKey && bHasKey) ||
        !looseEqual(a[key], b[key])
      ) {
        return false
      }
    }
  }
  return String(a) === String(b)
}

export function looseIndexOf(arr: any[], val: any): number {
  return arr.findIndex(item => looseEqual(item, val))
}
