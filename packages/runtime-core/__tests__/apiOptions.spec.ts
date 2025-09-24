/**
 * @vitest-environment jsdom
 */
import type { Mock } from 'vitest'
import {
  type ComponentOptions,
  type TestElement,
  computed,
  createApp,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  ref,
  render,
  renderToString,
  serializeInner,
  triggerEvent,
} from '@vue/runtime-test'
import { render as domRender } from 'vue'

describe('api: options', () => {
  test('data', async () => {
    const Comp = defineComponent({
      data() {
        return {
          foo: 1,
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.foo++
            },
          },
          this.foo,
        )
      },
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
          foo: 1,
        }
      },
      computed: {
        bar(): number {
          return this.foo + 1
        },
        baz: (vm: any): number => vm.bar + 1,
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.foo++
            },
          },
          this.bar + this.baz,
        )
      },
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
        // #3300 method on ctx should be overwritable
        this.incBy = this.incBy.bind(this, 2)
        return {
          foo: 1,
        }
      },
      methods: {
        inc() {
          this.foo++
        },
        incBy(n = 0) {
          this.foo += n
        },
      },
      render() {
        return h(
          'div',
          {
            onClick: this.inc,
            onFoo: this.incBy,
          },
          this.foo,
        )
      },
    })
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>1</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>2</div>`)

    triggerEvent(root.children[0] as TestElement, 'foo')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>4</div>`)
  })

  test("component's own methods have higher priority than global properties", async () => {
    const app = createApp({
      methods: {
        foo() {
          return 'foo'
        },
      },
      render() {
        return this.foo()
      },
    })
    app.config.globalProperties.foo = () => 'bar'

    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(serializeInner(root)).toBe(`foo`)
  })

  test('watch', async () => {
    function returnThis(this: any) {
      return this
    }
    const spyA = vi.fn(returnThis)
    const spyB = vi.fn(returnThis)
    const spyC = vi.fn(returnThis)
    const spyD = vi.fn(returnThis)
    const spyE = vi.fn(returnThis)

    let ctx: any
    const Comp = {
      data() {
        return {
          foo: 1,
          bar: 2,
          baz: {
            qux: 3,
          },
          qux: 4,
          dot: {
            path: 5,
          },
        }
      },
      watch: {
        // string method name
        foo: 'onFooChange',
        // direct function
        bar: spyB,
        baz: {
          handler: spyC,
          deep: true,
        },
        qux: {
          handler: 'onQuxChange',
        },
        'dot.path': spyE,
      },
      methods: {
        onFooChange: spyA,
        onQuxChange: spyD,
      },
      render() {
        ctx = this
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    function assertCall(spy: Mock, callIndex: number, args: any[]) {
      expect(spy.mock.calls[callIndex].slice(0, 2)).toMatchObject(args)
      expect(spy.mock.results[callIndex].value).toBe(ctx)
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

    ctx.qux++
    await nextTick()
    expect(spyD).toHaveBeenCalledTimes(1)
    assertCall(spyD, 0, [5, 4])

    ctx.dot.path++
    await nextTick()
    expect(spyE).toHaveBeenCalledTimes(1)
    assertCall(spyE, 0, [6, 5])
  })

  test('watch array', async () => {
    function returnThis(this: any) {
      return this
    }
    const spyA = vi.fn(returnThis)
    const spyB = vi.fn(returnThis)
    const spyC = vi.fn(returnThis)

    let ctx: any
    const Comp = {
      data() {
        return {
          foo: 1,
          bar: 2,
          baz: {
            qux: 3,
          },
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
            deep: true,
          },
        ],
      },
      methods: {
        onFooChange: spyA,
      },
      render() {
        ctx = this
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    function assertCall(spy: Mock, callIndex: number, args: any[]) {
      expect(spy.mock.calls[callIndex].slice(0, 2)).toMatchObject(args)
      expect(spy.mock.results[callIndex].value).toBe(ctx)
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

  // #3966
  test('watch merging from mixins', async () => {
    const mixinA = {
      data() {
        return {
          fromMixinA: '',
        }
      },
      watch: {
        obj: {
          handler(this: any, to: any) {
            this.fromMixinA = to
          },
        },
      },
    }

    const mixinB = {
      data() {
        return {
          fromMixinB: '',
        }
      },
      watch: {
        obj: 'setMixinB',
      },
      methods: {
        setMixinB(this: any, to: any) {
          this.fromMixinB = to
        },
      },
    }

    let vm: any
    const Comp = {
      render() {},
      mixins: [mixinA, mixinB],
      data: () => ({
        obj: 'foo',
        fromComp: '',
      }),
      watch: {
        obj(this: any, to: any) {
          this.fromComp = to
        },
      },
      mounted() {
        vm = this
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    vm.obj = 'bar'
    await nextTick()
    expect(vm.fromComp).toBe('bar')
    expect(vm.fromMixinA).toBe('bar')
    expect(vm.fromMixinB).toBe('bar')
  })

  test('provide/inject', () => {
    const symbolKey = Symbol()
    const Root = defineComponent({
      data() {
        return {
          a: 1,
        }
      },
      provide() {
        return {
          a: this.a,
          [symbolKey]: 2,
        }
      },
      render() {
        return [
          h(ChildA),
          h(ChildB),
          h(ChildC),
          h(ChildD),
          h(ChildE),
          h(ChildF),
          h(ChildG),
          h(ChildH),
          h(ChildI),
          h(ChildJ),
        ]
      },
    })

    const defineChild = (injectOptions: any, injectedKey = 'b') =>
      ({
        inject: injectOptions,
        render() {
          return this[injectedKey]
        },
      }) as any

    const ChildA = defineChild(['a'], 'a')
    const ChildB = defineChild({ b: 'a' })
    const ChildC = defineChild({
      b: {
        from: 'a',
      },
    })
    const ChildD = defineChild(
      {
        a: {
          default: () => 0,
        },
      },
      'a',
    )
    const ChildE = defineChild({
      b: {
        from: 'c',
        default: 2,
      },
    })
    const ChildF = defineChild({
      b: {
        from: 'c',
        default: () => 3,
      },
    })
    const ChildG = defineChild({
      b: {
        default: 4,
      },
    })
    const ChildH = defineChild({
      b: {
        default: () => 5,
      },
    })
    const ChildI = defineChild({
      b: symbolKey,
    })
    const ChildJ = defineChild({
      b: {
        from: symbolKey,
      },
    })
    expect(renderToString(h(Root))).toBe(`1111234522`)
  })

  test('provide/inject refs', async () => {
    const n = ref(0)
    const np = computed(() => n.value + 1)
    const Parent = defineComponent({
      provide() {
        return {
          n,
          np,
        }
      },
      render: () => h(Child),
    })
    const Child = defineComponent({
      inject: ['n', 'np'],
      render(this: any) {
        return this.n + this.np
      },
    })
    const app = createApp(Parent)
    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(serializeInner(root)).toBe(`1`)

    n.value++
    await nextTick()
    expect(serializeInner(root)).toBe(`3`)
  })

  test('provide accessing data in extends', () => {
    const Base = defineComponent({
      data() {
        return {
          a: 1,
        }
      },
      provide() {
        return {
          a: this.a,
        }
      },
    })

    const Child = {
      inject: ['a'],
      render() {
        return (this as any).a
      },
    }

    const Root = defineComponent({
      extends: Base,
      render() {
        return h(Child)
      },
    })
    expect(renderToString(h(Root))).toBe(`1`)
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
      },
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
      },
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
      },
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
      'root onMounted',
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
      'root onUpdated',
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
      'root onUnmounted',
    ])
  })

  test('mixins', () => {
    const calls: string[] = []
    const mixinA = defineComponent({
      data() {
        return {
          a: 1,
        }
      },
      created(this: any) {
        calls.push('mixinA created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.c).toBe(4)
      },
      mounted() {
        calls.push('mixinA mounted')
      },
    })
    const mixinB = defineComponent({
      props: {
        bP: {
          type: String,
        },
      },
      data() {
        return {
          b: 2,
        }
      },
      created(this: any) {
        calls.push('mixinB created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.bP).toBeUndefined()
        expect(this.c).toBe(4)
        expect(this.cP1).toBeUndefined()
      },
      mounted() {
        calls.push('mixinB mounted')
      },
    })
    const mixinC = defineComponent({
      props: ['cP1', 'cP2'],
      data() {
        return {
          c: 3,
        }
      },
      created() {
        calls.push('mixinC created')
        // component data() should overwrite mixin field with same key
        expect(this.c).toBe(4)
        expect(this.cP1).toBeUndefined()
      },
      mounted() {
        calls.push('mixinC mounted')
      },
    })
    const Comp = defineComponent({
      props: {
        aaa: String,
      },
      mixins: [mixinA, mixinB, mixinC],
      data() {
        return {
          c: 4,
          z: 4,
        }
      },
      created() {
        calls.push('comp created')
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        expect(this.bP).toBeUndefined()
        expect(this.c).toBe(4)
        expect(this.cP2).toBeUndefined()
        expect(this.z).toBe(4)
      },
      mounted() {
        calls.push('comp mounted')
      },
      render() {
        return `${this.a}${this.b}${this.c}`
      },
    })
    expect(renderToString(h(Comp))).toBe(`124`)
    expect(calls).toEqual([
      'mixinA created',
      'mixinB created',
      'mixinC created',
      'comp created',
      'mixinA mounted',
      'mixinB mounted',
      'mixinC mounted',
      'comp mounted',
    ])
  })

  test('render from mixin', () => {
    const Comp = {
      mixins: [
        {
          render: () => 'from mixin',
        },
      ],
    }
    expect(renderToString(h(Comp))).toBe('from mixin')
  })

  test('chained mixins in extends', () => {
    const calls: string[] = []
    const mixinA = {
      beforeCreate() {
        calls.push('mixinA beforeCreate')
      },
      created() {
        calls.push('mixinA created')
      },
    }

    const extendA = {
      mixins: [mixinA],
      beforeCreate() {
        calls.push('extendA beforeCreate')
      },
      created() {
        calls.push('extendA created')
      },
    }

    const Comp = {
      extends: extendA,
      render: () => '123',
      beforeCreate() {
        calls.push('self beforeCreate')
      },
      created() {
        calls.push('self created')
      },
    }

    expect(renderToString(h(Comp))).toBe(`123`)
    expect(calls).toEqual([
      'mixinA beforeCreate',
      'extendA beforeCreate',
      'self beforeCreate',
      'mixinA created',
      'extendA created',
      'self created',
    ])
  })

  test('unlikely mixin usage', () => {
    const MixinA = {
      data() {},
    }
    const MixinB = {
      data() {},
    }
    defineComponent({
      // since the user will want to type the mixins themselves.
      mixins: [defineComponent(MixinA), defineComponent(MixinB)],
      data() {},
    })
  })

  test('chained extends in mixins', () => {
    const calls: string[] = []

    const extendA = {
      beforeCreate() {
        calls.push('extendA beforeCreate')
      },
      created() {
        calls.push('extendA created')
      },
    }

    const mixinA = {
      extends: extendA,
      beforeCreate() {
        calls.push('mixinA beforeCreate')
      },
      created() {
        calls.push('mixinA created')
      },
    }

    const Comp = {
      mixins: [mixinA],
      render: () => '123',
      beforeCreate() {
        calls.push('self beforeCreate')
      },
      created() {
        calls.push('self created')
      },
    }

    expect(renderToString(h(Comp))).toBe(`123`)
    expect(calls).toEqual([
      'extendA beforeCreate',
      'mixinA beforeCreate',
      'self beforeCreate',
      'extendA created',
      'mixinA created',
      'self created',
    ])
  })

  test('extends', () => {
    const calls: string[] = []
    const Base = defineComponent({
      data() {
        return {
          a: 1,
          b: 1,
        }
      },
      methods: {
        sayA() {},
      },
      mounted(this: any) {
        expect(this.a).toBe(1)
        expect(this.b).toBe(2)
        calls.push('base')
      },
    })
    const Comp = defineComponent({
      extends: Base,
      data() {
        return {
          b: 2,
        }
      },
      mounted() {
        calls.push('comp')
      },
      render() {
        return `${this.a}${this.b}`
      },
    })

    expect(renderToString(h(Comp))).toBe(`12`)
    expect(calls).toEqual(['base', 'comp'])
  })

  test('extends with mixins', () => {
    const calls: string[] = []
    const Base = defineComponent({
      data() {
        return {
          a: 1,
          x: 'base',
        }
      },
      methods: {
        sayA() {},
      },
      mounted(this: any) {
        expect(this.a).toBe(1)
        expect(this.b).toBeTruthy()
        expect(this.c).toBe(2)
        calls.push('base')
      },
    })
    const Mixin = defineComponent({
      data() {
        return {
          b: true,
          x: 'mixin',
        }
      },
      mounted(this: any) {
        expect(this.a).toBe(1)
        expect(this.b).toBeTruthy()
        expect(this.c).toBe(2)
        calls.push('mixin')
      },
    })
    const Comp = defineComponent({
      extends: Base,
      mixins: [Mixin],
      data() {
        return {
          c: 2,
        }
      },
      mounted() {
        calls.push('comp')
      },
      render() {
        return `${this.a}${this.b}${this.c}${this.x}`
      },
    })

    expect(renderToString(h(Comp))).toBe(`1true2mixin`)
    expect(calls).toEqual(['base', 'mixin', 'comp'])
  })

  test('extends type props', () => {
    const Base = defineComponent({
      __typeProps: {} as { a: number },
    })
    defineComponent({
      extends: Base,
      render() {
        return `${this.a}`
      },
    })
  })

  test('beforeCreate/created in extends and mixins', () => {
    const calls: string[] = []
    const BaseA = {
      beforeCreate() {
        calls.push('beforeCreateA')
      },
      created() {
        calls.push('createdA')
      },
    }
    const BaseB = {
      extends: BaseA,
      beforeCreate() {
        calls.push('beforeCreateB')
      },
      created() {
        calls.push('createdB')
      },
    }

    const MixinA = {
      beforeCreate() {
        calls.push('beforeCreateC')
      },
      created() {
        calls.push('createdC')
      },
    }
    const MixinB = {
      mixins: [MixinA],
      beforeCreate() {
        calls.push('beforeCreateD')
      },
      created() {
        calls.push('createdD')
      },
    }

    const Comp = {
      extends: BaseB,
      mixins: [MixinB],
      beforeCreate() {
        calls.push('selfBeforeCreate')
      },
      created() {
        calls.push('selfCreated')
      },
      render() {},
    }

    renderToString(h(Comp))
    expect(calls).toEqual([
      'beforeCreateA',
      'beforeCreateB',
      'beforeCreateC',
      'beforeCreateD',
      'selfBeforeCreate',
      'createdA',
      'createdB',
      'createdC',
      'createdD',
      'selfCreated',
    ])
  })

  test('flatten merged options', async () => {
    const MixinBase = {
      msg1: 'base',
    }
    const ExtendsBase = {
      msg2: 'base',
    }
    const Mixin = {
      mixins: [MixinBase],
    }
    const Extends = {
      extends: ExtendsBase,
    }
    const Comp = defineComponent({
      extends: defineComponent(Extends),
      mixins: [defineComponent(Mixin)],
      render() {
        return `${this.$options.msg1},${this.$options.msg2}`
      },
    })

    expect(renderToString(h(Comp))).toBe('base,base')
  })

  test('extends template', () => {
    const Comp = {
      extends: {
        template: `<h1>Foo</h1>`,
      },
    }

    const root = document.createElement('div') as any
    domRender(h(Comp), root)
    expect(root.innerHTML).toBe(`<h1>Foo</h1>`)
  })

  test('options defined in component have higher priority', async () => {
    const Mixin = {
      msg1: 'base',
    }
    const Extends = {
      msg2: 'base',
    }
    const Comp = defineComponent({
      msg1: 'local',
      msg2: 'local',
      extends: defineComponent(Extends),
      mixins: [defineComponent(Mixin)],
      render() {
        return `${this.$options.msg1},${this.$options.msg2}`
      },
    })

    expect(renderToString(h(Comp))).toBe('local,local')
  })

  test('accessing setup() state from options', async () => {
    const Comp = defineComponent({
      setup() {
        return {
          count: ref(0),
        }
      },
      data() {
        return {
          plusOne: this.count + 1,
        }
      },
      computed: {
        plusTwo(): number {
          return this.count + 2
        },
      },
      methods: {
        inc() {
          this.count++
        },
      },
      render() {
        return h(
          'div',
          {
            onClick: this.inc,
          },
          `${this.count},${this.plusOne},${this.plusTwo}`,
        )
      },
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
          mixin1Data: 'mixin1',
        }
      },
      methods: {},
    }

    const watchSpy = vi.fn()
    const mixin2 = {
      watch: {
        mixin3Data: watchSpy,
      },
    }

    const mixin3 = {
      data() {
        return {
          mixin3Data: 'mixin3',
        }
      },
      methods: {},
    }

    let vm: any
    const Comp = {
      mixins: [mixin1, mixin2, mixin3],
      render() {},
      created() {
        vm = this
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    // should have no warnings
    vm.mixin3Data = 'hello'
    await nextTick()
    expect(watchSpy.mock.calls[0].slice(0, 2)).toEqual(['hello', 'mixin3'])
  })

  test('injection from closest ancestor', () => {
    const Root = defineComponent({
      provide: {
        a: 'root',
      },
      render() {
        return [h(Mid), ' ', h(MidWithProvide), ' ', h(MidWithMixinProvide)]
      },
    })

    const Mid = {
      render() {
        return h(Child)
      },
    } as any

    const MidWithProvide = {
      provide: {
        a: 'midWithProvide',
      },
      render() {
        return h(Child)
      },
    } as any

    const mixin = {
      provide: {
        a: 'midWithMixinProvide',
      },
    }

    const MidWithMixinProvide = {
      mixins: [mixin],
      render() {
        return h(Child)
      },
    } as any

    const Child = {
      inject: ['a'],
      render() {
        return this.a
      },
    } as any

    expect(renderToString(h(Root))).toBe(
      'root midWithProvide midWithMixinProvide',
    )
  })

  describe('options merge strategies', () => {
    test('this.$options.data', () => {
      const mixin = {
        data() {
          return { foo: 1, bar: 2 }
        },
      }
      createApp({
        mixins: [mixin],
        data() {
          return {
            foo: 3,
            baz: 4,
          }
        },
        created() {
          expect(this.$options.data).toBeInstanceOf(Function)
          expect(this.$options.data()).toEqual({
            foo: 3,
            bar: 2,
            baz: 4,
          })
        },
        render: () => null,
      }).mount(nodeOps.createElement('div'))
    })

    test('this.$options.inject', () => {
      const mixin = {
        inject: ['a'],
      }
      const app = createApp({
        mixins: [mixin],
        inject: { b: 'b', c: { from: 'd' } },
        created() {
          expect(this.$options.inject.a).toEqual('a')
          expect(this.$options.inject.b).toEqual('b')
          expect(this.$options.inject.c).toEqual({ from: 'd' })
          expect(this.a).toBe(1)
          expect(this.b).toBe(2)
          expect(this.c).toBe(3)
        },
        render: () => null,
      })

      app.provide('a', 1)
      app.provide('b', 2)
      app.provide('d', 3)
      app.mount(nodeOps.createElement('div'))
    })

    test('this.$options.provide', () => {
      const mixin = {
        provide: {
          a: 1,
        },
      }
      createApp({
        mixins: [mixin],
        provide() {
          return {
            b: 2,
          }
        },
        created() {
          expect(this.$options.provide).toBeInstanceOf(Function)
          expect(this.$options.provide()).toEqual({ a: 1, b: 2 })
        },
        render: () => null,
      }).mount(nodeOps.createElement('div'))
    })

    test('this.$options[lifecycle-name]', () => {
      const mixin = {
        mounted() {},
        beforeUnmount() {},
        unmounted() {},
      }
      createApp({
        mixins: [mixin],
        mounted() {},
        beforeUnmount() {},
        unmounted() {},
        created() {
          expect(this.$options.mounted).toBeInstanceOf(Array)
          expect(this.$options.mounted.length).toBe(2)
          expect(this.$options.beforeUnmount).toBeInstanceOf(Array)
          expect(this.$options.beforeUnmount.length).toBe(2)
          expect(this.$options.unmounted).toBeInstanceOf(Array)
          expect(this.$options.unmounted.length).toBe(2)
        },
        render: () => null,
      }).mount(nodeOps.createElement('div'))
    })

    test('this.$options[asset-name]', () => {
      const mixin = {
        components: {
          a: {},
        },
        directives: {
          d1: {},
        },
      }
      createApp({
        mixins: [mixin],
        components: {
          b: {},
        },
        directives: {
          d2: {},
        },
        created() {
          expect('a' in this.$options.components).toBe(true)
          expect('b' in this.$options.components).toBe(true)
          expect('d1' in this.$options.directives).toBe(true)
          expect('d2' in this.$options.directives).toBe(true)
        },
        render: () => null,
      }).mount(nodeOps.createElement('div'))
    })

    test('this.$options.methods', () => {
      const mixin = {
        methods: {
          fn1() {},
        },
      }
      createApp({
        mixins: [mixin],
        methods: {
          fn2() {},
        },
        created() {
          expect(this.$options.methods.fn1).toBeInstanceOf(Function)
          expect(this.$options.methods.fn2).toBeInstanceOf(Function)
        },
        render: () => null,
      }).mount(nodeOps.createElement('div'))
    })

    test('this.$options.computed', () => {
      const mixin = {
        computed: {
          c1() {},
        },
      }
      createApp({
        mixins: [mixin],
        computed: {
          c2() {},
        },
        created() {
          expect(this.$options.computed.c1).toBeInstanceOf(Function)
          expect(this.$options.computed.c2).toBeInstanceOf(Function)
        },
        render: () => null,
      }).mount(nodeOps.createElement('div'))
    })

    // #2791
    test('modify $options in the beforeCreate hook', async () => {
      const count = ref(0)
      const mixin = {
        data() {
          return { foo: 1 }
        },
        beforeCreate(this: any) {
          if (!this.$options.computed) {
            this.$options.computed = {}
          }
          this.$options.computed.value = () => count.value
        },
      }
      const root = nodeOps.createElement('div')
      createApp({
        mixins: [mixin],
        render(this: any) {
          return this.value
        },
      }).mount(root)

      expect(serializeInner(root)).toBe('0')

      count.value++
      await nextTick()
      expect(serializeInner(root)).toBe('1')
    })
  })

  describe('warnings', () => {
    test('Expected a function as watch handler', () => {
      const Comp = {
        watch: {
          foo: 'notExistingMethod',
          foo2: {
            handler: 'notExistingMethod2',
          },
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)

      expect(
        'Invalid watch handler specified by key "notExistingMethod"',
      ).toHaveBeenWarned()
      expect(
        'Invalid watch handler specified by key "notExistingMethod2"',
      ).toHaveBeenWarned()
    })

    test('Invalid watch option', () => {
      const Comp = {
        watch: { foo: true },
        render() {},
      }

      const root = nodeOps.createElement('div')
      // @ts-expect-error
      render(h(Comp), root)

      expect('Invalid watch option: "foo"').toHaveBeenWarned()
    })

    test('computed with setter and no getter', () => {
      const Comp: ComponentOptions = {
        computed: {
          foo: {
            set() {},
          },
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect('Computed property "foo" has no getter.').toHaveBeenWarned()
    })

    test('assigning to computed with no setter', () => {
      let instance: any
      const Comp: ComponentOptions = {
        computed: {
          foo: {
            get() {},
          },
        },
        mounted() {
          instance = this
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      instance.foo = 1
      expect(
        'Write operation failed: computed property "foo" is readonly',
      ).toHaveBeenWarned()
    })

    test('inject property is already declared in props', () => {
      const Comp = {
        data() {
          return {
            a: 1,
          }
        },
        provide() {
          return {
            a: this.a,
          }
        },
        render() {
          return [h(ChildA)]
        },
      } as any
      const ChildA = {
        props: { a: Number },
        inject: ['a'],
        render() {
          return this.a
        },
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Inject property "a" is already defined in Props.`,
      ).toHaveBeenWarned()
    })

    test('methods property is not a function', () => {
      const Comp: ComponentOptions = {
        methods: {
          foo: 1,
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Method "foo" has type "number" in the component definition. ` +
          `Did you reference the function correctly?`,
      ).toHaveBeenWarned()
    })

    test('methods property is already declared in props', () => {
      const Comp = {
        props: {
          foo: Number,
        },
        methods: {
          foo() {},
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Methods property "foo" is already defined in Props.`,
      ).toHaveBeenWarned()
    })

    test('methods property is already declared in inject', () => {
      const Comp = {
        data() {
          return {
            a: 1,
          }
        },
        provide() {
          return {
            a: this.a,
          }
        },
        render() {
          return [h(ChildA)]
        },
      } as any
      const ChildA = {
        methods: {
          a: () => null,
        },
        inject: ['a'],
        render() {
          return this.a
        },
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Methods property "a" is already defined in Inject.`,
      ).toHaveBeenWarned()
    })

    test('data property is already declared in props', () => {
      const Comp = {
        props: { foo: Number },
        data: () => ({
          foo: 1,
        }),
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Data property "foo" is already defined in Props.`,
      ).toHaveBeenWarned()
    })

    test('data property is already declared in inject', () => {
      const Comp = {
        data() {
          return {
            a: 1,
          }
        },
        provide() {
          return {
            a: this.a,
          }
        },
        render() {
          return [h(ChildA)]
        },
      } as any
      const ChildA = {
        data() {
          return {
            a: 1,
          }
        },
        inject: ['a'],
        render() {
          return this.a
        },
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Data property "a" is already defined in Inject.`,
      ).toHaveBeenWarned()
    })

    test('data property is already declared in methods', () => {
      const Comp = {
        data: () => ({
          foo: 1,
        }),
        methods: {
          foo() {},
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Data property "foo" is already defined in Methods.`,
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in props', () => {
      const Comp = {
        props: { foo: Number },
        computed: {
          foo() {},
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "foo" is already defined in Props.`,
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in inject', () => {
      const Comp = {
        data() {
          return {
            a: 1,
          }
        },
        provide() {
          return {
            a: this.a,
          }
        },
        render() {
          return [h(ChildA)]
        },
      } as any
      const ChildA = {
        computed: {
          a: {
            get() {},
            set() {},
          },
        },
        inject: ['a'],
        render() {
          return this.a
        },
      } as any

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "a" is already defined in Inject.`,
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in methods', () => {
      const Comp = {
        computed: {
          foo() {},
        },
        methods: {
          foo() {},
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "foo" is already defined in Methods.`,
      ).toHaveBeenWarned()
    })

    test('computed property is already declared in data', () => {
      const Comp = {
        data: () => ({
          foo: 1,
        }),
        computed: {
          foo() {},
        },
        render() {},
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
      expect(
        `Computed property "foo" is already defined in Data.`,
      ).toHaveBeenWarned()
    })
  })
})
