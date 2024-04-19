// NOTE: this test cases are based on paclages/runtime-core/__tests__/componentEmits.spec.ts

// Note: emits and listener fallthrough is tested in
// ./rendererAttrsFallthrough.spec.ts.

import { toHandlers } from '@vue/runtime-core'
import {
  createComponent,
  defineComponent,
  nextTick,
  onBeforeUnmount,
} from '../src'
import { isEmitListener } from '../src/componentEmits'
import { makeRender } from './_utils'

const define = makeRender()

describe('component: emit', () => {
  test('trigger handlers', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('foo')
        emit('bar')
        emit('!baz')
      },
    })
    const onFoo = vi.fn()
    const onBar = vi.fn()
    const onBaz = vi.fn()
    render({
      onfoo: () => onFoo,
      onBar: () => onBar,
      ['on!baz']: () => onBaz,
    })

    expect(onFoo).not.toHaveBeenCalled()
    expect(onBar).toHaveBeenCalled()
    expect(onBaz).toHaveBeenCalled()
  })

  test('trigger dynamic emits', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('foo')
        emit('bar')
        emit('!baz')
      },
    })
    const onFoo = vi.fn()
    const onBar = vi.fn()
    const onBaz = vi.fn()
    render(() => ({
      onfoo: onFoo,
      onBar,
      ['on!baz']: onBaz,
    }))

    expect(onFoo).not.toHaveBeenCalled()
    expect(onBar).toHaveBeenCalled()
    expect(onBaz).toHaveBeenCalled()
  })

  test('trigger camelCase handler', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('test-event')
      },
    })

    const fooSpy = vi.fn()
    render({ onTestEvent: () => fooSpy })
    expect(fooSpy).toHaveBeenCalled()
  })

  test('trigger kebab-case handler', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('test-event')
      },
    })

    const fooSpy = vi.fn()
    render({ ['onTest-event']: () => fooSpy })
    expect(fooSpy).toHaveBeenCalledTimes(1)
  })

  // #3527
  test('trigger mixed case handlers', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('test-event')
        emit('testEvent')
      },
    })

    const fooSpy = vi.fn()
    const barSpy = vi.fn()
    render(
      toHandlers({
        'test-event': () => fooSpy,
        testEvent: () => barSpy,
      }),
    )
    expect(fooSpy).toHaveBeenCalledTimes(1)
    expect(barSpy).toHaveBeenCalledTimes(1)
  })

  // for v-model:foo-bar usage in DOM templates
  test('trigger hyphenated events for update:xxx events', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('update:fooProp')
        emit('update:barProp')
      },
    })

    const fooSpy = vi.fn()
    const barSpy = vi.fn()
    render({
      ['onUpdate:fooProp']: () => fooSpy,
      ['onUpdate:bar-prop']: () => barSpy,
    })

    expect(fooSpy).toHaveBeenCalled()
    expect(barSpy).toHaveBeenCalled()
  })

  test('should trigger array of listeners', async () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('foo', 1)
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    render({ onFoo: () => [fn1, fn2] })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(1)
  })

  test('warning for undeclared event (array)', () => {
    const { render } = define({
      emits: ['foo'],

      setup(_, { emit }) {
        emit('bar')
      },
    })
    render()
    expect(
      `Component emitted event "bar" but it is neither declared`,
    ).toHaveBeenWarned()
  })

  test('warning for undeclared event (object)', () => {
    const { render } = define({
      emits: {
        foo: null,
      },

      setup(_, { emit }) {
        emit('bar')
      },
    })
    render()
    expect(
      `Component emitted event "bar" but it is neither declared`,
    ).toHaveBeenWarned()
  })

  test('should not warn if has equivalent onXXX prop', () => {
    define({
      props: ['onFoo'],
      emits: [],

      setup(_, { emit }) {
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
      emits: {
        foo: null,
        bar: null,
      },
      setup(_, { emit }) {
        emit('foo')
        emit('foo')
        emit('bar')
        emit('bar')
      },
    })
    const fn = vi.fn()
    const barFn = vi.fn()
    render({
      onFooOnce: () => fn,
      onBarOnce: () => barFn,
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(barFn).toHaveBeenCalledTimes(1)
  })

  test('.once with normal listener of the same name', () => {
    const { render } = define({
      emits: {
        foo: null,
      },
      setup(_, { emit }) {
        emit('foo')
        emit('foo')
      },
    })
    const onFoo = vi.fn()
    const onFooOnce = vi.fn()
    render({
      onFoo: () => onFoo,
      onFooOnce: () => onFooOnce,
    })
    expect(onFoo).toHaveBeenCalledTimes(2)
    expect(onFooOnce).toHaveBeenCalledTimes(1)
  })

  test('.number modifier should work with v-model on component', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('update:modelValue', '1')
        emit('update:foo', '2')
      },
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    render({
      modelValue: () => null,
      modelModifiers: () => ({ number: true }),
      ['onUpdate:modelValue']: () => fn1,
      foo: () => null,
      fooModifiers: () => ({ number: true }),
      ['onUpdate:foo']: () => fn2,
    })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(2)
  })

  test('.trim modifier should work with v-model on component', () => {
    const { render } = define({
      setup(_, { emit }) {
        emit('update:modelValue', ' one ')
        emit('update:foo', '  two  ')
      },
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    render({
      modelValue() {
        return null
      },
      modelModifiers() {
        return { trim: true }
      },
      ['onUpdate:modelValue']() {
        return fn1
      },
      foo() {
        return null
      },
      fooModifiers() {
        return { trim: true }
      },
      'onUpdate:foo'() {
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
      setup(_, { emit }) {
        emit('update:modelValue', '    +01.2    ')
        emit('update:foo', '    1    ')
      },
    })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    render({
      modelValue() {
        return null
      },
      modelModifiers() {
        return { trim: true, number: true }
      },
      ['onUpdate:modelValue']() {
        return fn1
      },
      foo() {
        return null
      },
      fooModifiers() {
        return { trim: true, number: true }
      },
      ['onUpdate:foo']() {
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
      setup(_, { emit }) {
        emit('update:modelValue', ' foo ', { bar: ' bar ' })
      },
    })
    const fn = vi.fn()
    render({
      modelValue() {
        return null
      },
      modelModifiers() {
        return { trim: true }
      },
      ['onUpdate:modelValue']() {
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

    const Foo = defineComponent({
      emits: ['closing'],
      setup(_, { emit }) {
        onBeforeUnmount(async () => {
          await nextTick()
          emit('closing', true)
        })
      },
    })

    const { app } = define(() =>
      createComponent(Foo, { onClosing: () => fn }),
    ).render()

    await nextTick()
    app.unmount()
    await nextTick()
    expect(fn).not.toHaveBeenCalled()
  })

  // NOTE: not supported mixins
  // test.todo('merge string array emits', async () => {})
  // test.todo('merge object emits', async () => {})
})
