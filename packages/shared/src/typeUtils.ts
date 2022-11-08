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
export type IsEqual<A1 extends any, A2 extends any> = (<A>() => A extends A2
  ? true
  : false) extends <A>() => A extends A1 ? true : false
  ? true
  : false

export type IsReadonlyKey<O, K extends keyof O> = IsEqual<
  { [L in K]: O[L] },
  { readonly [L in K]: O[L] }
>

export type MarkReadonly<O, K extends keyof O> = {
  [L in keyof ({ [M in Exclude<keyof O, K>]: unknown } & {
    readonly [M in K]: unknown
  })]: O[L]
}
