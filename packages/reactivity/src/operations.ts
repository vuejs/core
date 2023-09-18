// using literal strings instead of numbers so that it's easier to inspect
// debugger events

/**
 * @deprecated use string literal instead.
 */
export const enum TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate'
}
export type TrackOpTypesUnion = 'get' | 'has' | 'iterate'

/**
 * @deprecated use string literal instead.
 */
export const enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear'
}
export type TriggerOpTypesUnion = 'set' | 'add' | 'delete' | 'clear'
