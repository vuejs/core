import Vue from '@vue/compat'
import { nextTick } from '../../scheduler'
import {
  DeprecationTypes,
  deprecationData,
  toggleDeprecationWarning
} from '../compatConfig'
import { triggerEvent } from './utils'

beforeEach(() => {
  toggleDeprecationWarning(true)
  Vue.configureCompat({
    MODE: 2,
    GLOBAL_MOUNT: 'suppress-warning'
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

test('WATCH_ARRAY', async () => {
  const spy = jest.fn()
  const vm = new Vue({
    data() {
      return {
        foo: []
      }
    },
    watch: {
      foo: spy
    }
  }) as any
  expect(
    deprecationData[DeprecationTypes.WATCH_ARRAY].message
  ).toHaveBeenWarned()

  expect(spy).not.toHaveBeenCalled()
  vm.foo.push(1)
  await nextTick()
  expect(spy).toHaveBeenCalledTimes(1)
})

test('PROPS_DEFAULT_THIS', () => {
  let thisCtx: any
  const Child = {
    customOption: 1,
    inject: ['provided'],
    props: {
      foo: null,
      bar: {
        default(this: any) {
          // copy values since injection must be sync
          thisCtx = {
            foo: this.foo,
            $options: this.$options,
            provided: this.provided
          }
          return this.foo + 1
        }
      }
    },
    template: `{{ bar }}`
  }

  const vm = new Vue({
    components: { Child },
    provide: {
      provided: 2
    },
    template: `<child :foo="0" />`
  }).$mount()

  expect(vm.$el.textContent).toBe('1')
  // other props
  expect(thisCtx.foo).toBe(0)
  // $options
  expect(thisCtx.$options.customOption).toBe(1)
  // injections
  expect(thisCtx.provided).toBe(2)

  expect(
    (deprecationData[DeprecationTypes.PROPS_DEFAULT_THIS].message as Function)(
      'bar'
    )
  ).toHaveBeenWarned()
})

test('V_FOR_REF', async () => {
  const vm = new Vue({
    data() {
      return {
        ok: true,
        list: [1, 2, 3]
      }
    },
    template: `
    <template v-if="ok">
      <li v-for="i in list" ref="list">{{ i }}</li>
    </template>
    `
  }).$mount() as any

  const mapRefs = () => vm.$refs.list.map((el: HTMLElement) => el.textContent)
  expect(mapRefs()).toMatchObject(['1', '2', '3'])

  expect(deprecationData[DeprecationTypes.V_FOR_REF].message).toHaveBeenWarned()

  vm.list.push(4)
  await nextTick()
  expect(mapRefs()).toMatchObject(['1', '2', '3', '4'])

  vm.list.shift()
  await nextTick()
  expect(mapRefs()).toMatchObject(['2', '3', '4'])

  vm.ok = !vm.ok
  await nextTick()
  expect(mapRefs()).toMatchObject([])

  vm.ok = !vm.ok
  await nextTick()
  expect(mapRefs()).toMatchObject(['2', '3', '4'])
})

test('V_ON_KEYCODE_MODIFIER', () => {
  const spy = jest.fn()
  const vm = new Vue({
    template: `<input @keyup.1="spy">`,
    methods: { spy }
  }).$mount()
  triggerEvent(vm.$el, 'keyup', e => {
    e.key = '_'
    e.keyCode = 1
  })
  expect(spy).toHaveBeenCalled()
  expect(
    deprecationData[DeprecationTypes.V_ON_KEYCODE_MODIFIER].message
  ).toHaveBeenWarned()
})

test('CUSTOM_DIR', async () => {
  const myDir = {
    bind: jest.fn(),
    inserted: jest.fn(),
    update: jest.fn(),
    componentUpdated: jest.fn(),
    unbind: jest.fn()
  } as any

  const getCalls = () =>
    Object.keys(myDir).map(key => myDir[key].mock.calls.length)

  const vm = new Vue({
    data() {
      return {
        ok: true,
        foo: 1
      }
    },
    template: `<div v-if="ok" v-my-dir="foo"/>`,
    directives: {
      myDir
    }
  }).$mount() as any

  expect(getCalls()).toMatchObject([1, 1, 0, 0, 0])

  expect(
    (deprecationData[DeprecationTypes.CUSTOM_DIR].message as Function)(
      'bind',
      'beforeMount'
    )
  ).toHaveBeenWarned()
  expect(
    (deprecationData[DeprecationTypes.CUSTOM_DIR].message as Function)(
      'inserted',
      'mounted'
    )
  ).toHaveBeenWarned()

  vm.foo++
  await nextTick()
  expect(getCalls()).toMatchObject([1, 1, 1, 1, 0])

  expect(
    (deprecationData[DeprecationTypes.CUSTOM_DIR].message as Function)(
      'update',
      'updated'
    )
  ).toHaveBeenWarned()
  expect(
    (deprecationData[DeprecationTypes.CUSTOM_DIR].message as Function)(
      'componentUpdated',
      'updated'
    )
  ).toHaveBeenWarned()
})

test('ATTR_FALSE_VALUE', () => {
  const vm = new Vue({
    template: `<div :id="false" :foo="false"/>`
  }).$mount()
  expect(vm.$el.hasAttribute('id')).toBe(false)
  expect(vm.$el.hasAttribute('foo')).toBe(false)
  expect(
    (deprecationData[DeprecationTypes.ATTR_FALSE_VALUE].message as Function)(
      'id'
    )
  ).toHaveBeenWarned()
  expect(
    (deprecationData[DeprecationTypes.ATTR_FALSE_VALUE].message as Function)(
      'foo'
    )
  ).toHaveBeenWarned()
})

test('ATTR_ENUMERATED_COERSION', () => {
  const vm = new Vue({
    template: `<div :draggable="null" :spellcheck="0" contenteditable="foo" />`
  }).$mount()
  expect(vm.$el.getAttribute('draggable')).toBe('false')
  expect(vm.$el.getAttribute('spellcheck')).toBe('true')
  expect(vm.$el.getAttribute('contenteditable')).toBe('true')
  expect(
    (deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERSION]
      .message as Function)('draggable', null, 'false')
  ).toHaveBeenWarned()
  expect(
    (deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERSION]
      .message as Function)('spellcheck', 0, 'true')
  ).toHaveBeenWarned()
  expect(
    (deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERSION]
      .message as Function)('contenteditable', 'foo', 'true')
  ).toHaveBeenWarned()
})
