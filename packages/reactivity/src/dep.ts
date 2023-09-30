import { ReactiveEffect } from './effect'

export type Dep = Map<ReactiveEffect, number> & {
  queryDirty?: () => void
}

export const createDep = (queryDirty?: () => void): Dep => {
  const dep: Dep = new Map()
  dep.queryDirty = queryDirty
  return dep
}
