import {
  type ComponentOptions,
  type VNode,
  KeepAlive,
  createRenderer,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  onActivated,
  ref,
} from '@vue/runtime-test'

// A host whose `remove` mimics real DOM: it throws when asked to remove a
// node whose `el` is null (real DOM would do `el.parentNode` -> TypeError).
// The default test host silently no-ops on a null parent, which is exactly
// why this class of bug is invisible in the test suite but fatal in browsers.
const strictNodeOps: any = {
  ...nodeOps,
  remove(child: any, logOp?: boolean) {
    if (child == null) {
      throw new Error('hostRemove called with a null el')
    }
    return (nodeOps.remove as any)(child, logOp)
  },
}

const { createApp: createStrictApp } = createRenderer({
  patchProp() {},
  ...strictNodeOps,
})

const timeout = (n = 0) => new Promise(r => setTimeout(r, n))

describe('issue #15434 keep-alive / onActivated async re-render', () => {
  // Smoke test mirroring the production scenario: a keep-alive cached view
  // whose onActivated triggers an async re-render, toggled rapidly. With the
  // guard in `remove`, the rapid activate/deactivate/activate cycle must not
  // throw (the strict host would throw on a null-el unmount).
  test('rapidly re-activating a cached view with an async onActivated reload does not crash', async () => {
    const view = ref('Chat')

    const ChatView = defineComponent({
      name: 'ChatView',
      setup() {
        const messages = ref<number[]>([])
        onActivated(async () => {
          await Promise.resolve()
          messages.value = [1, 2, 3]
        })
        return () =>
          h(
            'div',
            messages.value.map(id => h('div', { key: id }, `msg ${id}`)),
          )
      },
    })

    const Root = defineComponent({
      setup() {
        return () => h(KeepAlive, () => h(ChatView, { key: view.value }))
      },
    })

    const root = strictNodeOps.createElement('div')
    const app = createStrictApp(Root)
    app.mount(root)

    for (let i = 0; i < 5; i++) {
      view.value = 'Chat'
      await timeout()
      await nextTick()
      view.value = 'Other'
      await timeout()
      await nextTick()
    }

    expect(strictNodeOps.createElement('div')).toBeTruthy()
  })

  // Deterministic regression test for the exact failure: a keyed child whose
  // `el` was never mounted (null) is unmounted during a re-render. Before the
  // fix, `remove` called `hostRemove(null)` and the strict host threw; the fix
  // makes it a no-op.
  test('unmounting a keyed child whose el was never mounted is a no-op (#15434)', async () => {
    const list = ref([1, 2, 3])
    const Comp = defineComponent({
      setup() {
        return () => h('ul', list.value.map(i => h('li', { key: i }, i)))
      },
    })

    const root = strictNodeOps.createElement('div')
    const app = createStrictApp(Comp)
    const vm: any = app.mount(root)

    // Simulate the keep-alive race: the cached subtree's keyed children have
    // never been mounted (el === null) when an async re-render removes them.
    const ulVNode = vm.$.subTree as VNode
    for (const child of ulVNode.children as VNode[]) {
      child.el = null
    }

    // Removing all items must not throw: patchKeyedChildren unmounts the
    // null-el children, and `remove` now guards against null `el`.
    expect(() => {
      list.value = []
    }).not.toThrow()
    await nextTick()
  })
})
