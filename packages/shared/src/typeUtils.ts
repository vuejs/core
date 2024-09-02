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

// To prevent users with TypeScript versions lower than 4.5 from encountering unsupported Awaited<T> type, a copy has been made here.
export type Awaited<T> = T extends null | undefined
  ? T // special case for `null | undefined` when not in `--strictNullChecks` mode
  : T extends object & { then(onfulfilled: infer F, ...args: infer _): any } // `await` only unwraps object types with a callable `then`. Non-object types are not unwrapped
    ? F extends (value: infer V, ...args: infer _) => any // if the argument to `then` is callable, extracts the first argument
      ? Awaited<V> // recursively unwrap the value
      : never // the argument to `then` was not callable
    : T // non-object or non-thenable

/**
 * Utility for extracting the parameters from a function overload (for typed emits)
 * https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
 */
export type OverloadParameters<T extends (...args: any[]) => any> = Parameters<
  OverloadUnion<T>
>

type OverloadProps<TOverload> = Pick<TOverload, keyof TOverload>

type OverloadUnionRecursive<
  TOverload,
  TPartialOverload = unknown,
> = TOverload extends (...args: infer TArgs) => infer TReturn
  ? TPartialOverload extends TOverload
    ? never
    :
        | OverloadUnionRecursive<
            TPartialOverload & TOverload,
            TPartialOverload &
              ((...args: TArgs) => TReturn) &
              OverloadProps<TOverload>
          >
        | ((...args: TArgs) => TReturn)
  : never

type OverloadUnion<TOverload extends (...args: any[]) => any> = Exclude<
  OverloadUnionRecursive<(() => never) & TOverload>,
  TOverload extends () => never ? never : () => never
>
