export function createCache<T>(size = 500) {
  return __GLOBAL__ || __ESM_BROWSER__
    ? new Map<string, T>()
    : (new (require('lru-cache'))(size) as Map<string, T>)
}
