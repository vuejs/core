// This directory contains a number of d.ts assertions
// use \@ts-expect-error where errors are expected.

// register global JSX
import 'vue/jsx'

export function describe(_name: string, _fn: () => void): void
export function test(_name: string, _fn: () => any): void

export function expectType<T>(value: T): void
export function expectAssignable<T, T2 extends T = T>(value: T2): void

export type IsUnion<T, U extends T = T> = (
  T extends any ? (U extends T ? false : true) : never
) extends false
  ? false
  : true

export type IsAny<T> = 0 extends 1 & T ? true : false

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

// https://github.com/unional/type-plus/blob/a89e140ca7c0ce6b744fbd1b157686cdfa4332c7/type-plus/ts/object/optional_key.ts#L29C1-L31C9
export type OptionalKeys<T> = T extends unknown
  ? {
      [k in keyof T]-?: Record<keyof any, any> extends Pick<T, k> ? k : never
    }[keyof T]
  : never
