import Vue from '@vue/compat'
import {
  DeprecationTypes,
  deprecationData,
  toggleDeprecationWarning,
} from '../../runtime-core/src/compat/compatConfig'

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

describe('should warn deprecation while using compat', () => {
  test('have no compat config', () => {
    const vm = new Vue({
      template: `<div draggable="false">hello</div>`,
    }).$mount()

    expect(vm.$el).toBeInstanceOf(HTMLDivElement)
    expect(vm.$el.outerHTML).toBe(`<div draggable="true">hello</div>`)

    const message = deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERCION]
      .message as Function
    expect(message('draggable', false, true)).toHaveBeenWarned()
  })

  test('set compat config to true', () => {
    Vue.configureCompat({
      ATTR_ENUMERATED_COERCION: true,
    })

    const vm = new Vue({
      template: `<div draggable="false">hello</div>`,
    }).$mount()

    expect(vm.$el).toBeInstanceOf(HTMLDivElement)
    expect(vm.$el.outerHTML).toBe(`<div draggable="true">hello</div>`)

    const message = deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERCION]
      .message as Function
    expect(message('draggable', false, true)).toHaveBeenWarned()
  })

  test('set compat config to "suppress-warning"', () => {
    Vue.configureCompat({
      ATTR_ENUMERATED_COERCION: 'suppress-warning',
    })

    const vm = new Vue({
      template: `<div draggable="false">hello</div>`,
    }).$mount()

    expect(vm.$el).toBeInstanceOf(HTMLDivElement)
    expect(vm.$el.outerHTML).toBe(`<div draggable="true">hello</div>`)

    const message = deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERCION]
      .message as Function
    expect(message('draggable', false, true)).not.toHaveBeenWarned()
    expect(message('draggable', false, false)).not.toHaveBeenWarned()
  })

  test('set compat config to false', () => {
    Vue.configureCompat({
      ATTR_ENUMERATED_COERCION: false,
    })

    const vm = new Vue({
      template: `<div draggable="false">hello</div>`,
    }).$mount()

    expect(vm.$el).toBeInstanceOf(HTMLDivElement)
    expect(vm.$el.outerHTML).toBe(`<div draggable="false">hello</div>`)

    const message = deprecationData[DeprecationTypes.ATTR_ENUMERATED_COERCION]
      .message as Function
    expect(message('draggable', false, true)).not.toHaveBeenWarned()
    expect(message('draggable', false, false)).not.toHaveBeenWarned()
  })
})
