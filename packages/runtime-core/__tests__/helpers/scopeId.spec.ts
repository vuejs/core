import { withScopeId } from '../../src/helpers/scopeId'
import { h, render, nodeOps, serializeInner } from '@vue/runtime-test'

describe('scopeId runtime support', () => {
  const withParentId = withScopeId('parent')
  const withChildId = withScopeId('child')

  test('should attach scopeId', () => {
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h('div', [h('div')])
      })
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div parent><div parent></div></div>`)
  })

  test('should attach scopeId to components in parent component', () => {
    const Child = {
      __scopeId: 'child',
      render: withChildId(() => {
        return h('div')
      })
    }
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h('div', [h(Child)])
      })
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(
      `<div parent><div parent child></div></div>`
    )
  })

  test('should work on slots', () => {
    const Child = {
      __scopeId: 'child',
      render: withChildId(function(this: any) {
        return h('div', this.$slots.default())
      })
    }
    const withChild2Id = withScopeId('child2')
    const Child2 = {
      __scopeId: 'child2',
      render: withChild2Id(() => h('span'))
    }
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h(
          Child,
          withParentId(() => {
            return [h('div'), h(Child2)]
          })
        )
      })
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    // slot content should have:
    // - scopeId from parent
    // - slotted scopeId (with `-s` postfix) from child (the tree owner)
    expect(serializeInner(root)).toBe(
      `<div parent child>` +
        `<div parent child-s></div>` +
        // component inside slot should have:
        // - scopeId from template context
        // - slotted scopeId from slot owner
        // - its own scopeId
        `<span parent child-s child2></span>` +
        `</div>`
    )
  })
})
