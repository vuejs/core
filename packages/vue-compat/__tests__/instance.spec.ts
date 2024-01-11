import type { Mock } from 'vitest'
import Vue from '@vue/compat'
import type { Slots } from '../../runtime-core/src/componentSlots'
import { Text } from '../../runtime-core/src/vnode'
import {
  DeprecationTypes,
  deprecationData,
  toggleDeprecationWarning,
} from '../../runtime-core/src/compat/compatConfig'
import type { LegacyPublicInstance } from '../../runtime-core/src/compat/instance'

beforeEach(() => {
  toggleDeprecationWarning(true)
  Vue.configureCompat({
    MODE: 2,
    GLOBAL_MOUNT: 'suppress-warning',
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

test('INSTANCE_SET', () => {
  const obj: any = {}
  new Vue().$set(obj, 'foo', 1)
  expect(obj.foo).toBe(1)
  expect(
    deprecationData[DeprecationTypes.INSTANCE_SET].message,
  ).toHaveBeenWarned()
})

test('INSTANCE_DELETE', () => {
  const obj: any = { foo: 1 }
  new Vue().$delete(obj, 'foo')
  expect('foo' in obj).toBe(false)
  expect(
    deprecationData[DeprecationTypes.INSTANCE_DELETE].message,
  ).toHaveBeenWarned()
})

test('INSTANCE_DESTROY', () => {
  new Vue({ template: 'foo' }).$mount().$destroy()
  expect(
    deprecationData[DeprecationTypes.INSTANCE_DESTROY].message,
  ).toHaveBeenWarned()
})

// https://github.com/vuejs/vue/blob/dev/test/unit/features/instance/methods-events.spec.js
describe('INSTANCE_EVENT_EMITTER', () => {
  let vm: LegacyPublicInstance
  let spy: Mock

  beforeEach(() => {
    vm = new Vue()
    spy = vi.fn()
  })

  it('$on', () => {
    vm.$on('test', function (this: any) {
      // expect correct context
      expect(this).toBe(vm)
      spy.apply(this, arguments as unknown as any[])
    })
    vm.$emit('test', 1, 2, 3, 4)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(1, 2, 3, 4)
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$on multi event', () => {
    vm.$on(['test1', 'test2'], function (this: any) {
      expect(this).toBe(vm)
      spy.apply(this, arguments as unknown as any[])
    })
    vm.$emit('test1', 1, 2, 3, 4)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(1, 2, 3, 4)
    vm.$emit('test2', 5, 6, 7, 8)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith(5, 6, 7, 8)
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$off multi event', () => {
    vm.$on(['test1', 'test2', 'test3'], spy)
    vm.$off(['test1', 'test2'], spy)
    vm.$emit('test1')
    vm.$emit('test2')
    expect(spy).not.toHaveBeenCalled()
    vm.$emit('test3', 1, 2, 3, 4)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$off multi event without callback', () => {
    vm.$on(['test1', 'test2'], spy)
    vm.$off(['test1', 'test2'])
    vm.$emit('test1')
    expect(spy).not.toHaveBeenCalled()
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$once', () => {
    vm.$once('test', spy)
    vm.$emit('test', 1, 2, 3)
    vm.$emit('test', 2, 3, 4)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(1, 2, 3)
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$off event added by $once', () => {
    vm.$once('test', spy)
    vm.$off('test', spy) // test off event and this event added by once
    vm.$emit('test', 1, 2, 3)
    expect(spy).not.toHaveBeenCalled()
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$off', () => {
    vm.$on('test1', spy)
    vm.$on('test2', spy)
    vm.$off()
    vm.$emit('test1')
    vm.$emit('test2')
    expect(spy).not.toHaveBeenCalled()
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$off event', () => {
    vm.$on('test1', spy)
    vm.$on('test2', spy)
    vm.$off('test1')
    vm.$off('test1') // test off something that's already off
    vm.$emit('test1', 1)
    vm.$emit('test2', 2)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(2)
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })

  it('$off event + fn', () => {
    const spy2 = vi.fn()
    vm.$on('test', spy)
    vm.$on('test', spy2)
    vm.$off('test', spy)
    vm.$emit('test', 1, 2, 3)
    expect(spy).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledWith(1, 2, 3)
    expect(
      deprecationData[DeprecationTypes.INSTANCE_EVENT_EMITTER].message,
    ).toHaveBeenWarned()
  })
})

describe('INSTANCE_EVENT_HOOKS', () => {
  test('instance API', () => {
    const spy = vi.fn()
    const vm = new Vue({ template: 'foo' })
    vm.$on('hook:mounted', spy)
    vm.$mount()
    expect(spy).toHaveBeenCalled()
    expect(
      (
        deprecationData[DeprecationTypes.INSTANCE_EVENT_HOOKS]
          .message as Function
      )('hook:mounted'),
    ).toHaveBeenWarned()
  })

  test('via template', () => {
    const spy = vi.fn()
    new Vue({
      template: `<child @hook:mounted="spy"/>`,
      methods: { spy },
      components: {
        child: {
          template: 'foo',
        },
      },
    }).$mount()
    expect(spy).toHaveBeenCalled()
    expect(
      (
        deprecationData[DeprecationTypes.INSTANCE_EVENT_HOOKS]
          .message as Function
      )('hook:mounted'),
    ).toHaveBeenWarned()
  })
})

test('INSTANCE_EVENT_CHILDREN', () => {
  const vm = new Vue({
    template: `<child/><div><child v-for="i in 3"/></div>`,
    components: {
      child: {
        template: 'foo',
        data() {
          return { n: 1 }
        },
      },
    },
  }).$mount()
  expect(vm.$children.length).toBe(4)
  vm.$children.forEach((c: any) => {
    expect(c.n).toBe(1)
  })
  expect(
    deprecationData[DeprecationTypes.INSTANCE_CHILDREN].message,
  ).toHaveBeenWarned()
})

test('INSTANCE_LISTENERS', () => {
  const foo = () => 'foo'
  const bar = () => 'bar'
  let listeners: Record<string, Function>

  new Vue({
    template: `<child @click="foo" @custom="bar" />`,
    methods: { foo, bar },
    components: {
      child: {
        template: `<div/>`,
        mounted() {
          listeners = this.$listeners
        },
      },
    },
  }).$mount()

  expect(Object.keys(listeners!)).toMatchObject(['click', 'custom'])
  expect(listeners!.click()).toBe('foo')
  expect(listeners!.custom()).toBe('bar')

  expect(
    deprecationData[DeprecationTypes.INSTANCE_LISTENERS].message,
  ).toHaveBeenWarned()
})

describe('INSTANCE_SCOPED_SLOTS', () => {
  test('explicit usage', () => {
    let slots: Slots
    new Vue({
      template: `<child v-slot="{ msg }">{{ msg }}</child>`,
      components: {
        child: {
          compatConfig: { RENDER_FUNCTION: false },
          render() {
            slots = this.$scopedSlots
          },
        },
      },
    }).$mount()

    expect(slots!.default!({ msg: 'hi' })).toMatchObject([
      {
        type: Text,
        children: 'hi',
      },
    ])

    expect(
      deprecationData[DeprecationTypes.INSTANCE_SCOPED_SLOTS].message,
    ).toHaveBeenWarned()
  })

  test('should not include legacy slot usage in $scopedSlots', () => {
    let normalSlots: Slots
    let scopedSlots: Slots
    new Vue({
      template: `<child><div>default</div></child>`,
      components: {
        child: {
          compatConfig: { RENDER_FUNCTION: false },
          render() {
            normalSlots = this.$slots
            scopedSlots = this.$scopedSlots
          },
        },
      },
    }).$mount()

    expect('default' in normalSlots!).toBe(true)
    expect('default' in scopedSlots!).toBe(false)

    expect(
      deprecationData[DeprecationTypes.INSTANCE_SCOPED_SLOTS].message,
    ).toHaveBeenWarned()
  })
})

test('INSTANCE_ATTR_CLASS_STYLE', () => {
  const vm = new Vue({
    template: `<child class="foo" style="color:red" id="ok" />`,
    components: {
      child: {
        inheritAttrs: false,
        template: `<div><div v-bind="$attrs" /></div>`,
      },
    },
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(vm.$el.outerHTML).toBe(
    `<div class="foo" style="color: red;"><div id="ok"></div></div>`,
  )

  expect(
    (
      deprecationData[DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE]
        .message as Function
    )('Anonymous'),
  ).toHaveBeenWarned()
})
