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
  createComponent
} from '@vue/runtime-test'

describe('api: options', () => {
  test('data', async () => {
    const Comp = createComponent({
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
    const Comp = createComponent({
      data() {
        return {
          foo: 1
        }
      },
      computed: {
        bar(): number {
          return this.foo + 1
        },
        baz(): number {
          return this.bar + 1
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
    const Comp = createComponent({
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
    }

    assertCall(spyA, 0, [1, undefined])
    assertCall(spyB, 0, [2, undefined])
    assertCall(spyC, 0, [{ qux: 3 }, undefined])
    expect(spyA).toHaveReturnedWith(ctx)
    expect(spyB).toHaveReturnedWith(ctx)
    expect(spyC).toHaveReturnedWith(ctx)

    ctx.foo++
    await nextTick()
    expect(spyA).toHaveBeenCalledTimes(2)
    assertCall(spyA, 1, [2, 1])

    ctx.bar++
    await nextTick()
    expect(spyB).toHaveBeenCalledTimes(2)
    assertCall(spyB, 1, [3, 2])

    ctx.baz.qux++
    await nextTick()
    expect(spyC).toHaveBeenCalledTimes(2)
    // new and old objects have same identity
    assertCall(spyC, 1, [{ qux: 4 }, { qux: 4 }])
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

    expect(renderToString(h(Root))).toBe(`<!---->1112<!---->`)
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
      data() {
        return {
          b: 2
        }
      },
      created(this: any) {
        calls.push('mixinB created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(3)
      },
      mounted() {
        calls.push('mixinB mounted')
      }
    }
    const Comp = {
      mixins: [mixinA, mixinB],
      data() {
        return {
          c: 3
        }
      },
      created(this: any) {
        calls.push('comp created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(3)
      },
      mounted() {
        calls.push('comp mounted')
      },
      render(this: any) {
        return `${this.a}${this.b}${this.c}`
      }
    }

    expect(renderToString(h(Comp))).toBe(`123`)
    expect(calls).toEqual([
      'mixinA created',
      'mixinB created',
      'comp created',
      'mixinA mounted',
      'mixinB mounted',
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
      mounted() {
        calls.push('base')
      }
    }
    const Comp = {
      extends: Base,
      data() {
        return {
          b: 2
        }
      },
      mounted() {
        calls.push('comp')
      },
      render(this: any) {
        return `${this.a}${this.b}`
      }
    }

    expect(renderToString(h(Comp))).toBe(`12`)
    expect(calls).toEqual(['base', 'comp'])
  })

  test('accessing setup() state from options', async () => {
    const Comp = createComponent({
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
})
