export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// make keys required but keep undefined values
export type LooseRequired<T> = { [P in keyof (T & Required<T>)]: T[P] }

// If the type T accepts type "any", output type Y, otherwise output type N.
// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

// https://stackoverflow.com/a/52473108/3570903
export type IfEquals<A1 extends any, A2 extends any> = (<A>() => A extends A2
  ? 1
  : 0) extends <A>() => A extends A1 ? 1 : 0
  ? 1
  : 0

export type IfReadonlyKey<O, K extends keyof O> = IfEquals<
  { [L in K]: O[L] },
  { readonly [L in K]: O[L] }
>
