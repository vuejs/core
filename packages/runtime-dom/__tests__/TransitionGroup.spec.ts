import {
  Fragment,
  TransitionGroup,
  type VNode,
  type VNodeArrayChildren,
} from '@vue/runtime-dom'
import { h, nodeOps, render } from '@vue/runtime-test'

describe('TransitionGroup', () => {
  // #5761
  test('<template v-for + key> + v-if', () => {
    const Comp = h(TransitionGroup, {}, () =>
      ['A'].map(item => {
        return h(Fragment, { key: item }, [
          h('div', {}, ''),
          h('div', { key: 0 }, ''), // simulate v-if branch key
          h('div', {}, ''),
        ])
      }),
    )

    render(Comp, nodeOps.createElement('div'))

    const children = Comp.component?.subTree.children as VNodeArrayChildren
    expect((children[0] as VNode).key).toBe('A0')
    expect((children[1] as VNode).key).toBe('A1') // expect key to be 'A1' instead of 'A0'
    expect((children[2] as VNode).key).toBe('A2')
  })
})
