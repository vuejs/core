export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// make keys required but keep undefined values
export type LooseRequired<T> = { [P in string & keyof T]: T[P] }

export type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N
