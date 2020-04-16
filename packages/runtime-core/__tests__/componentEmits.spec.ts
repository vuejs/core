// Note: emits and listener fallthrough is tested in
// ./rendererAttrsFallthrough.spec.ts.

import { mockWarn } from '@vue/shared'
import { render, defineComponent, h, nodeOps } from '@vue/runtime-test'
import { isEmitListener } from '../src/componentEmits'

describe('component: emit', () => {
  mockWarn()

  test('trigger handlers', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        // the `emit` function is bound on component instances
        this.$emit('foo')
        this.$emit('bar')
        this.$emit('!baz')
      }
    })

    const onfoo = jest.fn()
    const onBar = jest.fn()
    const onBaz = jest.fn()
    const Comp = () => h(Foo, { onfoo, onBar, ['on!baz']: onBaz })
    render(h(Comp), nodeOps.createElement('div'))

    expect(onfoo).not.toHaveBeenCalled()
    // only capitalized or special chars are considerd event listeners
    expect(onBar).toHaveBeenCalled()
    expect(onBaz).toHaveBeenCalled()
  })

  // for v-model:foo-bar usage in DOM templates
  test('trigger hyphendated events for update:xxx events', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:fooProp')
        this.$emit('update:barProp')
      }
    })

    const fooSpy = jest.fn()
    const barSpy = jest.fn()
    const Comp = () =>
      h(Foo, {
        'onUpdate:fooProp': fooSpy,
        'onUpdate:bar-prop': barSpy
      })
    render(h(Comp), nodeOps.createElement('div'))

    expect(fooSpy).toHaveBeenCalled()
    expect(barSpy).toHaveBeenCalled()
  })

  test('should trigger array of listeners', async () => {
    const Child = defineComponent({
      setup(_, { emit }) {
        emit('foo', 1)
        return () => h('div')
      }
    })

    const fn1 = jest.fn()
    const fn2 = jest.fn()

    const App = {
      setup() {
        return () =>
          h(Child, {
            onFoo: [fn1, fn2]
          })
      }
    }

    render(h(App), nodeOps.createElement('div'))
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
  })

  test('warning for undeclared event (array)', () => {
    const Foo = defineComponent({
      emits: ['foo'],
      render() {},
      created() {
        // @ts-ignore
        this.$emit('bar')
      }
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "bar" but it is neither declared`
    ).toHaveBeenWarned()
  })

  test('warning for undeclared event (object)', () => {
    const Foo = defineComponent({
      emits: {
        foo: null
      },
      render() {},
      created() {
        // @ts-ignore
        this.$emit('bar')
      }
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "bar" but it is neither declared`
    ).toHaveBeenWarned()
  })

  test('should not warn if has equivalent onXXX prop', () => {
    const Foo = defineComponent({
      props: ['onFoo'],
      emits: [],
      render() {},
      created() {
        // @ts-ignore
        this.$emit('foo')
      }
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "bar" but it is neither declared`
    ).not.toHaveBeenWarned()
  })

  test('validator warning', () => {
    const Foo = defineComponent({
      emits: {
        foo: (arg: number) => arg > 0
      },
      render() {},
      created() {
        this.$emit('foo', -1)
      }
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(`event validation failed for event "foo"`).toHaveBeenWarned()
  })

  test('isEmitListener', () => {
    expect(isEmitListener(['click'], 'onClick')).toBe(true)
    expect(isEmitListener(['click'], 'onclick')).toBe(false)
    expect(isEmitListener({ click: null }, 'onClick')).toBe(true)
    expect(isEmitListener({ click: null }, 'onclick')).toBe(false)
    expect(isEmitListener(['click'], 'onBlick')).toBe(false)
    expect(isEmitListener({ click: null }, 'onBlick')).toBe(false)
  })
})
