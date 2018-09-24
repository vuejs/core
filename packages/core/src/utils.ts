export const EMPTY_OBJ: { readonly [key: string]: any } = Object.freeze({})

export const isReservedProp = (key: string): boolean => {
  switch (key) {
    case 'key':
    case 'ref':
    case 'slots':
      return true
    default:
      return key.startsWith('nativeOn')
  }
}

export function normalizeStyle(
  value: any
): Record<string, string | number> | void {
  if (Array.isArray(value)) {
    const res: Record<string, string | number> = {}
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeStyle(value[i])
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (value && typeof value === 'object') {
    return value
  }
}

export function normalizeClass(value: any): string {
  let res = ''
  if (typeof value === 'string') {
    res = value
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      res += normalizeClass(value[i]) + ' '
    }
  } else if (typeof value === 'object') {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
export function lis(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i
  let j
  let u
  let v
  let c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = ((u + v) / 2) | 0
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
