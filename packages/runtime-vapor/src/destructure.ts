import { shallowReactive } from '@vue/reactivity'
import { renderEffect } from './renderEffect'

export function withDestructure<P extends any[], R>(
  assign: (...args: P) => any[],
  block: (ctx: any[]) => R,
): (...args: P) => R {
  return (...args: P) => {
    const ctx = shallowReactive<any[]>([])
    renderEffect(() => {
      const res = assign(...args)
      const len = res.length
      for (let i = 0; i < len; i++) {
        ctx[i] = res[i]
      }
    })
    return block(ctx)
  }
}
