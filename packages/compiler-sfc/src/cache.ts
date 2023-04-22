import LRU from 'lru-cache'

export function createCache<T>(size = 500) {
  if (__GLOBAL__ || __ESM_BROWSER__) {
    return new Map<string, T>()
  }
  const cache = new LRU(size)
  // @ts-expect-error
  cache.delete = cache.del.bind(cache)
  return cache as any as Map<string, T>
}
