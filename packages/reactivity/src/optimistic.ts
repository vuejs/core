import { ComputedRefImpl } from './computed'
import { AsyncComputedError, PendingComputed } from './asyncComputed'
import { type Ref, isRef, triggerRef } from './ref'
import { endBatch, startBatch } from './system'

export interface OptimisticOptions<T, Result> {
  update: (current: T) => T
  run: () => Result | PromiseLike<Result>
  commit?: (current: T, result: Awaited<Result>) => T
}

interface Layer<T> {
  update: (current: T) => T
  commit?: (current: T, result: any) => T
  fulfilled: boolean
  result?: unknown
}

/** @internal */
export interface OptimisticState<T> {
  base: T
  value: T
  layers: Layer<T>[]
  rebase: (value: T) => void
}

/** Apply a replayable tentative update to an existing reactive source. */
export async function optimistic<T, Result>(
  target: Ref<T>,
  options: OptimisticOptions<T, Result>,
): Promise<Awaited<Result>> {
  const source = target as Ref<T> & {
    _value: T
    _optimistic?: OptimisticState<T>
  }
  if (!isRef(target) || !('_value' in target)) {
    throw new TypeError('optimistic() expects a ref or computed ref.')
  }
  let current: T
  try {
    current = target.value
  } catch (error) {
    if (
      error instanceof PendingComputed &&
      target instanceof ComputedRefImpl &&
      target._async &&
      target._async.settled
    ) {
      current = source._value
    } else {
      throw error instanceof AsyncComputedError ? error.error : error
    }
  }
  let state = source._optimistic
  if (!state) {
    state = {
      base: current,
      value: current,
      layers: [],
      rebase(value) {
        this.base = value
        for (const layer of this.layers) {
          value = layer.update(value)
          if (layer.fulfilled && layer.commit)
            value = layer.commit(value, layer.result)
        }
        this.value = value
      },
    }
  }
  const layer: Layer<T> = { ...options, fulfilled: false }
  // Evaluate before attaching a layer, so a throwing update cannot leak it.
  const value = options.update(current)
  state.layers.push(layer)
  state.value = value
  source._optimistic = state
  triggerRef(target)

  const settle = (failed: boolean) => {
    startBatch()
    try {
      if (failed) {
        const index = state.layers.indexOf(layer)
        if (index >= 0) state.layers.splice(index, 1)
      }
      state.rebase(state.base)
      while (state.layers.length && state.layers[0].fulfilled) {
        const first = state.layers[0]
        let base = first.update(state.base)
        if (first.commit) base = first.commit(base, first.result)
        state.layers.shift()
        state.base = base
      }
      if (!state.layers.length) {
        source._optimistic = undefined
        if (target instanceof ComputedRefImpl) source._value = state.base
        else target.value = state.base
      }
      triggerRef(target)
    } finally {
      endBatch()
    }
  }
  try {
    const result = await options.run()
    layer.result = result
    layer.fulfilled = true
    settle(false)
    return result
  } catch (error) {
    settle(true)
    throw error
  }
}
