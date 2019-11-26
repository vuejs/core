import {
  nodeOps,
  render,
  h,
  BaseTransition,
  BaseTransitionProps,
  ref,
  nextTick,
  serializeInner
} from '@vue/runtime-test'

function mount(props: BaseTransitionProps, slot: () => any) {
  const root = nodeOps.createElement('div')
  render(h(BaseTransition, props, slot), root)
  return root
}

function mockProps() {
  const cbs = {
    doneEnter: () => {},
    doneLeave: () => {}
  }
  const props: BaseTransitionProps = {
    onBeforeEnter: jest.fn(el => {
      expect(el.parentNode).toBeNull()
    }),
    onEnter: jest.fn((el, done) => {
      cbs.doneEnter = done
    }),
    onAfterEnter: jest.fn(),
    onEnterCancelled: jest.fn(),
    onBeforeLeave: jest.fn(),
    onLeave: jest.fn((el, done) => {
      cbs.doneLeave = done
    }),
    onAfterLeave: jest.fn(),
    onLeaveCancelled: jest.fn()
  }
  return {
    props,
    cbs
  }
}

function assertCalls(
  props: BaseTransitionProps,
  calls: Record<string, number>
) {
  Object.keys(calls).forEach((key: keyof BaseTransitionProps) => {
    expect(props[key]).toHaveBeenCalledTimes(calls[key])
  })
}

describe('BaseTransition', () => {
  describe('with elements', () => {
    test('toggle on-off', async () => {
      const toggle = ref(true)
      const { props, cbs } = mockProps()
      const root = mount(props, () => (toggle.value ? h('div') : null))

      // without appear: true, enter hooks should not be called on mount
      expect(props.onBeforeEnter).not.toHaveBeenCalled()
      expect(props.onEnter).not.toHaveBeenCalled()
      expect(props.onAfterEnter).not.toHaveBeenCalled()

      toggle.value = false
      await nextTick()
      // comment placeholder enters immediately
      expect(serializeInner(root)).toBe('<div></div><!---->')
      expect(props.onBeforeLeave).toHaveBeenCalledTimes(1)
      expect(props.onLeave).toHaveBeenCalledTimes(1)
      expect(props.onAfterLeave).not.toHaveBeenCalled()
      cbs.doneLeave()
      expect(serializeInner(root)).toBe('<!---->')
      expect(props.onAfterLeave).toHaveBeenCalledTimes(1)

      toggle.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<div></div>')
      // before enter spy asserts node has no parent when it's called
      expect(props.onBeforeEnter).toHaveBeenCalledTimes(1)
      expect(props.onEnter).toHaveBeenCalledTimes(1)
      expect(props.onAfterEnter).not.toHaveBeenCalled()
      cbs.doneEnter()
      expect(props.onAfterEnter).toHaveBeenCalledTimes(1)

      assertCalls(props, {
        onBeforeEnter: 1,
        onEnter: 1,
        onAfterEnter: 1,
        onEnterCancelled: 0,
        onBeforeLeave: 1,
        onLeave: 1,
        onAfterLeave: 1,
        onLeaveCancelled: 0
      })
    })

    test('toggle before finish', async () => {
      const toggle = ref(false)
      const { props, cbs } = mockProps()
      const root = mount(props, () => (toggle.value ? h('div') : null))

      // start enter
      toggle.value = true
      await nextTick()
      expect(serializeInner(root)).toBe(`<div></div>`)
      expect(props.onBeforeEnter).toHaveBeenCalledTimes(1)
      expect(props.onEnter).toHaveBeenCalledTimes(1)

      // leave before enter finishes
      toggle.value = false
      await nextTick()
      expect(serializeInner(root)).toBe(`<div></div><!---->`)
      expect(props.onEnterCancelled).toHaveBeenCalled()
      expect(props.onBeforeLeave).toHaveBeenCalledTimes(1)
      expect(props.onLeave).toHaveBeenCalledTimes(1)
      expect(props.onAfterLeave).not.toHaveBeenCalled()
      // calling doneEnter now should have no effect
      cbs.doneEnter()
      expect(props.onAfterEnter).not.toHaveBeenCalled()

      // enter again before leave finishes
      toggle.value = true
      await nextTick()
      expect(props.onBeforeEnter).toHaveBeenCalledTimes(2)
      expect(props.onEnter).toHaveBeenCalledTimes(2)
      // 1. should remove the previous leaving <div> so there is only one <div>
      // 2. should remove the comment placeholder for the off branch
      expect(serializeInner(root)).toBe(`<div></div>`)
      // note onLeaveCancelled is NOT called because it was a forced early
      // removal instead of a cancel. Instead, onAfterLeave should be called.
      expect(props.onAfterLeave).toHaveBeenCalledTimes(1)
      // calling doneLeave again should have no effect now
      cbs.doneLeave()
      expect(props.onAfterLeave).toHaveBeenCalledTimes(1)
      cbs.doneEnter()
      expect(props.onAfterEnter).toHaveBeenCalledTimes(1)

      assertCalls(props, {
        onBeforeEnter: 2,
        onEnter: 2,
        onAfterEnter: 1,
        onEnterCancelled: 1,
        onBeforeLeave: 1,
        onLeave: 1,
        onAfterLeave: 1,
        onLeaveCancelled: 0
      })
    })

    test('toggle between branches', () => {})

    test('toggle between branches before finish', () => {})

    test('persisted: true', () => {
      // test onLeaveCancelled
    })

    test('appear: true', () => {})

    test('mode: "out-in"', () => {})

    test('mode: "out-in" toggle before finish', () => {})

    test('mode: "in-out" toggle before finish', () => {})
  })

  describe('with components', () => {
    // TODO
  })

  describe('with KeepAlive', () => {
    // TODO
  })
})
