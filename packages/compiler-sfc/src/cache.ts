import LRU from 'lru-cache'

export function createCache<T>(size = 500) {
  return __GLOBAL__ || __ESM_BROWSER__
    ? new Map<string, T>()
    : (new LRU(size) as any as Map<string, T>)
}
