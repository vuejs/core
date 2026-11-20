export type Prettify<T> = { [K in keyof T]: T[K] } & {}

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

export type IsKeyValues<T, K = string> = IfAny<
  T,
  false,
  T extends object ? (keyof T extends K ? true : false) : false
>

/**
 * Utility for extracting the parameters from a function overload (for typed emits)
 * https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
 */
export type OverloadParameters<T extends (...args: any[]) => any> = Parameters<
  OverloadUnion<T>
>

type OverloadProps<TOverload> = Pick<TOverload, keyof TOverload>

/**
 * Rebuilds the parameter list of a signature as it was declared: a trailing
 * `void` parameter is inferred as optional by `infer TArgs`, so a signature
 * rebuilt from it is no longer identical to the original one.
 */
type RequireVoidParams<T extends unknown[]> = T extends [infer H, ...infer R]
  ? [H, ...RequireVoidParams<R>]
  : T extends [(infer H)?, ...infer R]
    ? unknown extends H
      ? T
      : void extends H
        ? [Exclude<H, undefined>, ...RequireVoidParams<R>]
        : T
    : T

type OverloadUnionRecursive<
  TOverload,
  TPartialOverload = unknown,
> = TOverload extends (...args: infer TArgs) => infer TReturn
  ? TPartialOverload extends TOverload
    ? never
    : | OverloadUnionRecursive<
          TPartialOverload & TOverload,
          TPartialOverload &
            // both forms are collected, because it is not possible to tell
            // `(v: void)` from `(v?: void)` after the parameters are inferred.
            // The one that is identical to the original signature
            // is deduplicated, which lets the recursion terminate.
            ((...args: TArgs) => TReturn) &
            ((...args: RequireVoidParams<TArgs>) => TReturn) &
            OverloadProps<TOverload>
        >
      | ((...args: TArgs) => TReturn)
  : never

type OverloadUnion<TOverload extends (...args: any[]) => any> = Exclude<
  OverloadUnionRecursive<(() => never) & TOverload>,
  TOverload extends () => never ? never : () => never
>
