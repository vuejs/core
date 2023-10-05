import type { ReactiveEffect } from './effect'
import type { ComputedRefImpl } from './computed'

export type Dep = Map<ReactiveEffect, number> & {
  computed?: ComputedRefImpl<any>
}

export const createDep = (computed?: ComputedRefImpl<any>): Dep => {
  const dep: Dep = new Map()
  dep.computed = computed
  return dep
}
