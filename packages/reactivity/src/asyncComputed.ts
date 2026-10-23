import type { ComputedRefImpl } from './computed'

/** @internal A pending read is control flow, never a computed value. */
export class PendingComputed {
  promise!: Promise<void>

  constructor(
    readonly source: ComputedRefImpl,
    readonly generation: number,
  ) {}
}

/** @internal Preserve the rejected source while routing its original error. */
export class AsyncComputedError extends Error {
  constructor(
    readonly source: ComputedRefImpl,
    readonly error: unknown,
  ) {
    super(error instanceof Error ? error.message : String(error))
  }
}

/** @internal */
export interface AsyncComputedState {
  generation: number
  settled: boolean
  pending?: PendingComputed
  error?: AsyncComputedError
}
