import Vue from '@vue/compat'
import { CompilerDeprecationTypes } from '../../compiler-core/src'
import {
  deprecationData,
  DeprecationTypes,
  toggleDeprecationWarning
} from '../../runtime-core/src/compat/compatConfig'

beforeEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 2, GLOBAL_MOUNT: 'suppress-warning' })
})

afterEach(() => {
  Vue.configureCompat({ MODE: 3 })
  toggleDeprecationWarning(false)
})

describe('FILTERS', () => {
  function upper(v: string) {
    return v.toUpperCase()
  }

  function lower(v: string) {
    return v.toLowerCase()
  }

  function reverse(v: string) {
    return v.split('').reverse().join('')
  }

  function double(v: number) {
    return v * 2
  }

  it('global registration', () => {
    toggleDeprecationWarning(true)
    Vue.filter('globalUpper', upper)
    expect(Vue.filter('globalUpper')).toBe(upper)
    const vm = new Vue({
      template: '<div>{{ msg | globalUpper }}</div>',
      data: () => ({
        msg: 'hi'
      })
    }).$mount()
    expect(vm.$el).toBeInstanceOf(HTMLDivElement)
    expect(vm.$el.textContent).toBe('HI')
    expect(deprecationData[DeprecationTypes.FILTERS].message).toHaveBeenWarned()
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
    Vue.filter('globalUpper', undefined)
  })

  it('basic usage', () => {
    const vm = new Vue({
      template: '<div>{{ msg | upper }}</div>',
      data: () => ({
        msg: 'hi'
      }),
      filters: {
        upper
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('HI')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('chained usage', () => {
    const vm = new Vue({
      template: '<div>{{ msg | upper | reverse }}</div>',
      data: () => ({
        msg: 'hi'
      }),
      filters: {
        upper,
        reverse
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('IH')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('in v-bind', () => {
    const vm = new Vue({
      template: `
        <div
          v-bind:id="id | upper | reverse"
          :class="cls | reverse"
          :ref="ref | lower">
        </div>
      `,
      filters: {
        upper,
        reverse,
        lower
      },
      data: () => ({
        id: 'abc',
        cls: 'foo',
        ref: 'BAR'
      })
    }).$mount()
    expect(vm.$el.id).toBe('CBA')
    expect(vm.$el.className).toBe('oof')
    expect(vm.$refs.bar).toBe(vm.$el)
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle regex with pipe', () => {
    const vm = new Vue({
      template: `<test ref="test" :pattern="/a|b\\// | identity"></test>`,
      filters: { identity: (v: any) => v },
      components: {
        test: {
          props: ['pattern'],
          template: '<div></div>'
        }
      }
    }).$mount() as any
    expect(vm.$refs.test.pattern instanceof RegExp).toBe(true)
    expect(vm.$refs.test.pattern.toString()).toBe('/a|b\\//')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle division', () => {
    const vm = new Vue({
      data: () => ({ a: 2 }),
      template: `<div>{{ 1/a / 4 | double }}</div>`,
      filters: { double }
    }).$mount()
    expect(vm.$el.textContent).toBe(String(1 / 4))
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle division with parenthesis', () => {
    const vm = new Vue({
      data: () => ({ a: 20 }),
      template: `<div>{{ (a*2) / 5 | double }}</div>`,
      filters: { double }
    }).$mount()
    expect(vm.$el.textContent).toBe(String(16))
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle division with dot', () => {
    const vm = new Vue({
      template: `<div>{{ 20. / 5 | double }}</div>`,
      filters: { double }
    }).$mount()
    expect(vm.$el.textContent).toBe(String(8))
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle division with array values', () => {
    const vm = new Vue({
      data: () => ({ a: [20] }),
      template: `<div>{{ a[0] / 5 | double }}</div>`,
      filters: { double }
    }).$mount()
    expect(vm.$el.textContent).toBe(String(8))
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle division with hash values', () => {
    const vm = new Vue({
      data: () => ({ a: { n: 20 } }),
      template: `<div>{{ a['n'] / 5 | double }}</div>`,
      filters: { double }
    }).$mount()
    expect(vm.$el.textContent).toBe(String(8))
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('handle division with variable_', () => {
    const vm = new Vue({
      data: () => ({ a_: 8 }),
      template: `<div>{{ a_ / 2 | double }}</div>`,
      filters: { double }
    }).$mount()
    expect(vm.$el.textContent).toBe(String(8))
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('arguments', () => {
    const vm = new Vue({
      template: `<div>{{ msg | add(a, 3) }}</div>`,
      data: () => ({
        msg: 1,
        a: 2
      }),
      filters: {
        add: (v: number, arg1: number, arg2: number) => v + arg1 + arg2
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('6')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('quotes', () => {
    const vm = new Vue({
      template: `<div>{{ msg + "b | c" + 'd' | upper }}</div>`,
      data: () => ({
        msg: 'a'
      }),
      filters: {
        upper
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('AB | CD')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('double pipe', () => {
    const vm = new Vue({
      template: `<div>{{ b || msg | upper }}</div>`,
      data: () => ({
        b: false,
        msg: 'a'
      }),
      filters: {
        upper
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('A')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('object literal', () => {
    const vm = new Vue({
      template: `<div>{{ { a: 123 } | pick('a') }}</div>`,
      filters: {
        pick: (v: any, key: string) => v[key]
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('123')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('array literal', () => {
    const vm = new Vue({
      template: `<div>{{ [1, 2, 3] | reverse }}</div>`,
      filters: {
        reverse: (arr: any[]) => arr.reverse().join(',')
      }
    }).$mount()
    expect(vm.$el.textContent).toBe('3,2,1')
    expect(CompilerDeprecationTypes.COMPILER_FILTERS).toHaveBeenWarned()
  })

  it('bigint support', () => {
    const vm = new Vue({
      template: `<div>{{ BigInt(BigInt(10000000)) + BigInt(2000000000n) * 3000000n }}</div>`
    }).$mount()
    expect(vm.$el.textContent).toBe('6000000010000000')
  })
})
