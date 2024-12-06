/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */

/*! #__NO_SIDE_EFFECTS__ */

import { Empty } from './general'

export function makeMap(str: string): (key: string) => boolean {
  const map = new Empty()
  for (const key of str.split(',')) map[key] = 1
  return val => val in map
}
