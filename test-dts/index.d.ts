// This directory contains a number of d.ts assertions
// use \@ts-expect-error where errors are expected.

export * from '@vue/runtime-dom'

export function describe(_name: string, _fn: () => void): void

export function expectType<T>(value: T): void
export function expectError<T>(value: T): void
export function expectAssignable<T, T2 extends T = T>(value: T2): void

export type IsUnion<T, U extends T = T> = (
  T extends any ? (U extends T ? false : true) : never
) extends false
  ? false
  : true
