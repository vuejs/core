import Vue from '@vue/compat'
import { nextTick } from '../../runtime-core/src/scheduler'
import {
  DeprecationTypes,
  deprecationData,
  toggleDeprecationWarning
} from '../../runtime-core/src/compat/compatConfig'

beforeEach(() => {
  toggleDeprecationWarning(true)
  Vue.configureCompat({
    MODE: 2,
    GLOBAL_MOUNT: 'suppress-warning',
    GLOBAL_EXTEND: 'suppress-warning'
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

test('root data plain object', () => {
  const vm = new Vue({
    data: { foo: 1 } as any,
    template: `{{ foo }}`
  }).$mount()
  expect(vm.$el.textContent).toBe('1')
  expect(
    deprecationData[DeprecationTypes.OPTIONS_DATA_FN].message
  ).toHaveBeenWarned()
})

test('data deep merge', () => {
  const mixin = {
    data() {
      return {
        foo: {
          baz: 2
        }
      }
    }
  }

  const vm = new Vue({
    mixins: [mixin],
    data: () => ({
      foo: {
        bar: 1
      }
    }),
    template: `{{ foo }}`
  }).$mount()

  expect(vm.$el.textContent).toBe(JSON.stringify({ baz: 2, bar: 1 }, null, 2))
  expect(
    (deprecationData[DeprecationTypes.OPTIONS_DATA_MERGE].message as Function)(
      'foo'
    )
  ).toHaveBeenWarned()
})

test('beforeDestroy/destroyed', async () => {
  const beforeDestroy = jest.fn()
  const destroyed = jest.fn()

  const child = {
    template: `foo`,
    beforeDestroy,
    destroyed
  }

  const vm = new Vue({
    template: `<child v-if="ok"/>`,
    data() {
      return { ok: true }
    },
    components: { child }
  }).$mount() as any

  vm.ok = false
  await nextTick()
  expect(beforeDestroy).toHaveBeenCalled()
  expect(destroyed).toHaveBeenCalled()

  expect(
    deprecationData[DeprecationTypes.OPTIONS_BEFORE_DESTROY].message
  ).toHaveBeenWarned()

  expect(
    deprecationData[DeprecationTypes.OPTIONS_DESTROYED].message
  ).toHaveBeenWarned()
})

test('beforeDestroy/destroyed in Vue.extend components', async () => {
  const beforeDestroy = jest.fn()
  const destroyed = jest.fn()

  const child = Vue.extend({
    template: `foo`,
    beforeDestroy,
    destroyed
  })

  const vm = new Vue({
    template: `<child v-if="ok"/>`,
    data() {
      return { ok: true }
    },
    components: { child }
  }).$mount() as any

  vm.ok = false
  await nextTick()
  expect(beforeDestroy).toHaveBeenCalled()
  expect(destroyed).toHaveBeenCalled()

  expect(
    deprecationData[DeprecationTypes.OPTIONS_BEFORE_DESTROY].message
  ).toHaveBeenWarned()

  expect(
    deprecationData[DeprecationTypes.OPTIONS_DESTROYED].message
  ).toHaveBeenWarned()
})
