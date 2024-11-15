import {
  type ShallowUnwrapRef,
  proxyRefs,
  shallowReactive,
} from '@vue/reactivity'
import { renderEffect } from './renderEffect'

export function withDestructure<T extends any[], R>(
  assign: (data: ShallowUnwrapRef<T>) => any[],
  block: (ctx: any[]) => R,
): (data: T) => R {
  return (data: T) => {
    const ctx = shallowReactive<any[]>([])
    renderEffect(() => {
      const res = assign(proxyRefs(data))
      const len = res.length
      for (let i = 0; i < len; i++) {
        ctx[i] = res[i]
      }
    })
    return block(ctx)
  }
}
