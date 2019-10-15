/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
export const makeMap = (
  str: string | string[],
  expectsLowerCase?: boolean
): ((key: string) => true | void) => {
  const map: Record<string, true> = {}
  const list = typeof str === 'string' ? str.split(',') : str
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => map[val.toLowerCase()] : val => map[val]
}
