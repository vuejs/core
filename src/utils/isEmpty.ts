import { IsEmptyOptions } from '../types'

export function isEmpty(value: any, options: IsEmptyOptions = {}): boolean {
  const { strict = true, ignoreWhitespace = true } = options

  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === 'string') {
    return ignoreWhitespace ? value.trim().length === 0 : value.length === 0
  }

  if (Array.isArray(value)) {
    return strict ? value.length === 0 : value.every(item => isEmpty(item, options))
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  if (typeof value === 'number') {
    return false
  }

  return !value
}
