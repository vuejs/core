export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// make keys required but keep undefined values
// use `keyof Pick<T, string & keyof T>` instead of `string & keyof T` to support IDE features
export type LooseRequired<T> = { [P in keyof Pick<T, string & keyof T>]: T[P] }

export type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N
