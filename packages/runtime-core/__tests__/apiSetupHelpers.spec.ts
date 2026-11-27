import {
  type ComponentInternalInstance,
  type SetupContext,
  Suspense,
  computed,
  createApp,
  defineComponent,
  getCurrentInstance,
  h,
  nextTick,
  nodeOps,
  onMounted,
  ref,
  render,
  serializeInner,
  shallowReactive,
} from '@vue/runtime-test'
import {
  createPropsRestProxy,
  defineEmits,
  defineExpose,
  defineProps,
  mergeDefaults,
  mergeModels,
  useAttrs,
  useSlots,
  withAsyncContext,
  withDefaults,
} from '../src/apiSetupHelpers'
import type { ComputedRefImpl } from '../../reactivity/src/computed'
import { EffectFlags, type ReactiveEffectRunner, effect } from '@vue/reactivity'
import { compile } from '@vue/compiler-dom'
import * as runtimeTest from '@vue/runtime-test'

function compileToRender(template: string) {
  const { code } = compile(template, {
    hoistStatic: true,
    prefixIdentifiers: true,
  })
  return new Function('Vue', code)(runtimeTest)
}

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
      },
    }
    const passedAttrs = { id: 'foo' }
    const passedSlots = {
      default: () => {},
      x: () => {},
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
      },
    })
    render(h(Comp), nodeOps.createElement('div'))
    expect(slots).toBe(ctx!.slots)
    expect(attrs).toBe(ctx!.attrs)
  })

  // #12228: the scheduler's dirty check (instance.job -> effect.runIfDirty
  // -> isDirty -> refreshComputed) can re-evaluate setup-created computeds
  // without an active instance. getContext() used to dereference the null
  // instance after warning, crashing the whole update with "TypeError:
  // Cannot read properties of null (reading 'setupContext')".
  //
  // IMPORTANT: the fix is a crash mitigation, NOT a complete fix. The
  // degraded empty context is cached by refreshComputed() and tracks no
  // dependency on the real attrs/slots, so data read through
  // useAttrs()/useSlots() is not preserved across the degraded evaluation.
  // The tests below assert the actual degraded behavior so the limitation
  // is documented and cannot be mistaken for a complete fix; if a future
  // fix restores correct data (e.g. by re-associating the evaluation with
  // the owning instance's context, as 3.6 does), update them accordingly.
  test('useAttrs() inside a computed should not throw when re-evaluated during a component update', async () => {
    const CFragment = { name: 'CFragment', render: compileToRender(`<slot/>`) }

    const label = ref(0)
    const Button: any = {
      name: 'Button',
      props: { label: Number },
      render: compileToRender(
        `<component :is="wrapper"><button v-bind="componentProps">{{ label }}</button></component>`,
      ),
      setup(props: any) {
        const wrapper = computed(() => CFragment)
        const componentProps = computed(() => ({
          'data-label': String(props.label),
          ...useAttrs(),
        }))
        return { wrapper, componentProps }
      },
    }

    const root = nodeOps.createElement('div')
    const app = createApp(() => h(Button, { label: label.value }))
    app.mount(root)
    expect(serializeInner(root)).toBe(`<button data-label="0">0</button>`)

    label.value++
    await nextTick()
    // no active instance during the dirty check: no crash (dev warning
    // instead). No fallthrough attrs here, so the degraded context happens
    // to produce the correct output; see the tests below for limitations.
    expect(serializeInner(root)).toBe(`<button data-label="1">1</button>`)
    expect(`useAttrs() called without active instance.`).toHaveBeenWarned()
  })

  // #12228 - limitation locked: with real fallthrough attrs the degraded
  // update drops them and they never recover (workaround: capture
  // useAttrs() at the top of setup).
  test('useAttrs() inside a computed: real fallthrough attrs are lost after the degraded update (known limitation)', async () => {
    const CFragment = { name: 'CFragment', render: compileToRender(`<slot/>`) }

    const label = ref(0)
    const title = ref('first')
    const Button: any = {
      name: 'Button',
      inheritAttrs: false,
      props: { label: Number },
      render: compileToRender(
        `<component :is="wrapper"><button v-bind="componentProps">{{ label }}</button></component>`,
      ),
      setup(props: any) {
        const wrapper = computed(() => CFragment)
        const componentProps = computed(() => ({
          'data-label': String(props.label),
          ...useAttrs(),
        }))
        return { wrapper, componentProps }
      },
    }

    const root = nodeOps.createElement('div')
    const app = createApp(() =>
      h(Button, { label: label.value, title: title.value }),
    )
    app.mount(root)
    // the first evaluation happens with an active instance, so the real
    // fallthrough attr is passed through
    expect(serializeInner(root)).toBe(
      `<button data-label="0" title="first">0</button>`,
    )

    label.value++
    await nextTick()
    // the dirty check re-evaluates the computed without an active instance:
    // no crash (what this patch guarantees), but the empty context is
    // cached and the real attr is dropped
    expect(`useAttrs() called without active instance.`).toHaveBeenWarned()
    expect(serializeInner(root)).toBe(`<button data-label="1">1</button>`)

    // attrs-only updates cannot recover the lost attr: the degraded
    // evaluation re-established no dependency on instance.attrs
    title.value = 'second'
    await nextTick()
    expect(serializeInner(root)).toBe(`<button data-label="1">1</button>`)
  })

  // #12228 - same limitation; multi-root components never auto-fallthrough
  // attrs, so the v-bind spread in the computed is the only path.
  test('multi-root component: attrs spread in a computed are lost after the degraded update (known limitation)', async () => {
    const CFragment = { name: 'CFragment', render: compileToRender(`<slot/>`) }

    const label = ref(0)
    const title = ref('first')
    const Button: any = {
      name: 'Button',
      inheritAttrs: false,
      props: { label: Number },
      render: compileToRender(
        `<component :is="wrapper"><button v-bind="componentProps">{{ label }}</button><i>second</i></component>`,
      ),
      setup(props: any) {
        const wrapper = computed(() => CFragment)
        const componentProps = computed(() => ({
          'data-label': String(props.label),
          ...useAttrs(),
        }))
        return { wrapper, componentProps }
      },
    }

    const root = nodeOps.createElement('div')
    const app = createApp(() =>
      h(Button, { label: label.value, title: title.value }),
    )
    app.mount(root)
    expect(serializeInner(root)).toBe(
      `<button data-label="0" title="first">0</button><i>second</i>`,
    )

    label.value++
    await nextTick()
    expect(`useAttrs() called without active instance.`).toHaveBeenWarned()
    // the title attr is dropped from the multi-root output as well
    expect(serializeInner(root)).toBe(
      `<button data-label="1">1</button><i>second</i>`,
    )

    title.value = 'second'
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<button data-label="1">1</button><i>second</i>`,
    )
  })

  // #12228 - useSlots(): the null-deref crash is gone, but with a non-empty
  // default slot the update still fails (".default is not a function", DOM
  // stays stale) — needs the upstream context-ownership fix.
  test('useSlots().default() inside a computed still fails on update with a non-empty default slot (known limitation)', async () => {
    const CFragment = { name: 'CFragment', render: compileToRender(`<slot/>`) }

    const errors: string[] = []
    const label = ref(0)
    const Button: any = {
      name: 'Button',
      props: { label: Number },
      render: compileToRender(
        `<component :is="wrapper"><button>{{ componentProps }}</button></component>`,
      ),
      setup(props: any) {
        const wrapper = computed(() => CFragment)
        const componentProps = computed(
          () =>
            String(props.label) +
            ':' +
            useSlots().default!()
              .map(v => v.children as string)
              .join(''),
        )
        return { wrapper, componentProps }
      },
    }

    const root = nodeOps.createElement('div')
    const app = createApp(() =>
      h(
        Button,
        { label: label.value },
        { default: () => [h('span', 'slot-content')] },
      ),
    )
    app.config.errorHandler = err => {
      errors.push((err as Error).message)
    }
    app.mount(root)
    // the first evaluation happens with an active instance, so the real
    // default slot is available
    expect(serializeInner(root)).toBe(`<button>0:slot-content</button>`)

    label.value++
    await nextTick()
    // the update re-runs the computed without an active instance: the
    // original "Cannot read properties of null (reading 'setupContext')"
    // no longer occurs (what this patch guarantees), but the degraded empty
    // slots make the same getter throw a different error and the DOM stays
    // at the old value
    expect(`useSlots() called without active instance.`).toHaveBeenWarned()
    // the function name in the message depends on the module transform, so
    // assert the stable part of the TypeError only
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/\.default is not a function$/)
    expect(serializeInner(root)).toBe(`<button>0:slot-content</button>`)
  })

  describe('mergeDefaults', () => {
    test('object syntax', () => {
      const merged = mergeDefaults(
        {
          foo: null,
          bar: { type: String, required: false },
          baz: String,
        },
        {
          foo: 1,
          bar: 'baz',
          baz: 'qux',
        },
      )
      expect(merged).toMatchObject({
        foo: { default: 1 },
        bar: { type: String, required: false, default: 'baz' },
        baz: { type: String, default: 'qux' },
      })
    })

    test('array syntax', () => {
      const merged = mergeDefaults(['foo', 'bar', 'baz'], {
        foo: 1,
        bar: 'baz',
        baz: 'qux',
      })
      expect(merged).toMatchObject({
        foo: { default: 1 },
        bar: { default: 'baz' },
        baz: { default: 'qux' },
      })
    })

    test('merging with skipFactory', () => {
      const fn = () => {}
      const merged = mergeDefaults(['foo', 'bar', 'baz'], {
        foo: fn,
        __skip_foo: true,
      })
      expect(merged).toMatchObject({
        foo: { default: fn, skipFactory: true },
      })
    })

    test('should warn missing', () => {
      mergeDefaults({}, { foo: 1 })
      expect(
        `props default key "foo" has no corresponding declaration`,
      ).toHaveBeenWarned()
    })
  })

  describe('mergeModels', () => {
    test('array syntax', () => {
      expect(mergeModels(['foo', 'bar'], ['baz'])).toMatchObject([
        'foo',
        'bar',
        'baz',
      ])
    })

    test('object syntax', () => {
      expect(
        mergeModels({ foo: null, bar: { required: true } }, ['baz']),
      ).toMatchObject({
        foo: null,
        bar: { required: true },
        baz: {},
      })

      expect(
        mergeModels(['baz'], { foo: null, bar: { required: true } }),
      ).toMatchObject({
        foo: null,
        bar: { required: true },
        baz: {},
      })
    })

    test('overwrite', () => {
      expect(
        mergeModels(
          { foo: null, bar: { required: true } },
          { bar: {}, baz: {} },
        ),
      ).toMatchObject({
        foo: null,
        bar: {},
        baz: {},
      })
    })
  })

  test('createPropsRestProxy', () => {
    const original = shallowReactive({
      foo: 1,
      bar: 2,
      baz: 3,
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
      const spy = vi.fn()

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
                }),
            )),
            (__temp = await __temp),
            __restore(),
            __temp)

          // register the lifecycle after an await statement
          onMounted(spy)
          afterInstance = getCurrentInstance()
          return () => msg
        },
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root,
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

    test('should not leak instance to user microtasks after restore', async () => {
      let leakedToUserMicrotask = false

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()

          Promise.resolve().then(() => {
            leakedToUserMicrotask = getCurrentInstance() !== null
          })

          return () => ''
        },
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root,
      )

      await new Promise(r => setTimeout(r))
      expect(leakedToUserMicrotask).toBe(false)
    })

    test('should not leak sibling instance in concurrent restores', async () => {
      let resolveOne: () => void
      let resolveTwo: () => void
      let done!: () => void
      let pending = 2
      const ready = new Promise<void>(r => {
        done = r
      })
      const seenUid: Record<'one' | 'two', number | null> = {
        one: null,
        two: null,
      }

      const makeComp = (name: 'one' | 'two', wait: Promise<void>) =>
        defineComponent({
          async setup() {
            let __temp: any, __restore: any
            ;[__temp, __restore] = withAsyncContext(() => wait)
            __temp = await __temp
            __restore()

            Promise.resolve().then(() => {
              seenUid[name] = getCurrentInstance()?.uid ?? null
              if (--pending === 0) done()
            })

            return () => ''
          },
        })

      const oneReady = new Promise<void>(r => {
        resolveOne = r
      })
      const twoReady = new Promise<void>(r => {
        resolveTwo = r
      })
      const CompOne = makeComp('one', oneReady)
      const CompTwo = makeComp('two', twoReady)

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h('div', [h(CompOne), h(CompTwo)]))),
        root,
      )

      resolveOne!()
      resolveTwo!()
      await ready
      expect(seenUid.one).toBeNull()
      expect(seenUid.two).toBeNull()
    })

    test('should not leak currentInstance to sibling slot render', async () => {
      let done!: () => void
      const ready = new Promise<void>(r => {
        done = r
      })
      let innerUid: number | null = null
      let innerRenderUid: number | null = null

      const Inner = defineComponent({
        setup(_, { slots }) {
          innerUid = getCurrentInstance()!.uid
          return () => {
            innerRenderUid = getCurrentInstance()!.uid
            done()
            return h('div', slots.default?.())
          }
        },
      })

      const Outer = defineComponent({
        setup(_, { slots }) {
          return () => h(Inner, null, () => [slots.default?.()])
        },
      })

      const AsyncA = defineComponent({
        async setup() {
          let __temp: any, __restore: any
          ;[__temp, __restore] = withAsyncContext(() =>
            Promise.resolve()
              .then(() => {})
              .then(() => {}),
          )
          __temp = await __temp
          __restore()
          return () => h('div', 'A')
        },
      })

      const AsyncB = defineComponent({
        async setup() {
          let __temp: any, __restore: any
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()
          return () => h(Outer, null, () => 'B')
        },
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h('div', [h(AsyncA), h(AsyncB)]))),
        root,
      )

      await ready
      expect(
        'Slot "default" invoked outside of the render function',
      ).not.toHaveBeenWarned()
      expect(innerRenderUid).toBe(innerUid)
      await Promise.resolve()
      expect(serializeInner(root)).toBe(`<div><div>A</div><div>B</div></div>`)
    })

    test('error handling', async () => {
      const spy = vi.fn()

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
                }),
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
        },
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root,
      )

      expect(spy).not.toHaveBeenCalled()
      reject!()
      // wait a macro task tick for all micro ticks to resolve
      await new Promise(r => setTimeout(r))
      // mount hook should have been called
      expect(spy).toHaveBeenCalled()
      // should retain same instance before/after the await call
      expect(beforeInstance).toBe(afterInstance)
      // instance scope should be fully restored/cleaned after async ticks
      expect((beforeInstance!.scope as any)._on).toBe(0)
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
        },
      })

      const root = nodeOps.createElement('div')
      render(
        h(() => h(Suspense, () => h(Comp))),
        root,
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
        render() {},
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
        two: { before: NaN, after: NaN },
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
        },
      })

      const app = createApp(() =>
        h(Suspense, () =>
          h('div', [h(Comp, { name: 'one' }), h(Comp, { name: 'two' })]),
        ),
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

      let c: ComputedRefImpl
      let e: ReactiveEffectRunner

      const Comp = defineComponent({
        async setup() {
          let __temp: any, __restore: any
          ;[__temp, __restore] = withAsyncContext(() => Promise.resolve())
          __temp = await __temp
          __restore()

          c = computed(() => {}) as unknown as ComputedRefImpl
          e = effect(() => c.value)
          // register the lifecycle after an await statement
          onMounted(resolve)
          return () => c.value
        },
      })

      const app = createApp(() => h(Suspense, () => h(Comp)))
      const root = nodeOps.createElement('div')
      app.mount(root)

      await ready
      expect(e!.effect.flags & EffectFlags.ACTIVE).toBeTruthy()
      expect(c!.flags & EffectFlags.TRACKING).toBeTruthy()

      app.unmount()
      expect(e!.effect.flags & EffectFlags.ACTIVE).toBeFalsy()
      expect(c!.flags & EffectFlags.TRACKING).toBeFalsy()
    })
  })
})
