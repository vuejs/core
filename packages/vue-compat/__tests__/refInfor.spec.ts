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
    GLOBAL_MOUNT: 'suppress-warning'
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
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
