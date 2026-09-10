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

describe('COMPONENT_FUNCTIONAL', () => {
  test('basic usage', async () => {
    const func = {
      name: 'Func',
      functional: true,
      props: {
        x: String,
      },
      inject: ['foo'],
      render: (h: any, { data, props, injections, slots }: any) => {
        return h('div', { id: props.x, class: data.class }, [
          h('div', { class: 'inject' }, injections.foo),
          h('div', { class: 'slot' }, slots().default),
        ])
      },
    }

    const vm = new Vue({
      provide() {
        return {
          foo: 123,
        }
      },
      components: {
        func,
      },
      template: `<func class="foo" x="foo">hello</func>`,
    }).$mount()

    expect(vm.$el.id).toBe('foo')
    expect(vm.$el.className).toBe('foo')
    expect(vm.$el.querySelector('.inject').textContent).toBe('123')
    expect(vm.$el.querySelector('.slot').textContent).toBe('hello')
    expect(vm.$el.outerHTML).toMatchInlineSnapshot(
      `"<div id="foo" class="foo"><div class="inject">123</div><div class="slot">hello</div></div>"`,
    )

    expect(
      (
        deprecationData[DeprecationTypes.COMPONENT_FUNCTIONAL]
          .message as Function
      )(func),
    ).toHaveBeenWarned()
  })

  // #6950
  test('functional component have no instance', async () => {
    const parents: any[] = []
    const ParentReporter = {
      functional: true,
      render(h: any, ctx: any) {
        parents.push(ctx.parent)
        return h('div', 'OK')
      },
    }

    const FunctionalWrapper = {
      functional: true,
      render(h: any) {
        return h(ParentReporter)
      },
    }

    const NonFunctionalRoot = {
      render(h: any) {
        return h('div', [h(ParentReporter), h(FunctionalWrapper)])
      },
    }

    toggleDeprecationWarning(false)
    const vm = new Vue(NonFunctionalRoot).$mount()
    expect(vm.$el.outerHTML).toMatchInlineSnapshot(
      `"<div><div>OK</div><div>OK</div></div>"`,
    )
    expect(parents.length).toBe(2)
    // consistent with 2.x
    expect(parents[0] === parents[1]).toBe(true)
  })

  test('copies compatConfig option', () => {
    const func = {
      name: 'Func',
      functional: true,
      compatConfig: {
        ATTR_FALSE_VALUE: 'suppress-warning' as const,
      },
      render: (h: any) => {
        // should not render required: false due to compatConfig
        return h('div', { 'data-some-attr': false })
      },
    }

    const vm = new Vue({
      components: { func },
      template: `<func class="foo" x="foo">hello</func>`,
    }).$mount()

    expect(vm.$el.outerHTML).toMatchInlineSnapshot(`"<div></div>"`)
    expect(
      (
        deprecationData[DeprecationTypes.COMPONENT_FUNCTIONAL]
          .message as Function
      )(func),
    ).toHaveBeenWarned()
    expect(
      (deprecationData[DeprecationTypes.ATTR_FALSE_VALUE].message as Function)(
        func,
      ),
    ).not.toHaveBeenWarned()
  })
})
