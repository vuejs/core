// NOTE: this test cases are based on paclages/runtime-core/__tests__/componentEmits.spec.ts

// Note: emits and listener fallthrough is tested in
// ./rendererAttrsFallthrough.spec.ts.

import { nextTick, onBeforeUnmount, unmountComponent } from '../src'
import { isEmitListener } from '../src/componentEmits'
import { makeRender } from './_utils'

const define = makeRender<any>()

describe('component: emit', () => {
  test('trigger handlers', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('foo')
        emit('bar')
        emit('!baz')
      },
    })
    const onfoo = vi.fn()
    const onBar = vi.fn()
    const onBaz = vi.fn()
    render({
      get onfoo() {
        return onfoo
      },
      get onBar() {
        return onBar
      },
      get ['on!baz']() {
        return onBaz
      },
    })

    expect(onfoo).not.toHaveBeenCalled()
    expect(onBar).toHaveBeenCalled()
    expect(onBaz).toHaveBeenCalled()
  })

  test('trigger camelCase handler', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('test-event')
      },
    })

    const fooSpy = vi.fn()
    render({
      get onTestEvent() {
        return fooSpy
      },
    })
    expect(fooSpy).toHaveBeenCalled()
  })

  test('trigger kebab-case handler', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('test-event')
      },
    })

    const fooSpy = vi.fn()
    render({
      get ['onTest-event']() {
        return fooSpy
      },
    })
    expect(fooSpy).toHaveBeenCalledTimes(1)
  })

  // #3527
  test.todo('trigger mixed case handlers', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('test-event')
        emit('testEvent')
      },
    })

    const fooSpy = vi.fn()
    const barSpy = vi.fn()
    render(
      // TODO: impl `toHandlers`
      {
        get ['onTest-Event']() {
          return fooSpy
        },
        get onTestEvent() {
          return barSpy
        },
      },
    )
    expect(fooSpy).toHaveBeenCalledTimes(1)
    expect(barSpy).toHaveBeenCalledTimes(1)
  })

  // for v-model:foo-bar usage in DOM templates
  test('trigger hyphenated events for update:xxx events', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('update:fooProp')
        emit('update:barProp')
      },
    })

    const fooSpy = vi.fn()
    const barSpy = vi.fn()
    render({
      get ['onUpdate:fooProp']() {
        return fooSpy
      },
      get ['onUpdate:bar-prop']() {
        return barSpy
      },
    })

    expect(fooSpy).toHaveBeenCalled()
    expect(barSpy).toHaveBeenCalled()
  })

  test('should trigger array of listeners', async () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('foo', 1)
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    render({
      get onFoo() {
        return [fn1, fn2]
      },
    })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(1)
  })

  test.todo('warning for undeclared event (array)', () => {
    // TODO: warning
  })

  test.todo('warning for undeclared event (object)', () => {
    // TODO: warning
  })

  test('should not warn if has equivalent onXXX prop', () => {
    define({
      props: ['onFoo'],
      emits: [],
      render() {},
      setup(_: any, { emit }: any) {
        emit('foo')
      },
    }).render()
    expect(
      `Component emitted event "foo" but it is neither declared`,
    ).not.toHaveBeenWarned()
  })

  test.todo('validator warning', () => {
    // TODO: warning validator
  })

  // NOTE: not supported mixins
  // test.todo('merging from mixins', () => {})

  // #2651
  // test.todo(
  //   'should not attach normalized object when mixins do not contain emits',
  //   () => {},
  // )

  test('.once', () => {
    const { render } = define({
      render() {},
      emits: {
        foo: null,
        bar: null,
      },
      setup(_: any, { emit }: any) {
        emit('foo')
        emit('foo')
        emit('bar')
        emit('bar')
      },
    })
    const fn = vi.fn()
    const barFn = vi.fn()
    render({
      get onFooOnce() {
        return fn
      },
      get onBarOnce() {
        return barFn
      },
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(barFn).toHaveBeenCalledTimes(1)
  })

  test('.once with normal listener of the same name', () => {
    const { render } = define({
      render() {},
      emits: {
        foo: null,
      },
      setup(_: any, { emit }: any) {
        emit('foo')
        emit('foo')
      },
    })
    const onFoo = vi.fn()
    const onFooOnce = vi.fn()
    render({
      get onFoo() {
        return onFoo
      },
      get onFooOnce() {
        return onFooOnce
      },
    })
    expect(onFoo).toHaveBeenCalledTimes(2)
    expect(onFooOnce).toHaveBeenCalledTimes(1)
  })

  test('.number modifier should work with v-model on component', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('update:modelValue', '1')
        emit('update:foo', '2')
      },
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    render({
      get modelValue() {
        return null
      },
      get modelModifiers() {
        return { number: true }
      },
      get ['onUpdate:modelValue']() {
        return fn1
      },
      get foo() {
        return null
      },
      get fooModifiers() {
        return { number: true }
      },
      get ['onUpdate:foo']() {
        return fn2
      },
    })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(2)
  })

  test('.trim modifier should work with v-model on component', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('update:modelValue', ' one ')
        emit('update:foo', '  two  ')
      },
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    render({
      get modelValue() {
        return null
      },
      get modelModifiers() {
        return { trim: true }
      },
      get ['onUpdate:modelValue']() {
        return fn1
      },
      get foo() {
        return null
      },
      get fooModifiers() {
        return { trim: true }
      },
      get 'onUpdate:foo'() {
        return fn2
      },
    })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith('one')
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith('two')
  })

  test('.trim and .number modifiers should work with v-model on component', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('update:modelValue', '    +01.2    ')
        emit('update:foo', '    1    ')
      },
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    render({
      get modelValue() {
        return null
      },
      get modelModifiers() {
        return { trim: true, number: true }
      },
      get ['onUpdate:modelValue']() {
        return fn1
      },
      get foo() {
        return null
      },
      get fooModifiers() {
        return { trim: true, number: true }
      },
      get ['onUpdate:foo']() {
        return fn2
      },
    })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1.2)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(1)
  })

  test('only trim string parameter when work with v-model on component', () => {
    const { render } = define({
      render() {},
      setup(_: any, { emit }: any) {
        emit('update:modelValue', ' foo ', { bar: ' bar ' })
      },
    })
    const fn = vi.fn()
    render({
      get modelValue() {
        return null
      },
      get modelModifiers() {
        return { trim: true }
      },
      get ['onUpdate:modelValue']() {
        return fn
      },
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('foo', { bar: ' bar ' })
  })

  test('isEmitListener', () => {
    const options = {
      get click() {
        return null
      },
      get 'test-event'() {
        return null
      },
      get fooBar() {
        return null
      },
      get FooBaz() {
        return null
      },
    }
    expect(isEmitListener(options, 'onClick')).toBe(true)
    expect(isEmitListener(options, 'onclick')).toBe(false)
    expect(isEmitListener(options, 'onBlick')).toBe(false)
    // .once listeners
    expect(isEmitListener(options, 'onClickOnce')).toBe(true)
    expect(isEmitListener(options, 'onclickOnce')).toBe(false)
    // kebab-case option
    expect(isEmitListener(options, 'onTestEvent')).toBe(true)
    // camelCase option
    expect(isEmitListener(options, 'onFooBar')).toBe(true)
    // PascalCase option
    expect(isEmitListener(options, 'onFooBaz')).toBe(true)
  })

  test('does not emit after unmount', async () => {
    const fn = vi.fn()
    const { instance } = define({
      emits: ['closing'],
      setup(_: any, { emit }: any) {
        onBeforeUnmount(async () => {
          await nextTick()
          emit('closing', true)
        })
      },
      render() {},
    }).render({
      get onClosing() {
        return fn
      },
    })
    await nextTick()
    unmountComponent(instance)
    await nextTick()
    expect(fn).not.toHaveBeenCalled()
  })

  // NOTE: not supported mixins
  // test.todo('merge string array emits', async () => {})
  // test.todo('merge object emits', async () => {})
})
