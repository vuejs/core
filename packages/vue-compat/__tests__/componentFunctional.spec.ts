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

describe('COMPONENT_FUNCTIONAL', () => {
  test('basic usage', async () => {
    const func = {
      name: 'Func',
      functional: true,
      props: {
        x: String
      },
      inject: ['foo'],
      render: (h: any, { data, props, injections, slots }: any) => {
        return h('div', { id: props.x, class: data.class }, [
          h('div', { class: 'inject' }, injections.foo),
          h('div', { class: 'slot' }, slots().default)
        ])
      }
    }

    const vm = new Vue({
      provide() {
        return {
          foo: 123
        }
      },
      components: {
        func
      },
      template: `<func class="foo" x="foo">hello</func>`
    }).$mount()

    expect(vm.$el.id).toBe('foo')
    expect(vm.$el.className).toBe('foo')
    expect(vm.$el.querySelector('.inject').textContent).toBe('123')
    expect(vm.$el.querySelector('.slot').textContent).toBe('hello')
    expect(vm.$el.outerHTML).toMatchInlineSnapshot(
      '"<div id=\\"foo\\" class=\\"foo\\"><div class=\\"inject\\">123</div><div class=\\"slot\\">hello</div></div>"'
    )

    expect(
      (
        deprecationData[DeprecationTypes.COMPONENT_FUNCTIONAL]
          .message as Function
      )(func)
    ).toHaveBeenWarned()
  })

  test('copies compatConfig option', () => {
    const func = {
      name: 'Func',
      functional: true,
      compatConfig: {
        ATTR_FALSE_VALUE: 'suppress-warning' as const
      },
      render: (h: any) => {
        // should not render required: false due to compatConfig
        return h('div', { 'data-some-attr': false })
      }
    }

    const vm = new Vue({
      components: { func },
      template: `<func class="foo" x="foo">hello</func>`
    }).$mount()

    expect(vm.$el.outerHTML).toMatchInlineSnapshot(`"<div></div>"`)
    expect(
      (
        deprecationData[DeprecationTypes.COMPONENT_FUNCTIONAL]
          .message as Function
      )(func)
    ).toHaveBeenWarned()
    expect(
      (deprecationData[DeprecationTypes.ATTR_FALSE_VALUE].message as Function)(
        func
      )
    ).not.toHaveBeenWarned()
  })
})
