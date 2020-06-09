import {
  h,
  nodeOps,
  render,
  serializeInner,
  triggerEvent,
  TestElement,
  nextTick,
  renderToString,
  ref,
  defineComponent
} from '@vue/runtime-test'
import { mockWarn } from '@vue/shared'

describe('api: options', () => {
  test('data', async () => {
    const Comp = defineComponent({
      data() {
        return {
          foo: 1
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.foo++
            }
          },
          this.foo
        )
      }
    })
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>1</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>2</div>`)
  })

  test('computed', async () => {
    const Comp = defineComponent({
      data() {
        return {
          foo: 1
        }
      },
      computed: {
        bar(): number {
          return this.foo + 1
        },
        baz: (vm): number => vm.bar + 1
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.foo++
            }
          },
          this.bar + this.baz
        )
      }
    })
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>5</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>7</div>`)
  })

  test('methods', async () => {
    const Comp = defineComponent({
      data() {
        return {
          foo: 1
        }
      },
      methods: {
        inc() {
          this.foo++
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: this.inc
          },
          this.foo
        )
      }
    })
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>1</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>2</div>`)
  })

  test('watch', async () => {
    function returnThis(this: any) {
      return this
    }
    const spyA = jest.fn(returnThis)
    const spyB = jest.fn(returnThis)
    const spyC = jest.fn(returnThis)

    let ctx: any
    const Comp = {
      data() {
        return {
          foo: 1,
          bar: 2,
          baz: {
            qux: 3
          }
        }
      },
      watch: {
        // string method name
        foo: 'onFooChange',
        // direct function
        bar: spyB,
        baz: {
          handler: spyC,
          deep: true
        }
      },
      methods: {
        onFooChange: spyA
      },
      render() {
        ctx = this
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    function assertCall(spy: jest.Mock, callIndex: number, args: any[]) {
      expect(spy.mock.calls[callIndex].slice(0, 2)).toMatchObject(args)
      expect(spy).toHaveReturnedWith(ctx)
    }

    ctx.foo++
    await nextTick()
    expect(spyA).toHaveBeenCalledTimes(1)
    assertCall(spyA, 0, [2, 1])

    ctx.bar++
    await nextTick()
    expect(spyB).toHaveBeenCalledTimes(1)
    assertCall(spyB, 0, [3, 2])

    ctx.baz.qux++
    await nextTick()
    expect(spyC).toHaveBeenCalledTimes(1)
    // new and old objects have same identity
    assertCall(spyC, 0, [{ qux: 4 }, { qux: 4 }])
  })

  test('watch array', async () => {
    function returnThis(this: any) {
      return this
    }
    const spyA = jest.fn(returnThis)
    const spyB = jest.fn(returnThis)
    const spyC = jest.fn(returnThis)

    let ctx: any
    const Comp = {
      data() {
        return {
          foo: 1,
          bar: 2,
          baz: {
            qux: 3
          }
        }
      },
      watch: {
        // string method name
        foo: ['onFooChange'],
        // direct function
        bar: [spyB],
        baz: [
          {
            handler: spyC,
            deep: true
          }
        ]
      },
      methods: {
        onFooChange: spyA
      },
      render() {
        ctx = this
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    function assertCall(spy: jest.Mock, callIndex: number, args: any[]) {
      expect(spy.mock.calls[callIndex].slice(0, 2)).toMatchObject(args)
      expect(spy).toHaveReturnedWith(ctx)
    }

    ctx.foo++
    await nextTick()
    expect(spyA).toHaveBeenCalledTimes(1)
    assertCall(spyA, 0, [2, 1])

    ctx.bar++
    await nextTick()
    expect(spyB).toHaveBeenCalledTimes(1)
    assertCall(spyB, 0, [3, 2])

    ctx.baz.qux++
    await nextTick()
    expect(spyC).toHaveBeenCalledTimes(1)
    // new and old objects have same identity
    assertCall(spyC, 0, [{ qux: 4 }, { qux: 4 }])
  })

  test('provide/inject', () => {
    const Root = {
      data() {
        return {
          a: 1
        }
      },
      provide() {
        return {
          a: this.a
        }
      },
      render() {
        return [h(ChildA), h(ChildB), h(ChildC), h(ChildD)]
      }
    } as any
    const ChildA = {
      inject: ['a'],
      render() {
        return this.a
      }
    } as any
    const ChildB = {
      // object alias
      inject: { b: 'a' },
      render() {
        return this.b
      }
    } as any
    const ChildC = {
      inject: {
        b: {
          from: 'a'
        }
      },
      render() {
        return this.b
      }
    } as any
    const ChildD = {
      inject: {
        b: {
          from: 'c',
          default: 2
        }
      },
      render() {
        return this.b
      }
    } as any

    expect(renderToString(h(Root))).toBe(`1112`)
  })

  test('lifecycle', async () => {
    const count = ref(0)
    const root = nodeOps.createElement('div')
    const calls: string[] = []

    const Root = {
      beforeCreate() {
        calls.push('root beforeCreate')
      },
      created() {
        calls.push('root created')
      },
      beforeMount() {
        calls.push('root onBeforeMount')
      },
      mounted() {
        calls.push('root onMounted')
      },
      beforeUpdate() {
        calls.push('root onBeforeUpdate')
      },
      updated() {
        calls.push('root onUpdated')
      },
      beforeUnmount() {
        calls.push('root onBeforeUnmount')
      },
      unmounted() {
        calls.push('root onUnmounted')
      },
      render() {
        return h(Mid, { count: count.value })
      }
    }

    const Mid = {
      beforeCreate() {
        calls.push('mid beforeCreate')
      },
      created() {
        calls.push('mid created')
      },
      beforeMount() {
        calls.push('mid onBeforeMount')
      },
      mounted() {
        calls.push('mid onMounted')
      },
      beforeUpdate() {
        calls.push('mid onBeforeUpdate')
      },
      updated() {
        calls.push('mid onUpdated')
      },
      beforeUnmount() {
        calls.push('mid onBeforeUnmount')
      },
      unmounted() {
        calls.push('mid onUnmounted')
      },
      render(this: any) {
        return h(Child, { count: this.$props.count })
      }
    }

    const Child = {
      beforeCreate() {
        calls.push('child beforeCreate')
      },
      created() {
        calls.push('child created')
      },
      beforeMount() {
        calls.push('child onBeforeMount')
      },
      mounted() {
        calls.push('child onMounted')
      },
      beforeUpdate() {
        calls.push('child onBeforeUpdate')
      },
      updated() {
        calls.push('child onUpdated')
      },
      beforeUnmount() {
        calls.push('child onBeforeUnmount')
      },
      unmounted() {
        calls.push('child onUnmounted')
      },
      render(this: any) {
        return h('div', this.$props.count)
      }
    }

    // mount
    render(h(Root), root)
    expect(calls).toEqual([
      'root beforeCreate',
      'root created',
      'root onBeforeMount',
      'mid beforeCreate',
      'mid created',
      'mid onBeforeMount',
      'child beforeCreate',
      'child created',
      'child onBeforeMount',
      'child onMounted',
      'mid onMounted',
      'root onMounted'
    ])

    calls.length = 0

    // update
    count.value++
    await nextTick()
    expect(calls).toEqual([
      'root onBeforeUpdate',
      'mid onBeforeUpdate',
      'child onBeforeUpdate',
      'child onUpdated',
      'mid onUpdated',
      'root onUpdated'
    ])

    calls.length = 0

    // unmount
    render(null, root)
    expect(calls).toEqual([
      'root onBeforeUnmount',
      'mid onBeforeUnmount',
      'child onBeforeUnmount',
      'child onUnmounted',
      'mid onUnmounted',
      'root onUnmounted'
    ])
  })

  test('mixins', () => {
    const calls: string[] = []
    const mixinA = {
      data() {
        return {
          a: 1
        }
      },
      created(this: any) {
        calls.push('mixinA created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(3)
      },
      mounted() {
        calls.push('mixinA mounted')
      }
    }
    const mixinB = {
      props: {
        bP: {
          type: String
        }
      },
      data() {
        return {
          b: 2
        }
      },
      created(this: any) {
        calls.push('mixinB created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.bP).toBeUndefined()
        expect(this.c).toBe(3)
        expect(this.cP1).toBeUndefined()
      },
      mounted() {
        calls.push('mixinB mounted')
      }
    }
    const mixinC = defineComponent({
      props: ['cP1', 'cP2'],
      data() {
        return {
          c: 3
        }
      },
      created() {
        calls.push('mixinC created')
        expect(this.c).toBe(3)
        expect(this.cP1).toBeUndefined()
      },
      mounted() {
        calls.push('mixinC mounted')
      }
    })
    const Comp = defineComponent({
      props: {
        aaa: String
      },
      mixins: [defineComponent(mixinA), defineComponent(mixinB), mixinC],
      data() {
        return {
          z: 4
        }
      },
      created() {
        calls.push('comp created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.bP).toBeUndefined()
        expect(this.c).toBe(3)
        expect(this.cP2).toBeUndefined()
        expect(this.z).toBe(4)
      },
      mounted() {
        calls.push('comp mounted')
      },
      render() {
        return `${this.a}${this.b}${this.c}`
      }
    })
    expect(renderToString(h(Comp))).toBe(`123`)
    expect(calls).toEqual([
      'mixinA created',
      'mixinB created',
      'mixinC created',
      'comp created',
      'mixinA mounted',
      'mixinB mounted',
      'mixinC mounted',
      'comp mounted'
    ])
  })

  test('extends', () => {
    const calls: string[] = []
    const Base = {
      data() {
        return {
          a: 1
        }
      },
      methods: {
        sayA() {}
      },
      mounted(this: any) {
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        calls.push('base')
      }
    }
    const Comp = defineComponent({
      extends: defineComponent(Base),
      data() {
        return {
          b: 2
        }
      },
      mounted() {
        calls.push('comp')
      },
      render() {
        return `${this.a}${this.b}`
      }
    })

    expect(renderToString(h(Comp))).toBe(`12`)
    expect(calls).toEqual(['base', 'comp'])
  })

  test('extends with mixins', () => {
    const calls: string[] = []
    const Base = {
      data() {
        return {
          a: 1
        }
      },
      methods: {
        sayA() {}
      },
      mounted(this: any) {
        expect(this.a).toBe(1)
        expect(this.b).toBeTruthy()
        expect(this.c).toBe(2)
        calls.push('base')
      }
    }
    const Base2 = {
      data() {
        return {
          b: true
        }
      },
      mounted(this: any) {
        expect(this.a).toBe(1)
        expect(this.b).toBeTruthy()
        expect(this.c).toBe(2)
        calls.push('base2')
      }
    }
    const Comp = defineComponent({
      extends: defineComponent(Base),
      mixins: [defineComponent(Base2)],
      data() {
        return {
          c: 2
        }
      },
      mounted() {
        calls.push('comp')
      },
      render() {
        return `${this.a}${this.b}${this.c}`
      }
    })

    expect(renderToString(h(Comp))).toBe(`1true2`)
    expect(calls).toEqual(['base', 'base2', 'comp'])
  })

  test('accessing setup() state from options', async () => {
    const Comp = defineComponent({
      setup() {
        return {
          count: ref(0)
        }
      },
      data() {
        return {
          plusOne: (this as any).count + 1
        }
      },
      computed: {
        plusTwo(): number {
          return this.count + 2
        }
      },
      methods: {
        inc() {
          this.count++
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: this.inc
          },
          `${this.count},${this.plusOne},${this.plusTwo}`
        )
      }
    })
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>0,1,2</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1,1,3</div>`)
  })

  // #1016
  test('watcher initialization should be deferred in mixins', async () => {
    const mixin1 = {
      data() {
        return {
          mixin1Data: 'mixin1'
        }
      },
      methods: {}
    }

    const watchSpy = jest.fn()
    const mixin2 = {
      watch: {
        mixin3Data: watchSpy
      }
    }

    const mixin3 = {
      data() {
        return {
          mixin3Data: 'mixin3'
        }
      },
      methods: {}
    }

    let vm: any
    const Comp = {
      mixins: [mixin1, mixin2, mixin3],
      render() {},
      created() {
        vm = this
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    // should have no warnings
    vm.mixin3Data = 'hello'
    await nextTick()
    expect(watchSpy.mock.calls[0].slice(0, 2)).toEqual(['hello', 'mixin3'])
  })

  describe('warnings', () => {
    mockWarn()

    test('Expected a function as watch handler', () => {
      const Comp = {
        watch: {
          foo: 'notExistingMethod'
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)

      expect(
        'Invalid watch handler specified by key "notExistingMethod"'
      ).toHaveBeenWarned()
    })

    test('Invalid watch option', () => {
      const Comp = {
        watch: { foo: true },
        render() {}
      }

      const root = nodeOps.createElement('div')
      // @ts-ignore
      render(h(Comp), root)

      expect('Invalid watch option: "foo"').toHaveBeenWarned()
    })

    test('computed with setter and no getter', () => {
      const Comp = {
        computed: {
          foo: {
            set() {}
          }
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect('Computed property "foo" has no getter.').toHaveBeenWarned()
    })

    test('assigning to computed with no setter', () => {
      let instance: any
      const Comp = {
        computed: {
          foo: {
            get() {}
          }
        },
        mounted() {
          instance = this
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      instance.foo = 1
      expect(
        'Write operation failed: computed property "foo" is readonly'
      ).toHaveBeenWarned()
    })

    test('inject property is already declared in props', () => {
      const Comp = {
        data() {
          return {
            a: 1
          }
        },
        provide() {
          return {
            a: this.a
          }
        },
        render() {
          return [h(ChildA)]
        }
      } as any
      const ChildA = {
        props: { a: Number },
        inject: ['a'],
        render() {
          return this.a
        }
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Inject property "a" is already defined in Props.`
      ).toHaveBeenWarned()
    })

    test('methods property is not a function', () => {
      const Comp = {
        methods: {
          foo: 1
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Method "foo" has type "number" in the component definition. ` +
          `Did you reference the function correctly?`
      ).toHaveBeenWarned()
    })

    test('methods property is already declared in props', () => {
      const Comp = {
        props: {
          foo: Number
        },
        methods: {
          foo() {}
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Methods property "foo" is already defined in Props.`
      ).toHaveBeenWarned()
    })

    test('methods property is already declared in inject', () => {
      const Comp = {
        data() {
          return {
            a: 1
          }
        },
        provide() {
          return {
            a: this.a
          }
        },
        render() {
          return [h(ChildA)]
        }
      } as any
      const ChildA = {
        methods: {
          a: () => null
        },
        inject: ['a'],
        render() {
          return this.a
        }
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Methods property "a" is already defined in Inject.`
      ).toHaveBeenWarned()
    })

    test('data property is already declared in props', () => {
      const Comp = {
        props: { foo: Number },
        data: () => ({
          foo: 1
        }),
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Data property "foo" is already defined in Props.`
      ).toHaveBeenWarned()
    })

    test('data property is already declared in inject', () => {
      const Comp = {
        data() {
          return {
            a: 1
          }
        },
        provide() {
          return {
            a: this.a
          }
        },
        render() {
          return [h(ChildA)]
        }
      } as any
      const ChildA = {
        data() {
          return {
            a: 1
          }
        },
        inject: ['a'],
        render() {
          return this.a
        }
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Data property "a" is already defined in Inject.`
      ).toHaveBeenWarned()
    })

    test('data property is already declared in methods', () => {
      const Comp = {
        data: () => ({
          foo: 1
        }),
        methods: {
          foo() {}
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Data property "foo" is already defined in Methods.`
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in props', () => {
      const Comp = {
        props: { foo: Number },
        computed: {
          foo() {}
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "foo" is already defined in Props.`
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in inject', () => {
      const Comp = {
        data() {
          return {
            a: 1
          }
        },
        provide() {
          return {
            a: this.a
          }
        },
        render() {
          return [h(ChildA)]
        }
      } as any
      const ChildA = {
        computed: {
          a: {
            get() {},
            set() {}
          }
        },
        inject: ['a'],
        render() {
          return this.a
        }
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "a" is already defined in Inject.`
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in methods', () => {
      const Comp = {
        computed: {
          foo() {}
        },
        methods: {
          foo() {}
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "foo" is already defined in Methods.`
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in data', () => {
      const Comp = {
        data: () => ({
          foo: 1
        }),
        computed: {
          foo() {}
        },
        render() {}
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "foo" is already defined in Data.`
      ).toHaveBeenWarned()
    })
  })
})
