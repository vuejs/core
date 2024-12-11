import type { EffectScope, ShallowRef } from '@vue/reactivity'
import type { Block, Fragment } from './block'

interface ForBlock extends Fragment {
  scope: EffectScope
  state: [
    item: ShallowRef<any>,
    key: ShallowRef<any>,
    index: ShallowRef<number | undefined>,
  ]
  key: any
}

type Source = any[] | Record<any, any> | number | Set<any> | Map<any, any>

export const createFor = (
  src: () => Source,
  renderItem: (block: ForBlock['state']) => Block,
  getKey?: (item: any, key: any, index?: number) => any,
  container?: ParentNode,
  hydrationNode?: Node,
  once?: boolean,
): Fragment => {
  return [] as any
}
