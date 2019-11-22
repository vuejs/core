// This directory contains a number of d.ts assertions using tsd:
// https://github.com/SamVerschueren/tsd
// The tests checks type errors and will probably show up red in VSCode, and
// it's intended. We cannot use directives like @ts-ignore or @ts-nocheck since
// that would suppress the errors that should be caught.

export * from '@vue/runtime-dom'

export function describe(_name: string, _fn: () => void): void
