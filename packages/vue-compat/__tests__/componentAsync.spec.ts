import Vue from '@vue/compat'
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

const timeout = (n: number) => new Promise(r => setTimeout(r, n))

describe('COMPONENT_ASYNC', () => {
  test('resolve/reject', async () => {
    let resolve: any
    const comp = (r: any) => {
      resolve = r
    }
    const vm = new Vue({
      template: `<div><comp/></div>`,
      components: { comp }
    }).$mount()
    expect(vm.$el.innerHTML).toBe(`<!---->`)

    resolve({ template: 'foo' })
    await timeout(0)
    expect(vm.$el.innerHTML).toBe(`foo`)

    expect(
      (deprecationData[DeprecationTypes.COMPONENT_ASYNC].message as Function)(
        comp
      )
    ).toHaveBeenWarned()
  })

  test('Promise', async () => {
    const comp = () => Promise.resolve({ template: 'foo' })
    const vm = new Vue({
      template: `<div><comp/></div>`,
      components: { comp }
    }).$mount()
    expect(vm.$el.innerHTML).toBe(`<!---->`)
    await timeout(0)
    expect(vm.$el.innerHTML).toBe(`foo`)

    expect(
      (deprecationData[DeprecationTypes.COMPONENT_ASYNC].message as Function)(
        comp
      )
    ).toHaveBeenWarned()
  })

  test('object syntax', async () => {
    const comp = () => ({
      component: Promise.resolve({ template: 'foo' })
    })

    const vm = new Vue({
      template: `<div><comp/></div>`,
      components: { comp }
    }).$mount()
    expect(vm.$el.innerHTML).toBe(`<!---->`)
    await timeout(0)
    expect(vm.$el.innerHTML).toBe(`foo`)

    expect(
      (deprecationData[DeprecationTypes.COMPONENT_ASYNC].message as Function)(
        comp
      )
    ).toHaveBeenWarned()
  })
})
