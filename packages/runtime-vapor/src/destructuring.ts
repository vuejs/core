import { type EffectScope, shallowReactive } from '@vue/reactivity'
import { renderEffect } from './renderEffect'

export function destructuring(
  scope: EffectScope,
  state: any,
  fn: (state: any) => any[],
) {
  const list = shallowReactive<any[]>([])
  scope.run(() => {
    renderEffect(() => {
      const res = fn(state)
      const len = res.length
      for (let i = 0; i < len; i++) {
        list[i] = res[i]
      }
    })
  })
  return list
}
