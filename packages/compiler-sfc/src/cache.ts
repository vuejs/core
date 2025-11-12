import { LRUCache } from 'lru-cache'

export const COMPILER_CACHE_KEYS = {
  parse: 'parse',
  templateUsageCheck: 'templateUsageCheck',
  tsConfig: 'tsConfig',
  fileToScope: 'fileToScope',
} as const

type CacheKey = keyof typeof COMPILER_CACHE_KEYS
type CacheOptions = Partial<
  Record<CacheKey, LRUCache.Options<string, any, unknown>>
>

let cacheOptions: CacheOptions = Object.create(null)

export function createCache<T extends {}>(
  key: CacheKey,
): Map<string, T> | LRUCache<string, T> {
  /* v8 ignore next 3 */
  if (__GLOBAL__ || __ESM_BROWSER__) {
    return new Map<string, T>()
  }
  return new LRUCache<string, T>(cacheOptions[key] || { max: 500 })
}

/**
 * @private
 */
export function configureCacheOptions(options: CacheOptions = {}): void {
  cacheOptions = options
}
