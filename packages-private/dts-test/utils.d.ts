// This directory contains a number of d.ts assertions
// use \@ts-expect-error where errors are expected.

// register global JSX
import 'vue/jsx'

export function describe(_name: string, _fn: () => void): void
export function test(_name: string, _fn: () => any): void

// https://stackoverflow.com/a/53808212
type IfEquals<T, U, Y = unknown, N = never> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N
export function expectType<T, U>(
  actual: T & IfEquals<T, U>,
  expected: U & IfEquals<T, U>,
): IfEquals<T, U>
export function expectAssignable<T, T2 extends T = T>(value: T2): void

export type IsUnion<T, U extends T = T> = (
  T extends any ? (U extends T ? false : true) : never
) extends false
  ? false
  : true

export type IsAny<T> = 0 extends 1 & T ? true : false

export type Prettify<T> = { [K in keyof T]: T[K] } & {}
