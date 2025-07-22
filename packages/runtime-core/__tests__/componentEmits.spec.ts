// Note: emits and listener fallthrough is tested in
// ./rendererAttrsFallthrough.spec.ts.

import {
  type ComponentPublicInstance,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  render,
  toHandlers,
} from '@vue/runtime-test'
import { isEmitListener } from '../src/componentEmits'

describe('component: emit', () => {
  test('trigger handlers', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        // the `emit` function is bound on component instances
        this.$emit('foo')
        this.$emit('bar')
        this.$emit('!baz')
      },
    })

    const onfoo = vi.fn()
    const onBar = vi.fn()
    const onBaz = vi.fn()
    const Comp = () => h(Foo, { onfoo, onBar, ['on!baz']: onBaz })
    render(h(Comp), nodeOps.createElement('div'))

    expect(onfoo).not.toHaveBeenCalled()
    // only capitalized or special chars are considered event listeners
    expect(onBar).toHaveBeenCalled()
    expect(onBaz).toHaveBeenCalled()
  })

  test('trigger camelCase handler', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('test-event')
      },
    })

    const fooSpy = vi.fn()
    const Comp = () =>
      h(Foo, {
        onTestEvent: fooSpy,
      })
    render(h(Comp), nodeOps.createElement('div'))

    expect(fooSpy).toHaveBeenCalledTimes(1)
  })

  test('trigger kebab-case handler', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('test-event')
      },
    })

    const fooSpy = vi.fn()
    const Comp = () =>
      h(Foo, {
        'onTest-event': fooSpy,
      })
    render(h(Comp), nodeOps.createElement('div'))

    expect(fooSpy).toHaveBeenCalledTimes(1)
  })

  // #3527
  test('trigger mixed case handlers', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('test-event')
        this.$emit('testEvent')
      },
    })

    const fooSpy = vi.fn()
    const barSpy = vi.fn()
    const Comp = () =>
      // simulate v-on="obj" usage
      h(
        Foo,
        toHandlers({
          'test-event': fooSpy,
          testEvent: barSpy,
        }),
      )
    render(h(Comp), nodeOps.createElement('div'))

    expect(fooSpy).toHaveBeenCalledTimes(1)
    expect(barSpy).toHaveBeenCalledTimes(1)
  })

  // for v-model:foo-bar usage in DOM templates
  test('trigger hyphenated events for update:xxx events', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:fooProp')
        this.$emit('update:barProp')
      },
    })

    const fooSpy = vi.fn()
    const barSpy = vi.fn()
    const Comp = () =>
      h(Foo, {
        'onUpdate:fooProp': fooSpy,
        'onUpdate:bar-prop': barSpy,
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
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const App = {
      setup() {
        return () =>
          h(Child, {
            onFoo: [fn1, fn2],
          })
      },
    }

    render(h(App), nodeOps.createElement('div'))
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(1)
  })

  test('warning for undeclared event (array)', () => {
    const Foo = defineComponent({
      emits: ['foo'],
      render() {},
      created() {
        // @ts-expect-error
        this.$emit('bar-baz')
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "bar-baz" but it is neither declared in the emits option nor as an "onBarBaz" prop`,
    ).toHaveBeenWarned()
  })

  test('warning for undeclared event (object)', () => {
    const Foo = defineComponent({
      emits: {
        foo: null,
      },
      render() {},
      created() {
        // @ts-expect-error
        this.$emit('bar-baz')
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "bar-baz" but it is neither declared in the emits option nor as an "onBarBaz" prop`,
    ).toHaveBeenWarned()
  })

  test('should not warn if has equivalent onXXX prop', () => {
    const Foo = defineComponent({
      props: ['onFoo'],
      emits: [],
      render() {},
      created() {
        // @ts-expect-error
        this.$emit('foo')
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "foo" but it is neither declared`,
    ).not.toHaveBeenWarned()
  })

  test('should not warn if has equivalent onXXX prop with kebab-cased event', () => {
    const Foo = defineComponent({
      props: ['onFooBar'],
      emits: [],
      render() {},
      created() {
        // @ts-expect-error
        this.$emit('foo-bar')
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "foo-bar" but it is neither declared`,
    ).not.toHaveBeenWarned()
  })

  test('validator warning', () => {
    const Foo = defineComponent({
      emits: {
        foo: (arg: number) => arg > 0,
      },
      render() {},
      created() {
        this.$emit('foo', -1)
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(`event validation failed for event "foo"`).toHaveBeenWarned()
  })

  test('merging from mixins', () => {
    const mixin = {
      emits: {
        foo: (arg: number) => arg > 0,
      },
    }
    const Foo = defineComponent({
      mixins: [mixin],
      render() {},
      created() {
        this.$emit('foo', -1)
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(`event validation failed for event "foo"`).toHaveBeenWarned()
  })

  // #2651
  test('should not attach normalized object when mixins do not contain emits', () => {
    const Foo = defineComponent({
      mixins: [{}],
      render() {},
      created() {
        this.$emit('foo')
      },
    })
    render(h(Foo), nodeOps.createElement('div'))
    expect(
      `Component emitted event "foo" but it is neither declared`,
    ).not.toHaveBeenWarned()
  })

  test('.once', () => {
    const Foo = defineComponent({
      render() {},
      emits: {
        foo: null,
        bar: null,
      },
      created() {
        this.$emit('foo')
        this.$emit('foo')
        this.$emit('bar')
        this.$emit('bar')
      },
    })
    const fn = vi.fn()
    const barFn = vi.fn()
    render(
      h(Foo, {
        onFooOnce: fn,
        onBarOnce: barFn,
      }),
      nodeOps.createElement('div'),
    )
    expect(fn).toHaveBeenCalledTimes(1)
    expect(barFn).toHaveBeenCalledTimes(1)
  })

  test('.once with normal listener of the same name', () => {
    const Foo = defineComponent({
      render() {},
      emits: {
        foo: null,
      },
      created() {
        this.$emit('foo')
        this.$emit('foo')
      },
    })
    const onFoo = vi.fn()
    const onFooOnce = vi.fn()
    render(
      h(Foo, {
        onFoo,
        onFooOnce,
      }),
      nodeOps.createElement('div'),
    )
    expect(onFoo).toHaveBeenCalledTimes(2)
    expect(onFooOnce).toHaveBeenCalledTimes(1)
  })

  test('.number modifier should work with v-model on component', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:modelValue', '1')
        this.$emit('update:foo', '2')
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const Comp = () =>
      h(Foo, {
        modelValue: null,
        modelModifiers: { number: true },
        'onUpdate:modelValue': fn1,

        foo: null,
        fooModifiers: { number: true },
        'onUpdate:foo': fn2,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(2)
  })

  test('.trim modifier should work with v-model on component', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:modelValue', ' one ')
        this.$emit('update:foo', '  two  ')
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const Comp = () =>
      h(Foo, {
        modelValue: null,
        modelModifiers: { trim: true },
        'onUpdate:modelValue': fn1,

        foo: null,
        fooModifiers: { trim: true },
        'onUpdate:foo': fn2,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith('one')
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith('two')
  })

  test('.trim modifier should work with v-model on component for kebab-cased props and camelCased emit', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:firstName', ' one ')
      },
    })

    const fn1 = vi.fn()

    const Comp = () =>
      h(Foo, {
        'first-name': null,
        'first-nameModifiers': { trim: true },
        'onUpdate:first-name': fn1,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith('one')
  })

  test('.trim modifier should work with v-model on component for camelCased props and kebab-cased emit', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:model-value', ' one ')
        this.$emit('update:first-name', ' two ')
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const Comp = () =>
      h(Foo, {
        modelValue: null,
        modelModifiers: { trim: true },
        'onUpdate:modelValue': fn1,

        firstName: null,
        firstNameModifiers: { trim: true },
        'onUpdate:firstName': fn2,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith('one')
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith('two')
  })

  test('.trim modifier should work with v-model on component for mixed cased props and emit', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:base-URL', ' one ')
      },
    })

    const fn1 = vi.fn()

    const Comp = () =>
      h(Foo, {
        'base-URL': null,
        'base-URLModifiers': { trim: true },
        'onUpdate:base-URL': fn1,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith('one')
  })

  test('.trim and .number modifiers should work with v-model on component', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:modelValue', '    +01.2    ')
        this.$emit('update:foo', '    1    ')
      },
    })

    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const Comp = () =>
      h(Foo, {
        modelValue: null,
        modelModifiers: { trim: true, number: true },
        'onUpdate:modelValue': fn1,

        foo: null,
        fooModifiers: { trim: true, number: true },
        'onUpdate:foo': fn2,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith(1.2)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith(1)
  })

  test('only trim string parameter when work with v-model on component', () => {
    const Foo = defineComponent({
      render() {},
      created() {
        this.$emit('update:modelValue', ' foo ', { bar: ' bar ' })
      },
    })

    const fn = vi.fn()
    const Comp = () =>
      h(Foo, {
        modelValue: null,
        modelModifiers: { trim: true },
        'onUpdate:modelValue': fn,
      })

    render(h(Comp), nodeOps.createElement('div'))

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('foo', { bar: ' bar ' })
  })

  test('isEmitListener', () => {
    const options = {
      click: null,
      'test-event': null,
      fooBar: null,
      FooBaz: null,
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
      async beforeUnmount() {
        await this.$nextTick()
        this.$emit('closing', true)
      },
      render() {
        return h('div')
      },
    })
    const Comp = () =>
      h(Foo, {
        onClosing: fn,
      })

    const el = nodeOps.createElement('div')
    render(h(Comp), el)
    await nextTick()
    render(null, el)
    await nextTick()
    expect(fn).not.toHaveBeenCalled()
  })

  test('merge string array emits', async () => {
    const ComponentA = defineComponent({
      emits: ['one', 'two'],
    })
    const ComponentB = defineComponent({
      emits: ['three'],
    })
    const renderFn = vi.fn(function (this: ComponentPublicInstance) {
      expect(this.$options.emits).toEqual(['one', 'two', 'three'])
      return h('div')
    })
    const ComponentC = defineComponent({
      render: renderFn,
      mixins: [ComponentA, ComponentB],
    })
    const el = nodeOps.createElement('div')
    expect(renderFn).toHaveBeenCalledTimes(0)
    render(h(ComponentC), el)
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  test('merge object emits', async () => {
    const twoFn = vi.fn((v: unknown) => !v)
    const ComponentA = defineComponent({
      emits: {
        one: null,
        two: twoFn,
      },
    })
    const ComponentB = defineComponent({
      emits: ['three'],
    })
    const renderFn = vi.fn(function (this: ComponentPublicInstance) {
      expect(this.$options.emits).toEqual({
        one: null,
        two: twoFn,
        three: null,
      })
      expect(this.$options.emits.two).toBe(twoFn)
      return h('div')
    })
    const ComponentC = defineComponent({
      render: renderFn,
      mixins: [ComponentA, ComponentB],
    })
    const el = nodeOps.createElement('div')
    expect(renderFn).toHaveBeenCalledTimes(0)
    render(h(ComponentC), el)
    expect(renderFn).toHaveBeenCalledTimes(1)
  })
})
