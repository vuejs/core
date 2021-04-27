import Vue from '@vue/compat'
import { effect, isReactive } from '@vue/reactivity'
import {
  DeprecationTypes,
  deprecationData,
  toggleDeprecationWarning
} from '../compatConfig'

beforeEach(() => {
  Vue.configureCompat({ MODE: 2 })
})

afterEach(() => {
  Vue.configureCompat({ MODE: 3 })
  toggleDeprecationWarning(false)
})

describe('GLOBAL_MOUNT', () => {
  test('new Vue() with el', () => {
    toggleDeprecationWarning(true)

    const el = document.createElement('div')
    el.innerHTML = `{{ msg }}`
    new Vue({
      el,
      compatConfig: { GLOBAL_MOUNT: true },
      data() {
        return {
          msg: 'hello'
        }
      }
    })
    expect(
      deprecationData[DeprecationTypes.GLOBAL_MOUNT].message
    ).toHaveBeenWarned()
    expect(el.innerHTML).toBe('hello')
  })

  test('new Vue() + $mount', () => {
    const el = document.createElement('div')
    el.innerHTML = `{{ msg }}`
    new Vue({
      data() {
        return {
          msg: 'hello'
        }
      }
    }).$mount(el)
    expect(el.innerHTML).toBe('hello')
  })
})

describe('GLOBAL_MOUNT_CONTAINER', () => {
  test('should warn', () => {
    toggleDeprecationWarning(true)

    const el = document.createElement('div')
    el.innerHTML = `test`
    el.setAttribute('v-bind:id', 'foo')
    new Vue().$mount(el)
    // warning only
    expect(
      deprecationData[DeprecationTypes.GLOBAL_MOUNT].message
    ).toHaveBeenWarned()
    expect(
      deprecationData[DeprecationTypes.GLOBAL_MOUNT_CONTAINER].message
    ).toHaveBeenWarned()
  })
})

describe('GLOBAL_EXTEND', () => {
  // https://github.com/vuejs/vue/blob/dev/test/unit/features/global-api/extend.spec.js
  it('should correctly merge options', () => {
    toggleDeprecationWarning(true)

    const Test = Vue.extend({
      name: 'test',
      a: 1,
      b: 2
    })
    expect(Test.options.a).toBe(1)
    expect(Test.options.b).toBe(2)
    expect(Test.super).toBe(Vue)
    const t = new Test({
      a: 2
    })
    expect(t.$options.a).toBe(2)
    expect(t.$options.b).toBe(2)
    // inheritance
    const Test2 = Test.extend({
      a: 2
    })
    expect(Test2.options.a).toBe(2)
    expect(Test2.options.b).toBe(2)
    const t2 = new Test2({
      a: 3
    })
    expect(t2.$options.a).toBe(3)
    expect(t2.$options.b).toBe(2)

    expect(
      deprecationData[DeprecationTypes.GLOBAL_MOUNT].message
    ).toHaveBeenWarned()
    expect(
      deprecationData[DeprecationTypes.GLOBAL_EXTEND].message
    ).toHaveBeenWarned()
  })

  it('should work when used as components', () => {
    const foo = Vue.extend({
      template: '<span>foo</span>'
    })
    const bar = Vue.extend({
      template: '<span>bar</span>'
    })
    const vm = new Vue({
      template: '<div><foo></foo><bar></bar></div>',
      components: { foo, bar }
    }).$mount()
    expect(vm.$el.innerHTML).toBe('<span>foo</span><span>bar</span>')
  })

  it('should merge lifecycle hooks', () => {
    const calls: number[] = []
    const A = Vue.extend({
      created() {
        calls.push(1)
      }
    })
    const B = A.extend({
      created() {
        calls.push(2)
      }
    })
    new B({
      created() {
        calls.push(3)
      }
    })
    expect(calls).toEqual([1, 2, 3])
  })

  it('should not merge nested mixins created with Vue.extend', () => {
    const A = Vue.extend({
      created: () => {}
    })
    const B = Vue.extend({
      mixins: [A],
      created: () => {}
    })
    const C = Vue.extend({
      extends: B,
      created: () => {}
    })
    const D = Vue.extend({
      mixins: [C],
      created: () => {}
    })
    expect(D.options.created!.length).toBe(4)
  })

  it('should merge methods', () => {
    const A = Vue.extend({
      methods: {
        a() {
          return this.n
        }
      }
    })
    const B = A.extend({
      methods: {
        b() {
          return this.n + 1
        }
      }
    })
    const b = new B({
      data: () => ({ n: 0 }),
      methods: {
        c() {
          return this.n + 2
        }
      }
    }) as any
    expect(b.a()).toBe(0)
    expect(b.b()).toBe(1)
    expect(b.c()).toBe(2)
  })

  it('should merge assets', () => {
    const A = Vue.extend({
      components: {
        aa: {
          template: '<div>A</div>'
        }
      }
    })
    const B = A.extend({
      components: {
        bb: {
          template: '<div>B</div>'
        }
      }
    })
    const b = new B({
      template: '<div><aa></aa><bb></bb></div>'
    }).$mount()
    expect(b.$el.innerHTML).toBe('<div>A</div><div>B</div>')
  })

  it('caching', () => {
    const options = {
      template: '<div></div>'
    }
    const A = Vue.extend(options)
    const B = Vue.extend(options)
    expect(A).toBe(B)
  })

  it('extended options should use different identify from parent', () => {
    const A = Vue.extend({ computed: {} })
    const B = A.extend()
    B.options.computed.b = () => 'foo'
    expect(B.options.computed).not.toBe(A.options.computed)
    expect(A.options.computed.b).toBeUndefined()
  })
})

describe('GLOBAL_PROTOTYPE', () => {
  test('plain properties', () => {
    toggleDeprecationWarning(true)
    Vue.prototype.$test = 1
    const vm = new Vue() as any
    expect(vm.$test).toBe(1)
    delete Vue.prototype.$test
    expect(
      deprecationData[DeprecationTypes.GLOBAL_MOUNT].message
    ).toHaveBeenWarned()
    expect(
      deprecationData[DeprecationTypes.GLOBAL_PROTOTYPE].message
    ).toHaveBeenWarned()
  })

  test('method this context', () => {
    Vue.prototype.$test = function() {
      return this.msg
    }
    const vm = new Vue({
      data() {
        return { msg: 'method' }
      }
    }) as any
    expect(vm.$test()).toBe('method')
    delete Vue.prototype.$test
  })

  test('defined properties', () => {
    Object.defineProperty(Vue.prototype, '$test', {
      configurable: true,
      get() {
        return this.msg
      }
    })
    const vm = new Vue({
      data() {
        return { msg: 'getter' }
      }
    }) as any
    expect(vm.$test).toBe('getter')
    delete Vue.prototype.$test
  })

  test('extended prototype', async () => {
    const Foo = Vue.extend()
    Foo.prototype.$test = 1
    const vm = new Foo() as any
    expect(vm.$test).toBe(1)
    const plain = new Vue() as any
    expect(plain.$test).toBeUndefined()
  })
})

describe('GLOBAL_SET/DELETE', () => {
  test('set', () => {
    toggleDeprecationWarning(true)
    const obj: any = {}
    Vue.set(obj, 'foo', 1)
    expect(obj.foo).toBe(1)
    expect(
      deprecationData[DeprecationTypes.GLOBAL_SET].message
    ).toHaveBeenWarned()
  })

  test('delete', () => {
    toggleDeprecationWarning(true)
    const obj: any = { foo: 1 }
    Vue.delete(obj, 'foo')
    expect('foo' in obj).toBe(false)
    expect(
      deprecationData[DeprecationTypes.GLOBAL_DELETE].message
    ).toHaveBeenWarned()
  })
})

describe('GLOBAL_OBSERVABLE', () => {
  test('should work', () => {
    toggleDeprecationWarning(true)
    const obj = Vue.observable({})
    expect(isReactive(obj)).toBe(true)
    expect(
      deprecationData[DeprecationTypes.GLOBAL_OBSERVABLE].message
    ).toHaveBeenWarned()
  })
})

describe('GLOBAL_PRIVATE_UTIL', () => {
  test('defineReactive', () => {
    toggleDeprecationWarning(true)
    const obj: any = {}
    // @ts-ignore
    Vue.util.defineReactive(obj, 'test', 1)

    let n
    effect(() => {
      n = obj.test
    })
    expect(n).toBe(1)
    obj.test++
    expect(n).toBe(2)

    expect(
      deprecationData[DeprecationTypes.GLOBAL_PRIVATE_UTIL].message
    ).toHaveBeenWarned()
  })
})
