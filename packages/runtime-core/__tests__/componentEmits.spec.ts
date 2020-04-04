// Note: emits and listener fallthrough is tested in
// ./rendererAttrsFallthrough.spec.ts.

import { mockWarn } from '@vue/shared'
import { render, defineComponent, h, nodeOps } from '@vue/runtime-test'
import { isEmitListener } from '../src/componentEmits'

describe('emits option', () => {
  mockWarn()

  test('trigger both raw event and capitalize handlers', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        // the `emit` function is bound on component instances
        this.$emit('foo')
        this.$emit('bar')
      }
    })

    const onfoo = jest.fn()
    const onBar = jest.fn()
    const Comp = () => h(Foo, { onfoo, onBar })
    render(h(Comp), nodeOps.createElement('div'))

    expect(onfoo).toHaveBeenCalled()
    expect(onBar).toHaveBeenCalled()
  })

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
      `Component emitted event "bar" but it is not declared`
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
      `Component emitted event "bar" but it is not declared`
    ).toHaveBeenWarned()
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
    expect(isEmitListener(['click'], 'onclick')).toBe(true)
    expect(isEmitListener({ click: null }, 'onClick')).toBe(true)
    expect(isEmitListener({ click: null }, 'onclick')).toBe(true)
    expect(isEmitListener(['click'], 'onBlick')).toBe(false)
    expect(isEmitListener({ click: null }, 'onBlick')).toBe(false)
  })
})
