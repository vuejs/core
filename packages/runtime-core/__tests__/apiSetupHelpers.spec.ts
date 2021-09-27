import {
  ComponentInternalInstance,
  createApp,
  defineComponent,
  getCurrentInstance,
  h,
  nodeOps,
  onMounted,
  render,
  serializeInner,
  SetupContext,
  Suspense,
  computed,
  ComputedRef,
  shallowReactive
} from '@vue/runtime-test'
import {
  defineEmits,
  defineProps,
  defineExpose,
  withDefaults,
  useAttrs,
  useSlots,
  mergeDefaults,
  withAsyncContext,
  createPropsRestProxy
} from '../src/apiSetupHelpers'

describe('SFC <script setup> helpers', () => {
  test('should warn runtime usage', () => {
    defineProps()
    expect(`defineProps() is a compiler-hint`).toHaveBeenWarned()

    defineEmits()
    expect(`defineEmits() is a compiler-hint`).toHaveBeenWarned()

    defineExpose()
    expect(`defineExpose() is a compiler-hint`).toHaveBeenWarned()

    withDefaults({}, {})
    expect(`withDefaults() is a compiler-hint`).toHaveBeenWarned()
  })

  test('useSlots / useAttrs (no args)', () => {
    let slots: SetupContext['slots'] | undefined
    let attrs: SetupContext['attrs'] | undefined
    const Comp = {
      setup() {
        slots = useSlots()
        attrs = useAttrs()
        return () => {}
      }
    }
    const passedAttrs = { id: 'foo' }
    const passedSlots = {
      default: () => {},
      x: () => {}
    }
    render(h(Comp, passedAttrs, passedSlots), nodeOps.createElement('div'))
    expect(typeof slots!.default).toBe('function')
    expect(typeof slots!.x).toBe('function')
    expect(attrs).toMatchObject(passedAttrs)
  })

  test('useSlots / useAttrs (with args)', () => {
    let slots: SetupContext['slots'] | undefined
    let attrs: SetupContext['attrs'] | undefined
    let ctx: SetupContext | undefined
    const Comp = defineComponent({
      setup(_, _ctx) {
        slots = useSlots()
        attrs = useAttrs()
        ctx = _ctx
        return () => {}
      }
    })
    render(h(Comp), nodeOps.createElement('div'))
    expect(slots).toBe(ctx!.slots)
    expect(attrs).toBe(ctx!.attrs)
  })

  describe('mergeDefaults', () => {
    test('object syntax', () => {
      const merged = mergeDefaults(
        {
          foo: null,
          bar: { type: String, required: false },
          baz: String
        },
        {
          foo: 1,
          bar: 'baz',
          baz: 'qux'
        }
      )
      expect(merged).toMatchObject({
        foo: { default: 1 },
        bar: { type: String, required: false, default: 'baz' },
        baz: { type: String, default: 'qux' }
      })
    })

    test('array syntax', () => {
      const merged = mergeDefaults(['foo', 'bar', 'baz'], {
        foo: 1,
        bar: 'baz',
        baz: 'qux'
      })
      expect(merged).toMatchObject({
        foo: { default: 1 },
        bar: { default: 'baz' },
        baz: { default: 'qux' }
      })
    })

    test('should warn missing', () => {
      mergeDefaults({}, { foo: 1 })
      expect(
        `props default key "foo" has no corresponding declaration`
      ).toHaveBeenWarned()
    })
  })

  describe('createPropsRestProxy', () => {
    const original = shallowReactive({
      foo: 1,
      bar: 2,
      baz: 3
    })
    const rest = createPropsRestProxy(original, ['foo', 'bar'])
    expect('foo' in rest).toBe(false)
    expect('bar' in rest).toBe(false)
    expect(rest.baz).toBe(3)
    expect(Object.keys(rest)).toEqual(['baz'])

    original.baz = 4
    expect(rest.baz).toBe(4)
  })

  describe('withAsyncContext', () => {
    // disable options API because applyOptions() also resets currentInstance
    // and we want to ensure the logic works even with Options API disabled.
    beforeEach(() => {
      __FEATURE_OPTIONS_API__ = false
    })

    afterEach(() => {
      __FEATURE_OPTIONS_API__ = true
    })

    test('basic', async () => {
      const spy = jest.fn()

      let beforeInstance: ComponentInternalInstance | null = null
      let afterInstance: ComponentInternalInstance | null = null
      let resolve: (msg: string) => void

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any

          beforeInstance = getCurrentInstance()

          const msg =
            (([__temp, __restore] = withAsyncContext(
              () =>
                new Promise(r => {
                  resolve = r
                })
            )),
            (__temp = await __temp),
            __restore(),
            __temp)

          // register the lifecycle after an await statement
          onMounted(spy)
          afterInstance = getCurrentInstance()
          return () => msg
        }
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root
      )

      expect(spy).not.toHaveBeenCalled()
      resolve!('hello')
      // wait a macro task tick for all micro ticks to resolve
      await new Promise(r => setTimeout(r))
      // mount hook should have been called
      expect(spy).toHaveBeenCalled()
      // should retain same instance before/after the await call
      expect(beforeInstance).toBe(afterInstance)
      expect(serializeInner(root)).toBe('hello')
    })

    test('error handling', async () => {
      const spy = jest.fn()

      let beforeInstance: ComponentInternalInstance | null = null
      let afterInstance: ComponentInternalInstance | null = null
      let reject: () => void

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any

          beforeInstance = getCurrentInstance()
          try {
            ;[__temp, __restore] = withAsyncContext(
              () =>
                new Promise((_, rj) => {
                  reject = rj
                })
            )
            __temp = await __temp
            __restore()
          } catch (e: any) {
            // ignore
          }
          // register the lifecycle after an await statement
          onMounted(spy)
          afterInstance = getCurrentInstance()
          return () => ''
        }
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root
      )

      expect(spy).not.toHaveBeenCalled()
      reject!()
      // wait a macro task tick for all micro ticks to resolve
      await new Promise(r => setTimeout(r))
      // mount hook should have been called
      expect(spy).toHaveBeenCalled()
      // should retain same instance before/after the await call
      expect(beforeInstance).toBe(afterInstance)
    })

    test('should not leak instance on multiple awaits', async () => {
      let resolve: (val?: any) => void
      let beforeInstance: ComponentInternalInstance | null = null
      let afterInstance: ComponentInternalInstance | null = null
      let inBandInstance: ComponentInternalInstance | null = null
      let outOfBandInstance: ComponentInternalInstance | null = null

      const ready = new Promise(r => {
        resolve = r
      })

      async function doAsyncWork() {
        // should still have instance
        inBandInstance = getCurrentInstance()
        await Promise.resolve()
        // should not leak instance
        outOfBandInstance = getCurrentInstance()
      }

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any

          beforeInstance = getCurrentInstance()

          // first await
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()

          // setup exit, instance set to null, then resumed
          ;[__temp, __restore] = withAsyncContext(() => doAsyncWork())
          __temp = await __temp
          __restore()

          afterInstance = getCurrentInstance()
          return () => {
            resolve()
            return ''
          }
        }
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root
      )

      await ready
      expect(inBandInstance).toBe(beforeInstance)
      expect(outOfBandInstance).toBeNull()
      expect(afterInstance).toBe(beforeInstance)
      expect(getCurrentInstance()).toBeNull()
    })

    test('should not leak on multiple awaits + error', async () => {
      let resolve: (val?: any) => void
      const ready = new Promise(r => {
        resolve = r
      })

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()
          ;[__temp, __restore] = withAsyncContext(() => Promise.reject())
          __temp = await __temp
          __restore()
        },
        render() {}
      })

      const app = createApp(() => h(Suspense, () => h(Comp)))
      app.config.errorHandler = () => {
        resolve()
        return false
      }

      const root = nodeOps.createElement('div')
      app.mount(root)

      await ready
      expect(getCurrentInstance()).toBeNull()
    })

    // #4050
    test('race conditions', async () => {
      const uids = {
        one: { before: NaN, after: NaN },
        two: { before: NaN, after: NaN }
      }

      const Comp = defineComponent({
        props: ['name'],
        async setup(props: { name: 'one' | 'two' }) {
          let __temp: any, __restore: any

          uids[props.name].before = getCurrentInstance()!.uid
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()

          uids[props.name].after = getCurrentInstance()!.uid
          return () => ''
        }
      })

      const app = createApp(() =>
        h(Suspense, () =>
          h('div', [h(Comp, { name: 'one' }), h(Comp, { name: 'two' })])
        )
      )
      const root = nodeOps.createElement('div')
      app.mount(root)

      await new Promise(r => setTimeout(r))
      expect(uids.one.before).not.toBe(uids.two.before)
      expect(uids.one.before).toBe(uids.one.after)
      expect(uids.two.before).toBe(uids.two.after)
    })

    test('should teardown in-scope effects', async () => {
      let resolve: (val?: any) => void
      const ready = new Promise(r => {
        resolve = r
      })

      let c: ComputedRef

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()

          c = computed(() => {})
          // register the lifecycle after an await statement
          onMounted(resolve)
          return () => ''
        }
      })

      const app = createApp(() => h(Suspense, () => h(Comp)))
      const root = nodeOps.createElement('div')
      app.mount(root)

      await ready
      expect(c!.effect.active).toBe(true)

      app.unmount()
      expect(c!.effect.active).toBe(false)
    })
  })
})
