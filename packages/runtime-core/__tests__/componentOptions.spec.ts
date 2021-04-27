import { render, h, nodeOps, defineComponent } from '@vue/runtime-test'

describe('component options', () => {
  test('with beforeDestroy, destoryed, no beforeUnmount, no unmounted', () => {
    const Comp = defineComponent({
      render() {
        return h('div')
      },
      beforeDestroy() {},
      destroyed() {}
    })

    const root = nodeOps.createElement('div')
    render(h(Comp, {}), root)

    expect(
      '`beforeDestroy` has been renamed to `beforeUnmount`'
    ).toHaveBeenWarned()
    expect('`destroyed` has been renamed to `unmounted`').toHaveBeenWarned()
  })
  test('with beforeUnmount, unmounted, no beforeDestroy, no destroyed', () => {
    const Comp = defineComponent({
      render() {
        return h('div')
      },
      beforeUnmount() {},
      unmounted() {}
    })

    const root = nodeOps.createElement('div')
    render(h(Comp, {}), root)

    expect(
      '`beforeDestroy` has been renamed to `beforeUnmount`'
    ).not.toHaveBeenWarned()
    expect('`destroyed` has been renamed to `unmounted`').not.toHaveBeenWarned()
  })
  test('with beforeDestroy, destoryed, beforeUnmount, unmounted', () => {
    const Comp = defineComponent({
      render() {
        return h('div')
      },
      beforeDestroy() {},
      destroyed() {},
      beforeUnmount() {},
      unmounted() {}
    })

    const root = nodeOps.createElement('div')
    render(h(Comp, {}), root)

    expect(
      '`beforeDestroy` has been renamed to `beforeUnmount`'
    ).not.toHaveBeenWarned()
    expect('`destroyed` has been renamed to `unmounted`').not.toHaveBeenWarned()
  })
})
