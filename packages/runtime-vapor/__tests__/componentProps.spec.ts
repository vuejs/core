// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentProps.spec.ts`.

import {
  createApp,
  currentInstance,
  defineComponent,
  h,
  inject,
  isShallow,
  markRaw,
  nextTick,
  provide,
  ref,
  shallowRef,
  toRefs,
  useModel,
  watch,
  watchSyncEffect,
} from '@vue/runtime-dom'
import {
  createComponent,
  createVaporApp,
  defineVaporComponent,
  renderEffect,
  template,
  vaporInteropPlugin,
} from '../src'
import { resolveDynamicProps } from '../src/componentProps'
import { compile, makeRender, renderParity } from './_utils'
import { setElementText } from '../src/dom/prop'

const define = makeRender<any>()

describe('component: props', () => {
  test('stateful', () => {
    let props: any
    let attrs: any

    const { render } = define({
      props: ['fooBar', 'barBaz'],
      setup(_props: any, { attrs: _attrs }: any) {
        props = _props
        attrs = _attrs
        return []
      },
    })

    render({ fooBar: () => 1, bar: () => 2 })
    expect(props).toEqual({ fooBar: 1 })
    expect(attrs).toEqual({ bar: 2 })

    // test passing kebab-case and resolving to camelCase
    render({ 'foo-bar': () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ fooBar: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    // test updating kebab-case should not delete it (#955)
    render({ 'foo-bar': () => 3, bar: () => 3, baz: () => 4, barBaz: () => 5 })
    expect(props).toEqual({ fooBar: 3, barBaz: 5 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    // remove the props with camelCase key (#1412)
    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('stateful with setup', () => {
    let props: any
    let attrs: any

    const { render } = define({
      props: ['foo'],
      setup(_props: any, { attrs: _attrs }: any) {
        props = _props
        attrs = _attrs
        return []
      },
    })

    render({ foo: () => 1, bar: () => 2 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ foo: () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional with declaration', () => {
    let props: any
    let attrs: any

    const { component: Comp, render } = define(
      (_props: any, { attrs: _attrs }: any) => {
        props = _props
        attrs = _attrs
        return []
      },
    )
    Comp.props = ['foo']

    render({ foo: () => 1, bar: () => 2 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ foo: () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional without declaration', () => {
    let props: any
    let attrs: any

    const { render } = define((_props: any, { attrs: _attrs }: any) => {
      props = _props
      attrs = _attrs
      return []
    })

    render({ foo: () => 1 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ foo: 1 })
    expect(props).toBe(attrs)

    render({ bar: () => 2 })
    expect(props).toEqual({ bar: 2 })
    expect(attrs).toEqual({ bar: 2 })
    expect(props).toBe(attrs)
  })

  test('functional defineVaporComponent without declaration', () => {
    let props: any
    let attrs: any

    const { render } = define(
      defineVaporComponent((_props: any, { attrs: _attrs }: any) => {
        props = _props
        attrs = _attrs
        return []
      }),
    )

    render({ foo: () => 1 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ foo: 1 })

    render({ bar: () => 2 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ bar: 2 })
  })

  test('boolean casting', () => {
    let props: any
    const { render } = define({
      props: {
        foo: Boolean,
        bar: Boolean,
        baz: Boolean,
        qux: Boolean,
      },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    render({
      // absent should cast to false
      bar: () => '', // empty string should cast to true
      baz: () => 'baz', // same string should cast to true
      qux: () => 'ok', // other values should be left in-tact (but raise warning)
    })

    expect(props.foo).toBe(false)
    expect(props.bar).toBe(true)
    expect(props.baz).toBe(true)
    expect(props.qux).toBe('ok')
    expect('type check failed for prop "qux"').toHaveBeenWarned()
  })

  test('default value', () => {
    let props: any
    const defaultFn = vi.fn(() => ({ a: 1 }))
    const defaultBaz = vi.fn(() => ({ b: 1 }))

    const { render } = define({
      props: {
        foo: {
          default: 1,
        },
        bar: {
          default: defaultFn,
        },
        baz: {
          type: Function,
          default: defaultBaz,
        },
      },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    render({ foo: () => 2 })
    expect(props.foo).toBe(2)
    expect(props.bar).toEqual({ a: 1 })
    expect(props.baz).toEqual(defaultBaz)
    expect(defaultFn).toHaveBeenCalledTimes(1)
    expect(defaultBaz).toHaveBeenCalledTimes(0)

    // #999: updates should not cause default factory of unchanged prop to be
    // called again
    render({ foo: () => 3 })

    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ a: 1 })

    render({ bar: () => ({ b: 2 }) })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 2 })

    render({
      foo: () => 3,
      bar: () => ({ b: 3 }),
    })
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ b: 3 })

    render({ bar: () => ({ b: 4 }) })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 4 })
  })

  test('using inject in default value factory', () => {
    let props: any

    const Child = defineVaporComponent({
      props: {
        test: {
          default: () => inject('test', 'default'),
        },
      },
      setup(_props) {
        props = _props
        return []
      },
    })

    const { render } = define({
      setup() {
        provide('test', 'injected')
        return createComponent(Child)
      },
    })

    render()

    expect(props.test).toBe('injected')
  })

  test('optimized props updates', async () => {
    const t0 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      setup(props: any) {
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        return createComponent(
          Child,
          {
            foo: () => _ctx.foo,
            id: () => _ctx.id,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">2</div>')
  })

  describe('validator', () => {
    test('validator should be called with two arguments', () => {
      const mockFn = vi.fn((...args: any[]) => true)
      const props = {
        foo: () => 1,
        bar: () => 2,
      }

      const t0 = template('<div/>')
      define({
        props: {
          foo: {
            type: Number,
            validator: (value: any, props: any) => mockFn(value, props),
          },
          bar: {
            type: Number,
          },
        },
        setup() {
          return t0()
        },
      }).render(props)

      expect(mockFn).toHaveBeenCalledWith(1, { foo: 1, bar: 2 })
    })

    test('validator should not be able to mutate other props', async () => {
      const mockFn = vi.fn((...args: any[]) => true)
      define({
        props: {
          foo: {
            type: Number,
            validator: (value: any, props: any) => !!(props.bar = 1),
          },
          bar: {
            type: Number,
            validator: (value: any) => mockFn(value),
          },
        },
        setup() {
          const t0 = template('<div/>')
          const n0 = t0()
          return n0
        },
      }).render!({
        foo() {
          return 1
        },
        bar() {
          return 2
        },
      })

      expect(
        `Set operation on key "bar" failed: target is readonly.`,
      ).toHaveBeenWarnedLast()
      expect(mockFn).toHaveBeenCalledWith(2)
    })
  })

  test('warn props mutation', () => {
    let props: any
    const { render } = define({
      props: ['foo'],
      setup(_props: any) {
        props = _props
        return []
      },
    })
    render({ foo: () => 1 })
    expect(props.foo).toBe(1)

    props.foo = 2
    expect(`Attempt to mutate prop "foo" failed`).toHaveBeenWarned()
  })

  test('warn absent required props', () => {
    define({
      props: {
        bool: { type: Boolean, required: true },
        str: { type: String, required: true },
        num: { type: Number, required: true },
      },
      setup() {
        return []
      },
    }).render()
    expect(`Missing required prop: "bool"`).toHaveBeenWarned()
    expect(`Missing required prop: "str"`).toHaveBeenWarned()
    expect(`Missing required prop: "num"`).toHaveBeenWarned()
  })

  // NOTE: type check is not supported in vapor
  // test('warn on type mismatch', () => {})

  // #3495
  test('should not warn required props using kebab-case', async () => {
    define({
      props: {
        fooBar: { type: String, required: true },
      },
      setup() {
        return []
      },
    }).render({
      ['foo-bar']: () => 'hello',
    })
    expect(`Missing required prop: "fooBar"`).not.toHaveBeenWarned()
  })

  test('props type support BigInt', () => {
    const t0 = template('<div>')
    const { host } = define({
      props: {
        foo: BigInt,
      },
      setup(props: any) {
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    }).render({
      foo: () =>
        BigInt(BigInt(100000111)) + BigInt(2000000000) * BigInt(30000000),
    })
    expect(host.innerHTML).toBe('<div>60000000100000111</div>')
  })

  // #3474
  test('should cache the value returned from the default factory to avoid unnecessary watcher trigger', async () => {
    let count = 0

    const { render, html } = define({
      props: {
        foo: {
          type: Object,
          default: () => ({ val: 1 }),
        },
        bar: Number,
      },
      setup(props: any) {
        watch(
          () => props.foo,
          () => {
            count++
          },
        )
        const t0 = template('<h1></h1>')
        const n0 = t0()
        renderEffect(() => {
          setElementText(n0, String(props.foo.val) + String(props.bar))
        })
        return n0
      },
    })

    const foo = ref()
    const bar = ref(0)
    render({ foo: () => foo.value, bar: () => bar.value })
    expect(html()).toBe(`<h1>10</h1>`)
    expect(count).toBe(0)

    bar.value++
    await nextTick()
    expect(html()).toBe(`<h1>11</h1>`)
    expect(count).toBe(0)
  })

  // #3288
  test('declared prop key should be present even if not passed', async () => {
    let initialKeys: string[] = []
    const changeSpy = vi.fn()
    const passFoo = ref(false)

    const Comp: any = {
      props: {
        foo: String,
      },
      setup(props: any) {
        initialKeys = Object.keys(props)
        const { foo } = toRefs(props)
        watch(foo, changeSpy)
        return []
      },
    }

    define(() =>
      createComponent(Comp, {
        $: [() => (passFoo.value ? { foo: 'ok' } : {})],
      }),
    ).render()

    expect(initialKeys).toMatchObject(['foo'])
    passFoo.value = true
    await nextTick()
    expect(changeSpy).toHaveBeenCalledTimes(1)
  })

  test('should not warn invalid watch source when directly watching props', async () => {
    const changeSpy = vi.fn()
    const { render, html } = define({
      props: {
        foo: {
          type: String,
        },
      },
      setup(props: any) {
        watch(props, changeSpy)
        const t0 = template('<h1></h1>')
        const n0 = t0()
        renderEffect(() => {
          setElementText(n0, String(props.foo))
        })
        return n0
      },
    })

    const foo = ref('foo')
    render({ foo: () => foo.value })
    expect(html()).toBe(`<h1>foo</h1>`)
    expect('Invalid watch source').not.toHaveBeenWarned()

    foo.value = 'bar'
    await nextTick()
    expect(html()).toBe(`<h1>bar</h1>`)
    expect(changeSpy).toHaveBeenCalledTimes(1)
  })

  test('directly watching props should be shallow', async () => {
    const changeSpy = vi.fn()
    let props: any
    const { render } = define({
      props: ['foo', 'bar'],
      setup(_props: any) {
        props = _props
        watch(props, changeSpy)
        return []
      },
    })

    const foo = ref({ nested: { count: 0 } })
    const bar = ref(1)
    render({ foo: () => foo.value, bar: () => bar.value })

    const captured = props.foo
    expect(captured).toBe(foo.value)
    // nested mutation should not trigger, same as shallowReactive props in vdom
    foo.value.nested.count++
    expect(props.foo).toBe(captured)
    expect(props.foo.nested.count).toBe(1)
    await nextTick()
    expect(changeSpy).toHaveBeenCalledTimes(0)

    bar.value++
    await nextTick()
    expect(changeSpy).toHaveBeenCalledTimes(1)
    expect(isShallow(props)).toBe(true)

    foo.value = { nested: { count: 2 } }
    expect(props.foo).toBe(captured)
    await nextTick()
    expect(props.foo).toBe(foo.value)
    expect(changeSpy).toHaveBeenCalledTimes(2)
  })

  test('support null in required + multiple-type declarations', () => {
    const { render } = define({
      props: {
        foo: { type: [Function, null], required: true },
      },
      setup() {
        return []
      },
    })

    expect(() => {
      render({ foo: () => () => {} })
    }).not.toThrow()

    expect(() => {
      render({ foo: () => null })
    }).not.toThrow()
  })

  // #5016
  test('handling attr with undefined value', () => {
    const { render, host } = define({
      inheritAttrs: false,
      setup(_: any, { attrs }: any) {
        const t0 = template('<div></div>')
        const n0 = t0()
        renderEffect(() =>
          setElementText(n0, JSON.stringify(attrs) + Object.keys(attrs)),
        )
        return n0
      },
    })

    const attrs: any = { foo: () => undefined }
    render(attrs)

    expect(host.innerHTML).toBe(
      `<div>${JSON.stringify(attrs) + Object.keys(attrs)}</div>`,
    )
  })

  // #6915
  test('should not mutate original props long-form definition object', () => {
    const props = {
      msg: {
        type: String,
      },
    }
    define({ props, setup: () => [] }).render({ msg: () => 'test' })

    expect(Object.keys(props.msg).length).toBe(1)
  })

  test('should warn against reserved prop names', () => {
    const { render } = define({
      props: {
        $foo: String,
      },
      setup: () => [],
    })

    render({ msg: () => 'test' })
    expect(`Invalid prop name: "$foo"`).toHaveBeenWarned()
  })

  test('v-once preserves function-valued props', () => {
    const cb = vi.fn(() => 'called')
    const resolved: unknown[] = []
    const Child = defineVaporComponent({
      props: ['cb'],
      setup(props: any) {
        resolved.push(props.cb)
        return []
      },
    })

    define({
      setup() {
        return [
          createComponent(Child, { cb: () => cb }, null, true, true),
          createComponent(Child, { $: [{ cb: () => cb }] }, null, true, true),
        ]
      },
    }).render()

    expect(resolved[0]).toBe(cb)
    expect(resolved[1]).toBe(cb)
    expect(cb).not.toHaveBeenCalled()
  })

  test('v-once snapshots sources without caching computeds on them', () => {
    const source = (() => ({ a: 1 })) as (() => any) & { _cache?: unknown }
    const getter = (() => 2) as (() => any) & { _cache?: unknown }
    const Child = defineVaporComponent({
      props: ['a', 'b'],
      setup(props: any) {
        expect(props.a).toBe(1)
        expect(props.b).toBe(2)
        return []
      },
    })

    // Nest one level: sources are only cached under an instance with a parent.
    const Parent = defineVaporComponent({
      setup() {
        return createComponent(
          Child,
          { b: getter, $: [source] },
          null,
          true,
          true,
        )
      },
    })
    define({
      setup() {
        return createComponent(Parent)
      },
    }).render()

    expect(source._cache).toBeUndefined()
    expect(getter._cache).toBeUndefined()
  })

  // #15227
  test('declared class prop should be normalized', () => {
    const data = ref({ skin: { b: true, c: false } })
    const Child = compile(
      `<script setup vapor>
        const props = defineProps({ class: { type: String } })
      </script>
      <template><div>{{ props.class }}</div></template>`,
      data,
    )
    const Parent = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template><Child class="a" :class="data.skin" /></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe('<div>a b</div>')
    expect('Invalid prop').not.toHaveBeenWarned()
  })

  test('declared class props merge static and v-bind sources', () => {
    const data = ref({ attrs: { class: 'b' }, extra: 'c' })
    const Child = compile(
      `<script setup vapor>
        const props = defineProps({ class: String })
      </script>
      <template><div>{{ props.class }}</div></template>`,
      data,
    )
    const Parent = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template><Child class="a" v-bind="data.attrs" :class="data.extra" /></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe('<div>a b c</div>')
  })

  test('declared event props merge static and v-on sources', () => {
    const calls: string[] = []
    const data = ref({
      onStatic: () => calls.push('static'),
      listeners: { click: () => calls.push('object') },
    })
    const Child = compile(
      `<script setup vapor>
        const props = defineProps({ onClick: null })
        const trigger = () => {
          const handlers = Array.isArray(props.onClick)
            ? props.onClick
            : [props.onClick]
          handlers.forEach(handler => handler())
        }
      </script><template><button @click="trigger">click</button></template>`,
      data,
    )
    const Parent = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template><Child @click="data.onStatic" v-on="data.listeners" /></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    host.querySelector('button')!.click()

    expect(calls).toEqual(['static', 'object'])
  })

  test('class prop should only normalize the value that was passed', () => {
    let props: any
    const fallback = ['a', 'b']
    const { render } = define({
      props: { class: { default: () => fallback } },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    render({ class: () => '  a  b ' })
    expect(props.class).toBe('  a  b ')

    // class is absent or empty here, so the default is used as-is
    render()
    expect(props.class).toBe(fallback)

    render({ class: () => undefined })
    expect(props.class).toBe(fallback)
  })

  test('class prop should be normalized before Boolean casting', () => {
    let props: any
    const { render } = define({
      props: { class: { type: Boolean } },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    // `<Child class />` casts to true and must stay true
    render({ class: () => '' })
    expect(props.class).toBe(true)
    expect('Invalid prop').not.toHaveBeenWarned()
  })

  // #15285
  test('declared style prop should be normalized', () => {
    const data = ref({ style: { color: 'red' } })
    const Child = compile(
      `<script setup vapor>
        const props = defineProps({ style: { type: Object } })
      </script>
      <template><div>{{ JSON.stringify(props.style) }}</div></template>`,
      data,
    )
    const Parent = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template><Child style="font-weight:bold" :style="data.style" /></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe(
      '<div>{"font-weight":"bold","color":"red"}</div>',
    )
    expect('Invalid prop').not.toHaveBeenWarned()
  })

  test('style prop should only normalize the value that was passed', () => {
    let props: any
    const fallback = ['color:red']
    const { render } = define({
      props: { style: { default: () => fallback } },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    render({ style: () => 'color: red' })
    expect(props.style).toBe('color: red')

    // style is absent or empty here, so the default is used as-is
    render()
    expect(props.style).toBe(fallback)

    render({ style: () => undefined })
    expect(props.style).toBe(fallback)

    render({ style: () => 42 })
    expect(props.style).toBe(42)

    const styleFn = () => {}
    render({ style: () => styleFn })
    expect(props.style).toBe(styleFn)
  })

  describe('dynamic props source caching', () => {
    test('v-bind object should be cached when child accesses multiple props', () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1, bar: 2, baz: 3 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        props: ['foo', 'bar', 'baz'],
        setup(props: any) {
          const n0 = t0()
          // Child component accesses multiple props
          renderEffect(() => {
            setElementText(n0, `${props.foo}-${props.bar}-${props.baz}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>1-2-3</div>')
      // Source should only be called once even though 3 props are accessed
      expect(sourceCallCount).toBe(1)
    })

    test('v-bind object should update when source changes', async () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1, bar: 2 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        props: ['foo', 'bar'],
        setup(props: any) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${props.foo}-${props.bar}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>1-2</div>')
      expect(sourceCallCount).toBe(1)

      // Update source
      obj.value = { foo: 10, bar: 20 }
      await nextTick()

      expect(host.innerHTML).toBe('<div>10-20</div>')
      // Should be called again after source changes
      expect(sourceCallCount).toBe(2)
    })

    test('v-bind object should not update child when resolved values are unchanged', async () => {
      let childRenderCount = 0
      const activeId = ref(0)

      const t0 = template('<div></div>', 1)
      const Child = defineVaporComponent({
        props: ['active', 'tone'],
        setup(props: any) {
          const n0 = t0()
          renderEffect(() => {
            childRenderCount++
            setElementText(n0, `${props.active}-${props.tone}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                const active = activeId.value === 1
                return {
                  active,
                  tone: 'stable',
                  class: active ? 'active' : 'inactive',
                }
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div class="inactive">false-stable</div>')
      expect(childRenderCount).toBe(1)

      activeId.value = 2
      await nextTick()

      expect(host.innerHTML).toBe('<div class="inactive">false-stable</div>')
      expect(childRenderCount).toBe(1)
    })

    test('v-bind object should be cached when child accesses multiple attrs', () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1, bar: 2, baz: 3 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        // No props declaration - all become attrs
        setup(_: any, { attrs }: any) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${attrs.foo}-${attrs.bar}-${attrs.baz}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div foo="1" bar="2" baz="3">1-2-3</div>')
      // Source should only be called once
      expect(sourceCallCount).toBe(1)
    })

    test('mixed static and dynamic props', async () => {
      let sourceCallCount = 0
      const obj = ref({ foo: 1 })

      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        props: ['id', 'foo', 'class'],
        setup(props: any) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${props.id}-${props.foo}-${props.class}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            id: 'static',
            $: [
              () => {
                sourceCallCount++
                return obj.value
              },
              { class: 'bar' },
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>static-1-bar</div>')
      expect(sourceCallCount).toBe(1)

      obj.value = { foo: 2 }
      await nextTick()

      expect(host.innerHTML).toBe('<div>static-2-bar</div>')
      expect(sourceCallCount).toBe(2)
    })

    test('static object source direct values are exposed as attrs', () => {
      const t0 = template('<div></div>')
      const Child = defineVaporComponent({
        setup(_: any, { attrs }: any) {
          const n0 = t0()
          renderEffect(() => {
            setElementText(n0, `${attrs.id}-${attrs.class}`)
          })
          return n0
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, {
            $: [{ id: 'foo', class: 'bar' }],
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<div id="foo" class="bar">foo-bar</div>')
    })

    test('resolveDynamicProps merges event listeners across sources', () => {
      const first = vi.fn()
      const second = vi.fn()
      const third = vi.fn()
      expect(
        resolveDynamicProps({
          onClick: () => first,
          $: [
            () => ({ onClick: [second, third] }),
            { onClick: () => first },
            () => ({ onClick: null }),
          ],
        }).onClick,
      ).toEqual([first, second, third])
    })

    test('resolveDynamicProps supports direct values in static object sources', () => {
      expect(
        resolveDynamicProps({
          id: 'foo',
          class: 'base',
          $: [() => ({ class: 'dynamic' }), { class: 'bar', title: 'baz' }],
        }),
      ).toEqual({
        id: 'foo',
        class: ['base', 'dynamic', 'bar'],
        title: 'baz',
      })
    })

    test('unbound model keeps its local value when a source re-resolves', async () => {
      let setFromChild: () => void
      const Child = defineVaporComponent({
        props: {
          text: { default: '' },
          textModifiers: {},
          n: {},
        },
        emits: ['update:text'],
        setup(props: any) {
          const text = useModel(props, 'text')
          setFromChild = () => (text.value = 'set by child')

          const n0 = template('<div></div>')()
          renderEffect(() => {
            setElementText(n0, `${text.value}|${props.n}`)
          })
          return n0
        },
      })

      const n = ref(0)
      const { host } = define({
        setup() {
          // the parent never binds `v-model:text`, it only changes `n` - which
          // still re-resolves the whole source
          return createComponent(Child, { $: [() => ({ n: n.value })] })
        },
      }).render()

      expect(host.innerHTML).toBe('<div>|0</div>')

      setFromChild!()
      await nextTick()
      expect(host.innerHTML).toBe('<div>set by child|0</div>')

      n.value++
      await nextTick()
      expect(host.innerHTML).toBe('<div>set by child|1</div>')
    })
  })

  test.each([
    ':class="data.classes"',
    ':class="[data.classes]"',
    'v-bind="data.input"',
    'v-bind="{}" :class="data.classes"',
    ':[data.key]="data.classes"',
  ])('v-once snapshots normalized declared class props (%s)', async binding => {
    const classes = { active: true }
    const data = ref({
      classes,
      input: { class: classes },
      key: 'class',
      readClass: () => '',
    })
    const Child = compile(
      `<script setup vapor>
        const props = defineProps({ class: String })
        _data.value.readClass = () => props.class
      </script>
      <template><div>{{ props.class }}</div></template>`,
      data,
    )
    const Parent = compile(
      `<template><components.Child v-once ${binding} /></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(data.value.readClass()).toBe('active')
    expect(host.innerHTML).toBe('<div>active</div>')

    data.value.classes.active = false
    await nextTick()

    expect.soft(data.value.readClass()).toBe('active')
    expect.soft(host.innerHTML).toBe('<div>active</div>')
  })

  test.each([
    ':style="[data.styles]"',
    ':style="data.styles"',
    'v-bind="data.input"',
    'v-bind="{}" :style="[data.styles]"',
    ':[data.key]="[data.styles]"',
  ])('v-once snapshots normalized declared style props (%s)', async binding => {
    const styles = { color: 'red' }
    const data = ref({
      styles,
      input: { style: [styles] },
      key: 'style',
      readStyle: () => ({ color: '' }),
    })
    const Child = compile(
      `<script setup vapor>
        const props = defineProps({ style: Object })
        _data.value.readStyle = () => props.style
      </script>
      <template><div>{{ props.style.color }}</div></template>`,
      data,
    )
    const Parent = compile(
      `<template><components.Child v-once ${binding} /></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(data.value.readStyle()).toEqual({ color: 'red' })
    expect(host.innerHTML).toBe('<div>red</div>')

    data.value.styles.color = 'blue'
    await nextTick()

    expect.soft(data.value.readStyle()).toEqual({ color: 'red' })
    expect.soft(host.innerHTML).toBe('<div>red</div>')
  })

  test.each([
    [':on-click="data.first" v-bind="data.attrs"', ['second']],
    ['v-bind="data.attrs" :on-click="data.first"', ['first']],
    [
      ':on-click="data.first" v-bind="data.attrs" :[data.key]="data.third"',
      ['second'],
    ],
    ['v-bind="{ \'on-click\': data.first, ...data.attrs }"', ['second']],
    [
      ':on-click="data.first" v-bind="{ \'on-click\': data.third }"',
      ['first', 'third'],
    ],
  ])(
    'declared event props preserve raw key precedence (%s)',
    async (binding, expected) => {
      await renderParity(
        {
          Child: `<script setup>
          const props = defineProps({ onClick: null })
          const trigger = () => {
            const handlers = Array.isArray(props.onClick)
              ? props.onClick
              : [props.onClick]
            handlers.forEach(handler => handler())
          }
        </script><template><button @click="trigger">click</button></template>`,
          App: `<template><components.Child ${binding} /></template>`,
        },
        () => {
          const calls: string[] = []
          return ref({
            calls,
            first: () => calls.push('first'),
            attrs: { onClick: () => calls.push('second') },
            third: () => calls.push('third'),
            key: 'on-click',
          })
        },
        async (data, root) => {
          root.querySelector('button')!.click()
          expect(data.value.calls).toEqual(expected)
        },
      )
    },
  )

  test('declared event props update merged sources and restore defaults', async () => {
    await renderParity(
      {
        Child: `<script setup>
          const props = defineProps({
            onClick: { default: () => () => _data.value.calls.push('default') }
          })
          const trigger = () => {
            const handlers = Array.isArray(props.onClick)
              ? props.onClick
              : [props.onClick]
            handlers.forEach(handler => handler())
          }
        </script><template><button @click="trigger">click</button></template>`,
        App: `<template><components.Child v-on="data.listeners" v-bind="data.attrs" /></template>`,
      },
      () => {
        const calls: string[] = []
        const first = () => calls.push('first')
        const second = () => calls.push('second')
        return ref({
          calls,
          listeners: { click: [first, second] } as Record<string, unknown>,
          attrs: { onClick: first } as Record<string, unknown>,
        })
      },
      async (data, root) => {
        const button = root.querySelector('button')!
        button.click()
        expect(data.value.calls).toEqual(['first', 'second'])

        data.value.calls.length = 0
        data.value.attrs = { 'on-click': () => data.value.calls.push('third') }
        await nextTick()
        button.click()
        expect(data.value.calls).toEqual(['third'])

        data.value.calls.length = 0
        data.value.attrs = {}
        await nextTick()
        button.click()
        expect(data.value.calls).toEqual(['first', 'second'])

        data.value.calls.length = 0
        data.value.listeners = {}
        await nextTick()
        button.click()
        expect(data.value.calls).toEqual(['default'])
      },
    )
  })

  test.each([undefined, 'active'])(
    'merged class props restore defaults when all sources are undefined (%s)',
    async initialClass => {
      await renderParity(
        {
          Child: `<script setup>
            const props = defineProps({ class: { type: String, default: 'fallback' } })
          </script><template><div>{{ props.class }}</div></template>`,
          App: `<template><components.Child :class="data.extra" v-bind="data.attrs" /></template>`,
        },
        () =>
          ref({
            extra: initialClass,
            attrs: { class: undefined as string | undefined },
          }),
        async (data, root) => {
          expect(root.textContent).toBe(initialClass ?? 'fallback')

          data.value.extra = undefined
          await nextTick()
          expect(root.textContent).toBe('fallback')

          data.value.attrs.class = ''
          await nextTick()
          expect(root.textContent).toBe('')

          data.value.attrs.class = undefined
          await nextTick()
          expect(root.textContent).toBe('fallback')

          data.value.extra = data.value.attrs.class = 'shared'
          await nextTick()
          expect(root.textContent).toBe('shared')
        },
      )
    },
  )

  test('prop validation does not mutate class and style source arrays', async () => {
    await renderParity(
      {
        Child: `<script setup>
          const props = defineProps({ class: String, style: Object })
        </script><template><div>{{ props.class }}|{{ JSON.stringify(props.style) }}</div></template>`,
        App: `<template><components.Child :class="data.classes" :style="data.styles" v-bind="data.attrs" /></template>`,
      },
      () =>
        ref({
          classes: ['a'],
          styles: [{ color: 'red' }],
          attrs: { class: 'b', style: { margin: '1px' } },
        }),
      async (data, root) => {
        expect.soft(data.value.classes).toEqual(['a'])
        expect.soft(data.value.styles).toEqual([{ color: 'red' }])
        expect(root.textContent).toBe('a b|{"color":"red","margin":"1px"}')

        data.value.attrs = { class: 'c', style: { padding: '2px' } }
        await nextTick()
        expect.soft(data.value.classes).toEqual(['a'])
        expect.soft(data.value.styles).toEqual([{ color: 'red' }])
        expect(root.textContent).toBe('a c|{"color":"red","padding":"2px"}')
      },
    )
  })

  // #15673: a compiled prop getter belongs to the parent's template, so once
  // the guard around it turns false the branch is going away; an inline
  // consumer of the child (a `flush: 'sync'` watcher) must not surface the
  // read that the guard made unreachable.
  describe('prop source re-read after its guard flipped', () => {
    const Child = `<script setup>
      import { watch } from 'vue'
      const data = _data
      const props = defineProps({ y: String })
      watch(() => props.y, v => data.value.seen.push(v), { flush: 'sync' })
    </script><template><p>child: {{ props.y }}</p></template>`

    // `x` goes away while Child (or a component around it) shows its `y`:
    // neither mode may see the watcher fire or the read throw
    async function expectGuardedRead(srcs: Record<string, string>) {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        { Child, ...srcs },
        () => ref<any>({ x: { y: 'a' }, seen: [] }),
        (data, root, mode) => {
          expect(root.textContent).toBe('child: a')
          data.value.x = undefined
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual([])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    }

    test('v-if child with a sync watcher', () =>
      expectGuardedRead({
        App: `<template>
          <components.Child v-if="data.x !== undefined" :y="data.x.y" />
          <p v-else>x is gone</p>
        </template>`,
      }))

    test('v-for row created after the branch rendered', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template>
            <div v-if="data.x !== undefined">
              <components.Child v-for="i in data.list" :key="i" :y="data.x.y" />
            </div>
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ x: { y: 'a' }, list: [1], seen: [] }),
        async (data, root, mode) => {
          data.value.list.push(2)
          await nextTick()
          expect(root.textContent!.replace(/\s/g, '')).toBe('child:achild:a')
          data.value.x = undefined
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual([])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    })

    test('grandchild watching a forwarded prop', () =>
      expectGuardedRead({
        Mid: `<script setup>
          const components = _components
          defineProps({ y: String })
        </script><template><components.Child :y="y" /></template>`,
        App: `<template>
          <components.Mid v-if="data.x !== undefined" :y="data.x.y" />
          <p v-else>x is gone</p>
        </template>`,
      }))

    test('source fixed again within the same tick', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template>
            <components.Child v-if="data.x !== undefined" :y="data.x.y" />
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ x: { y: 'a' }, seen: [] }),
        async (data, root, mode) => {
          data.value.x = undefined
          data.value.x = { y: 'b' }
          await nextTick()
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual(['b'])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('child: b')
      expect(vdom.text).toBe(vapor.text)
    })

    test('guard flips without the source throwing', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template>
            <components.Child v-if="data.x.ok" :y="data.x.y" />
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ x: { ok: true, y: 'a' }, seen: [] }),
        (data, root, mode) => {
          expect(root.textContent).toBe('child: a')
          data.value.x = { ok: false, y: 'other' }
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual([])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    })

    test('computed over the prop read before the sync watcher exists', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child: `<script setup>
            import { computed, watch } from 'vue'
            const data = _data
            const props = defineProps({ y: String })
            const y = computed(() => props.y)
            // a composable reads it before anything watches it
            data.value.first = y.value
            watch([y, () => data.value.local], ([v]) => data.value.seen.push(v), { flush: 'sync' })
          </script><template><p>child: {{ y }}</p></template>`,
          App: `<template>
            <components.Child v-if="data.x !== undefined" :y="data.x.y" />
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ x: { y: 'a' }, local: 0, seen: [] }),
        (data, root, mode) => {
          expect(data.value.first).toBe('a')
          data.value.x = undefined
          data.value.local++
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual(['a'])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    })

    // Only the prop reads move to the parent's commit; the watcher itself
    // stays synchronous for everything else it depends on.
    test('sync watcher over local state and a prop', async () => {
      const seen: Record<string, string[]> = {}
      await renderParity(
        {
          Child: `<script setup>
            import { watch } from 'vue'
            const data = _data
            const props = defineProps({ y: String })
            watch(
              [() => data.value.local, () => props.y],
              ([l, y]) => data.value.seen.push(l + ':' + y),
              { flush: 'sync' },
            )
          </script><template><p>child: {{ props.y }}</p></template>`,
          App: `<template>
            <components.Child v-if="data.x !== undefined" :y="data.x.y" />
          </template>`,
        },
        () => ref<any>({ x: { y: 'a' }, local: 0, seen: [] }),
        async (data, root, mode) => {
          data.value.local = 1
          seen[`${mode}:local`] = [...data.value.seen]
          data.value.x.y = 'b'
          seen[`${mode}:prop`] = [...data.value.seen]
          await nextTick()
          seen[`${mode}:flushed`] = [...data.value.seen]
        },
      )
      expect(seen['vdom:local']).toEqual(['1:a'])
      expect(seen['vapor:local']).toEqual(seen['vdom:local'])
      expect(seen['vdom:prop']).toEqual(['1:a'])
      expect(seen['vapor:prop']).toEqual(seen['vdom:prop'])
      expect(seen['vdom:flushed']).toEqual(['1:a', '1:b'])
      expect(seen['vapor:flushed']).toEqual(seen['vdom:flushed'])
    })

    test('v-bind object source', () =>
      expectGuardedRead({
        App: `<template>
          <components.Child v-if="data.x !== undefined" v-bind="{ y: data.x.y }" />
          <p v-else>x is gone</p>
        </template>`,
      }))

    test('slot content guarded by the slot owner', () =>
      expectGuardedRead({
        Wrapper: `<template><div><slot /></div></template>`,
        App: `<template>
          <components.Wrapper v-if="data.x !== undefined">
            <components.Child :y="data.x.y" />
          </components.Wrapper>
          <p v-else>x is gone</p>
        </template>`,
      }))

    test('slot content guarded inside the slot host', () =>
      expectGuardedRead({
        Wrapper: `<template>
          <slot v-if="data.x !== undefined" />
          <p v-else>x is gone</p>
        </template>`,
        App: `<template>
          <components.Wrapper><components.Child :y="data.x.y" /></components.Wrapper>
        </template>`,
      }))

    // useModel watches the prop synchronously on the component's behalf
    test('v-model child under the guard', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Child: `<script setup>
            const model = defineModel()
          </script><template><p>child: {{ model }}</p></template>`,
          App: `<template>
            <components.Child v-if="data.x !== undefined" v-model="data.x.y" />
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ x: { y: 'a' } }),
        (data, root) => {
          expect(root.textContent).toBe('child: a')
          data.value.x = undefined
        },
      )
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    })

    // the same raw props serve every component a dynamic component switches
    // to; a commit must not outlive the component that asked for it
    test('dynamic component switched away from the watching one', async () => {
      const { vdom, vapor } = await renderParity(
        {
          A: Child,
          B: `<script setup>
            defineProps({ y: String })
          </script><template><p>b: {{ y }}</p></template>`,
          App: `<template>
            <component :is="data.a ? components.A : components.B" :y="data.y" />
          </template>`,
        },
        () => ref<any>({ a: true, y: 'a', seen: [] }),
        async (data, root) => {
          expect(root.textContent).toBe('child: a')
          data.value.a = false
          await nextTick()
          expect(root.textContent).toBe('b: a')
          data.value.y = 'b'
          await nextTick()
        },
      )
      expect(vapor.text).toBe('b: b')
      expect(vdom.text).toBe(vapor.text)
    })

    // coverage guard: interop props are committed by the vdom parent's patch
    // already, so a vapor child under a vdom v-if needs no commit of its own
    test('vapor child with a sync watcher under a vdom v-if', async () => {
      const data = ref<any>({ x: { y: 'a' }, seen: [] })
      const components: Record<string, any> = {}
      components.Child = compile(Child, data, components, { vapor: true })
      const App = compile(
        `<script setup>const data = _data; const components = _components;</script>
        <template>
          <components.Child v-if="data.x !== undefined" :y="data.x.y" />
          <p v-else>x is gone</p>
        </template>`,
        data,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin).mount(root)
      expect(root.textContent).toBe('child: a')
      data.value.x = undefined
      await nextTick()
      expect(data.value.seen).toEqual([])
      expect(root.textContent).toBe('x is gone')
      app.unmount()
    })

    test('vdom child with a sync watcher under a vapor v-if', async () => {
      const data = ref<any>({ x: { y: 'a' }, seen: [] })
      const components: Record<string, any> = {}
      components.Child = compile(Child, data, components, { vapor: false })
      const App = compile(
        `<template>
          <components.Child v-if="data.x !== undefined" :y="data.x.y" />
          <p v-else>x is gone</p>
        </template>`,
        data,
        components,
        { vapor: true },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin).mount(root)
      expect(root.textContent).toBe('child: a')
      data.value.x = undefined
      await nextTick()
      expect(data.value.seen).toEqual([])
      expect(root.textContent).toBe('x is gone')
      app.unmount()
    })

    // #15228: deactivation freezes parent inputs while local effects stay live.
    test('kept-alive child with a sync watcher', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template>
            <KeepAlive>
              <components.Child v-if="data.x !== undefined" :y="data.x.y" />
              <p v-else>x is gone</p>
            </KeepAlive>
          </template>`,
        },
        () => ref<any>({ x: { y: 'a' }, seen: [] }),
        async (data, root, mode) => {
          expect(root.textContent).toBe('child: a')
          data.value.x = undefined
          await nextTick()
          expect(root.textContent).toBe('x is gone')
          data.value.x = { y: 'b' }
          await nextTick()
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual(['b'])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('child: b')
      expect(vdom.text).toBe(vapor.text)
    })

    // a v-bind source hands over the reactive object itself; the commit must
    // snapshot its top level so the child stops depending on the container
    test('v-bind of a reactive object', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template>
            <components.Child v-if="'y' in data.bag" v-bind="data.bag" />
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ bag: { y: 'a' }, seen: [] }),
        async (data, root, mode) => {
          expect(root.textContent).toBe('child: a')
          data.value.bag.y = 'b'
          await nextTick()
          expect(root.textContent).toBe('child: b')
          delete data.value.bag.y
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual(['b'])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    })

    test('computed over a v-bind prop read before the sync watcher exists', async () => {
      const seen: Record<string, string[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child: `<script setup>
            import { computed, watch } from 'vue'
            const data = _data
            const props = defineProps({ y: String })
            const y = computed(() => props.y)
            data.value.first = y.value
            watch(y, v => data.value.seen.push(v), { flush: 'sync' })
          </script><template><p>child: {{ y }}</p></template>`,
          App: `<template>
            <components.Child v-if="'y' in data.bag" v-bind="data.bag" />
            <p v-else>x is gone</p>
          </template>`,
        },
        () => ref<any>({ bag: { y: 'a' }, seen: [] }),
        (data, root, mode) => {
          expect(data.value.first).toBe('a')
          delete data.value.bag.y
          seen[mode] = data.value.seen
        },
      )
      expect(seen.vdom).toEqual([])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('x is gone')
      expect(vdom.text).toBe(vapor.text)
    })

    // A first read triggered outside the component must see its delivered value.
    test('input first read by a sync watcher outside the component', async () => {
      const seen: Record<string, string[]> = {}
      await renderParity(
        {
          Child: `<script setup>
            import { useAttrs, watch } from 'vue'
            defineOptions({ inheritAttrs: false })
            const data = _data
            const attrs = useAttrs()
            watch(
              () => (data.value.enabled ? attrs.y : undefined),
              v => data.value.seen.push(v),
              { flush: 'sync' },
            )
          </script><template><span /></template>`,
          App: `<template><components.Child :y="data.x.y" /></template>`,
        },
        () =>
          ref<any>({
            x: { y: 'a' },
            enabled: false,
            seen: [],
          }),
        (data, root, mode) => {
          data.value.x.y = 'b'
          data.value.enabled = true
          seen[mode] = [...data.value.seen]
        },
      )
      expect(seen.vdom).toEqual(['a'])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    test('object prop keeps its identity when a sync watcher is registered', async () => {
      const same: Record<string, boolean[]> = {}
      await renderParity(
        {
          Child: `<script setup>
            import { computed, watch } from 'vue'
            const data = _data
            const props = defineProps({ y: Object, z: Array })
            const y = computed(() => props.y)
            const z = computed(() => props.z)
            void y.value, z.value
            watch([y, z], () => {}, { flush: 'sync' })
            data.value.same = [y.value === props.y, z.value === props.z]
          </script><template><p>{{ y.value }}</p></template>`,
          App: `<template>
            <components.Child :y="{ value: data.x }" :z="[data.x]" />
          </template>`,
        },
        () => ref<any>({ x: 'a' }),
        (data, root, mode) => {
          same[mode] = data.value.same
        },
      )
      expect(same.vdom).toEqual([true, true])
      expect(same.vapor).toEqual(same.vdom)
    })

    test('sync watcher callbacks do not become prop source dependencies', async () => {
      await renderParity(
        {
          Child: `<script setup>
            import { ref, watch } from 'vue'
            const props = defineProps({ y: Array })
            const count = ref(0)
            watch(() => props.y, () => count.value++, { flush: 'sync' })
          </script><template><p>{{ props.y[0] }}:{{ count }}</p></template>`,
          App: `<template><components.Child :y="[data.x]" /></template>`,
        },
        () => ref({ x: 'a' }),
        async (data, root) => {
          expect(root.textContent).toBe('a:0')
          data.value.x = 'b'
          await nextTick()
          expect(root.textContent).toBe('b:1')
          data.value.x = 'c'
          await nextTick()
          expect(root.textContent).toBe('c:2')
        },
      )
    })

    // Without a guard the read is the parent's own bug. vdom reports it from
    // the parent render; vapor must report it the same way instead of
    // throwing it at whoever assigned the ref.
    test('unguarded source reports through the app error handler', async () => {
      for (const vapor of [false, true]) {
        const data = ref<any>({ x: { y: 'a' }, seen: [] })
        const components: Record<string, any> = {}
        components.Child = compile(Child, data, components, { vapor })
        const App = compile(
          `<script setup>const data = _data; const components = _components;</script>
          <template><components.Child :y="data.x.y" /></template>`,
          data,
          components,
          { vapor },
        )
        const root = document.createElement('div')
        const app = vapor ? createVaporApp(App) : createApp(App)
        const handler = (app.config.errorHandler = vi.fn())
        app.use(vaporInteropPlugin).mount(root)
        expect(root.textContent).toBe('child: a')

        expect(() => (data.value.x = undefined)).not.toThrow()
        await nextTick()
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0][0]).toBeInstanceOf(TypeError)
        expect(data.value.seen).toEqual([])
        app.unmount()
      }
    })
  })

  test('keeps the public props identity and updates only affected key consumers', async () => {
    const data = ref({ count: 0, stable: 42 })
    let props: any
    let readProps!: () => unknown
    const countReads: unknown[] = []
    const stableReads: unknown[] = []
    let setups = 0
    const Child = defineVaporComponent({
      props: ['count', 'stable'],
      setup(received) {
        setups++
        props = received
        readProps = () => received
        watchSyncEffect(() => countReads.push(received.count))
        watchSyncEffect(() => stableReads.push(received.stable))
        return []
      },
    })
    const { app } = define(
      compile(
        `<template><components.Child :count="data.count" :stable="data.stable" /></template>`,
        data,
        { Child },
      ),
    ).render()
    const original = props

    data.value.count = 1
    expect(props.count).toBe(0)
    await nextTick()

    app.unmount()
    expect(setups).toBe(1)
    expect(readProps()).toBe(original)
    expect(props.count).toBe(1)
    expect(countReads).toEqual([0, 1])
    expect(stableReads).toEqual([42])
  })

  test('retains an unread intermediate delivery after its source becomes invalid', async () => {
    let exposed: any
    const data = ref<any>({
      x: { y: 'a' },
      capture: (instance: any) => {
        if (instance) exposed = instance
      },
    })
    const Child = defineVaporComponent({
      props: ['value'],
      setup(props, { expose }) {
        expose({ read: () => props.value })
        return []
      },
    })
    const { app } = define(
      compile(
        `<template><components.Child v-if="data.x !== undefined" :value="data.x.y" :ref="data.capture" /></template>`,
        data,
        { Child },
      ),
    ).render()
    const read = exposed.read
    // No application consumer has read the value, including its initial value.
    // This test is also run with DEV disabled to exclude validation reads.
    data.value.x = { y: 'b' }
    await nextTick()
    data.value.x = undefined

    expect(read()).toBe('b')
    await nextTick()
    expect(read()).toBe('b')
    app.unmount()
  })

  test('updates dynamic v-bind keys and attrs without invoking function values', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const data = ref<any>({ bag: { known: 'a', legacy: 'old', fn: first } })
    let props: any
    let attrs: any
    const Child = defineVaporComponent({
      inheritAttrs: false,
      props: ['known', 'fn'],
      setup(received, context) {
        props = received
        attrs = context.attrs
        return []
      },
    })
    const { app } = define(
      compile(
        `<template><components.Child v-bind="data.bag" /></template>`,
        data,
        { Child },
      ),
    ).render()
    expect(props.fn).toBe(first)
    expect({ ...attrs }).toEqual({ legacy: 'old' })

    delete data.value.bag.legacy
    data.value.bag.next = 'new'
    data.value.bag.known = 'b'
    data.value.bag.fn = second
    await nextTick()

    expect(props.known).toBe('b')
    expect(props.fn).toBe(second)
    expect({ ...attrs }).toEqual({ next: 'new' })
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
    app.unmount()
  })

  test('uses Object.is equality for delivered NaN and signed zero values', async () => {
    const data = shallowRef({ value: NaN })
    const seen: unknown[] = []
    const Child = defineVaporComponent({
      props: ['value'],
      setup(props) {
        watchSyncEffect(() => seen.push(props.value))
        return []
      },
    })
    const { app } = define(
      compile(
        `<template><components.Child :value="data.value" /></template>`,
        data,
        { Child },
      ),
    ).render()

    // Replacing the container reruns input collection even when the prop is equal.
    data.value = { value: NaN }
    await nextTick()
    expect(seen).toEqual([NaN])

    data.value = { value: 0 }
    await nextTick()
    data.value = { value: -0 }
    await nextTick()
    data.value = { value: -0 }
    await nextTick()
    data.value = { value: 0 }
    await nextTick()

    expect(seen).toEqual([NaN, 0, -0, 0])
    app.unmount()
  })

  test('preserves ref prop identity without unwrapping or tracking its inner value', async () => {
    const first = ref('first')
    const second = ref('second')
    const data = shallowRef({ value: first })
    const seen: unknown[] = []
    let props: any
    const Child = defineVaporComponent({
      props: ['value'],
      setup(received) {
        props = received
        watchSyncEffect(() => seen.push(received.value))
        return []
      },
    })
    const { app } = define(
      compile(
        `<template><components.Child :value="data.value" /></template>`,
        data,
        { Child },
      ),
    ).render()
    expect(props.value).toBe(first)

    first.value = 'changed'
    await nextTick()
    expect(props.value).toBe(first)
    expect(props.value.value).toBe('changed')
    expect(seen).toEqual([first])

    data.value = { value: second }
    expect(props.value).toBe(first)
    await nextTick()
    expect(props.value).toBe(second)
    expect(seen).toEqual([first, second])
    app.unmount()
  })

  test('resolves Boolean and default props when dynamic inputs change', async () => {
    await renderParity(
      {
        Child: `<script setup>
          const props = defineProps({
            enabled: Boolean,
            label: { type: String, default: 'fallback' }
          })
        </script><template><span>{{ props.enabled }}:{{ props.label }}</span></template>`,
        App: `<template><components.Child v-bind="data.bag" /></template>`,
      },
      () => ref<any>({ bag: {} }),
      async (data, root) => {
        expect(root.textContent).toBe('false:fallback')
        data.value.bag = { enabled: '', label: undefined }
        await nextTick()
        expect(root.textContent).toBe('true:fallback')
        data.value.bag = { enabled: false, label: 'named' }
        await nextTick()
        expect(root.textContent).toBe('false:named')
        data.value.bag = {}
        await nextTick()
        expect(root.textContent).toBe('false:fallback')
      },
    )
  })

  test('updates ordinary props before running default factories', async () => {
    await renderParity(
      {
        Child: `<script setup>
          const props = defineProps({
            first: { default: props => {
              _data.value.reads.push(['first', props.normal, props.second])
              return 'first-default'
            } },
            normal: String,
            second: { default: props => {
              _data.value.reads.push(['second', props.normal, props.first])
              return 'second-default'
            } }
          })
        </script><template><span>{{ props.first }}:{{ props.normal }}:{{ props.second }}</span></template>`,
        App: `<template><components.Child v-bind="data.bag" /></template>`,
      },
      () =>
        ref<any>({
          bag: { first: 'first-old', normal: 'old', second: 'second-old' },
          reads: [],
        }),
      async (data, root) => {
        expect(data.value.reads).toEqual([])
        data.value.bag = { normal: 'new', first: undefined, second: undefined }
        await nextTick()
        expect(data.value.reads).toEqual([
          ['first', 'new', 'second-old'],
          ['second', 'new', 'first-default'],
        ])
        expect(root.textContent).toBe('first-default:new:second-default')
      },
    )
  })

  test.each(['getter', 'default factory'])(
    'stops collecting inputs after an initial %s failure',
    async failureStage => {
      const trigger = ref(0)
      const failure = new Error(`initial ${failureStage} failure`)
      const errors: unknown[] = []
      const setup = vi.fn(() => [])
      const read = vi.fn(() => {
        void trigger.value
        if (failureStage === 'getter') throw failure
        return undefined
      })
      const defaultValue = vi.fn(() => {
        throw failure
      })
      const Child = defineVaporComponent({
        props: {
          value:
            failureStage === 'default factory' ? { default: defaultValue } : {},
        },
        setup,
      })
      const { create, mount } = define({
        render: () => [],
        setup: () => createComponent(Child, { value: read }),
      })
      const { app } = create()
      app.config.errorHandler = error => errors.push(error)
      mount()
      expect(errors).toEqual([failure])
      expect(setup).not.toHaveBeenCalled()
      expect(read).toHaveBeenCalledTimes(1)
      app.unmount()
      trigger.value++
      await nextTick()
      expect(read).toHaveBeenCalledTimes(1)
      expect(errors).toEqual([failure])
      expect(defaultValue).toHaveBeenCalledTimes(
        failureStage === 'default factory' ? 1 : 0,
      )
    },
  )

  describe('input evaluation', () => {
    // the inputs of a child are evaluated together, so a literal is a new
    // value whenever one of them changes
    test('a literal input is a new value when another one changes', async () => {
      const changed: Record<string, number> = {}
      await renderParity(
        {
          Child: `<script setup>
            import { watch } from 'vue'
            const data = _data
            const props = defineProps({ count: Number, items: Array })
            watch(() => props.items, () => data.value.counter.changed++)
          </script><template><i>{{ count }}</i></template>`,
          App: `<template>
            <components.Child :count="data.count" :items="[data.stable]" />
          </template>`,
        },
        () =>
          ref<any>({ count: 0, stable: 's', counter: markRaw({ changed: 0 }) }),
        async (data, root, mode) => {
          data.value.count++
          await nextTick()
          expect(root.textContent).toBe('1')
          changed[mode] = data.value.counter.changed
        },
      )
      expect(changed.vdom).toBe(1)
      expect(changed.vapor).toBe(changed.vdom)
    })

    test('the inputs of a child are evaluated together', async () => {
      const calls: Record<string, number[]> = {}
      await renderParity(
        {
          Child: `<script setup>
            defineProps({ heavy: Number, flag: Number })
          </script><template><i>{{ flag }}</i></template>`,
          App: `<script setup>
            const data = _data
            const components = _components
            const heavy = () => (data.value.counter.calls++, data.value.own)
          </script><template>
            <components.Child :heavy="heavy()" :flag="data.flag" />
          </template>`,
        },
        () => ref<any>({ flag: 0, own: 0, counter: markRaw({ calls: 0 }) }),
        async (data, root, mode) => {
          const seen = [data.value.counter.calls]
          data.value.flag++
          await nextTick()
          data.value.flag++
          await nextTick()
          seen.push(data.value.counter.calls)
          data.value.own++
          await nextTick()
          seen.push(data.value.counter.calls)
          calls[mode] = seen
        },
      )
      expect(calls.vdom).toEqual([1, 3, 4])
      expect(calls.vapor).toEqual(calls.vdom)
    })

    // normalizing a style allocates; an untouched source must not look new.
    // vdom notifies attrs as a whole, so its watcher runs again
    test.each([
      ['alone', ''],
      ['next to a v-bind source', 'v-bind="data.bag"'],
    ])(
      'a style input %s keeps its value while another one changes',
      async (_, bind) => {
        const runs: Record<string, number> = {}
        await renderParity(
          {
            Child: `<script setup>
            import { useAttrs, watchEffect } from 'vue'
            defineOptions({ inheritAttrs: false })
            const data = _data
            defineProps({ n: Number })
            const attrs = useAttrs()
            watchEffect(() => {
              void attrs.style
              data.value.counter.runs++
            })
          </script><template><i>{{ n }}</i></template>`,
            App: `<template>
            <components.Child ${bind} :style="{ color: data.c }" :n="data.n" />
          </template>`,
          },
          () =>
            ref<any>({
              c: 'red',
              n: 0,
              bag: {},
              counter: markRaw({ runs: 0 }),
            }),
          async (data, root, mode) => {
            data.value.n++
            await nextTick()
            expect(root.textContent).toBe('1')
            runs[mode] = data.value.counter.runs
          },
        )
        expect(runs.vdom).toBe(2)
        expect(runs.vapor).toBe(1)
      },
    )

    test('each kind of input follows its own source', async () => {
      const steps: Record<string, string[]> = {}
      await renderParity(
        {
          Child: `<script setup>
            import { useAttrs } from 'vue'
            defineOptions({ inheritAttrs: false })
            const data = _data
            defineProps({
              flag: Boolean,
              size: { type: String, default: 'm' },
              fooBar: Number,
            })
            const emit = defineEmits(['ping'])
            const attrs = useAttrs()
            data.value.ping = () => emit('ping')
          </script><template>
            <i>{{ flag }}|{{ size }}|{{ fooBar }}|{{ attrs.title }}|{{ attrs.class }}</i>
          </template>`,
          App: `<template>
            <components.Child
              :flag="data.flag"
              :size="data.size"
              :foo-bar="data.n"
              :title="data.title"
              :class="{ on: data.on }"
              :onPing="data.handler"
            />
          </template>`,
        },
        () =>
          ref<any>({
            flag: false,
            size: 's',
            n: 0,
            title: 't',
            on: false,
            pings: [],
            handler: markRaw(function first(this: any) {}),
          }),
        async (data, root, mode) => {
          const seen = [root.textContent!.trim()]
          const step = async (change: () => void) => {
            change()
            await nextTick()
            seen.push(root.textContent!.trim())
          }
          await step(() => (data.value.flag = ''))
          await step(() => (data.value.size = undefined))
          await step(() => (data.value.size = 'l'))
          await step(() => data.value.n++)
          await step(() => (data.value.title = 'x'))
          await step(() => (data.value.on = true))
          await step(() => {
            data.value.handler = markRaw(() => data.value.pings.push('second'))
          })
          data.value.ping()
          seen.push(data.value.pings.join())
          steps[mode] = seen
        },
      )
      expect(steps.vdom).toEqual([
        'false|s|0|t|',
        'true|s|0|t|',
        'true|m|0|t|',
        'true|l|0|t|',
        'true|l|1|t|',
        'true|l|1|x|',
        'true|l|1|x|on',
        'true|l|1|x|on',
        'second',
      ])
      expect(steps.vapor).toEqual(steps.vdom)
    })

    // a delivery that throws half-way is redone in full on the next run.
    // vdom resolves a default before the sibling props it reads, so the
    // factory cannot fail there
    test('a failed delivery is retried in full', async () => {
      const data = ref<any>({
        model: 'x',
        options: [{ value: 'a' }],
        disabled: false,
      })
      const Child = compile(
        `<script setup>
          defineProps({
            modelValue: { type: String, default: p => p.options[0].value },
            options: Array,
            disabled: Boolean,
          })
        </script><template><i>{{ modelValue }}|{{ disabled }}</i></template>`,
        data,
      )
      const App = compile(
        `<template>
          <components.Child
            :modelValue="data.model"
            :options="data.options"
            :disabled="data.disabled"
          />
        </template>`,
        data,
        { Child },
      )
      const errors: unknown[] = []
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.config.errorHandler = e => errors.push(e)
      app.mount(root)
      expect(root.textContent).toBe('x|false')
      data.value.model = undefined
      data.value.options = []
      data.value.disabled = true
      await nextTick()
      expect(errors.length).toBe(1)
      data.value.options = [{ value: 'b' }]
      await nextTick()
      expect(root.textContent).toBe('b|true')
      app.unmount()
    })

    // a sync watcher sees a delivery as a whole, whichever prop is written
    // first. vdom writes key by key, so the guarded-first order throws there
    test.each([
      ['the guard first', `:show="data.show" :item="data.item"`],
      ['the guarded one first', `:item="data.item" :show="data.show"`],
    ])('a delivery is atomic for a sync watcher, %s', async (_, attrs) => {
      const data = ref<any>({ show: true, item: { name: 'a' }, seen: [] })
      const Child = compile(
        `<script setup>
          import { watchSyncEffect } from 'vue'
          const data = _data
          const props = defineProps({ show: Boolean, item: Object })
          watchSyncEffect(() => {
            if (props.show) data.value.seen.push(props.item.name)
          })
        </script><template><i>{{ show }}</i></template>`,
        data,
      )
      const App = compile(
        `<template><components.Child ${attrs} /></template>`,
        data,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)
      expect(data.value.seen).toEqual(['a'])
      data.value.show = false
      data.value.item = null
      await nextTick()
      expect(data.value.seen).toEqual(['a'])
      data.value.item = { name: 'b' }
      data.value.show = true
      await nextTick()
      expect(data.value.seen).toEqual(['a', 'b'])
      app.unmount()
    })

    // reading `attrs.toString` goes through the proxy: such a key must not
    // resolve to an inherited member of the dep table
    test('an inherited key is not a dep', () => {
      const data = ref<any>({ n: 0 })
      const Child = compile(
        `<script setup>
          import { useAttrs, watchEffect } from 'vue'
          defineOptions({ inheritAttrs: false })
          const attrs = useAttrs()
          watchEffect(() => {
            attrs.toString
            attrs.constructor
          })
        </script><template><i /></template>`,
        data,
      )
      const { app } = define(
        compile(
          `<template><components.Child :title="data.n" /></template>`,
          data,
          { Child },
        ),
      ).render()
      expect(Object.prototype.toString).not.toHaveProperty('subs')
      expect(Object).not.toHaveProperty('subs')
      app.unmount()
    })

    // the host's update job unmounts the child before its inputs can run
    test('inputs run after the vdom host that guards them', async () => {
      const data = ref<any>({ user: { name: 'n' } })
      const components: Record<string, any> = {}
      components.Modal = compile(
        `<script setup>
          defineProps({ show: Boolean })
        </script><template><div><slot v-if="show" /></div></template>`,
        data,
        components,
        { vapor: false },
      )
      components.Child = compile(
        `<script setup>
          defineProps({ name: String })
        </script><template><i>{{ name }}</i></template>`,
        data,
        components,
      )
      const App = compile(
        `<template>
          <components.Modal :show="data.user !== null">
            <components.Child :name="data.user.name" />
          </components.Modal>
        </template>`,
        data,
        components,
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin).mount(root)
      expect(root.textContent).toBe('n')
      data.value.user = null
      await nextTick()
      expect(root.textContent).toBe('')
      app.unmount()
    })

    // observed on the instance: inputs that can never change are not tracked
    test('inputs that cannot change are static', () => {
      const instances: Record<string, any> = {}
      const data = ref<any>({ c: 1 })
      const Child = (name: string) =>
        compile(
          `<script setup>
            const data = _data
            defineProps({ a: String, b: Number, c: Number, opts: Object })
            defineEmits(['ping'])
            data.value.capture('${name}')
          </script><template><i /></template>`,
          data,
        )
      data.value.capture = (name: string) => (instances[name] = currentInstance)
      const { app } = define(
        compile(
          `<script setup>
            const data = _data
            const components = _components
            const OPTS = { x: 1 }
            const onPing = () => {}
          </script><template>
            <components.None />
            <components.Static a="x" :b="1" />
            <components.Constant :opts="OPTS" @ping="onPing" />
            <components.Live a="x" :c="data.c" />
          </template>`,
          data,
          {
            None: Child('none'),
            Static: Child('static'),
            Constant: Child('constant'),
            Live: Child('live'),
          },
        ),
      ).render()
      expect(instances.none.hasDynamicProps).toBe(false)
      expect(instances.static.hasDynamicProps).toBe(false)
      expect(instances.constant.hasDynamicProps).toBe(false)
      expect(instances.live.hasDynamicProps).toBe(true)
      expect(instances.constant.props.opts).toEqual({ x: 1 })
      app.unmount()
    })
  })

  test('empty fallthrough attrs are not merged into the root props', async () => {
    const child = `<script setup>
      defineProps(['style'])
    </script><template><i>{{ typeof $props.style }}</i></template>`
    const VdomChild = defineComponent({
      props: ['style'],
      setup: props => () => h('i', typeof props.style),
    })
    const wrapper = (child: string, bind = '') => `<script setup>
      const data = _data
      const components = _components
      defineEmits(['ready'])
    </script><template><components.${child} :style="data.style" ${bind} /></template>`
    const { vdom, vapor } = await renderParity(
      {
        Child: child,
        A: wrapper('Child'),
        B: wrapper('VdomChild'),
        // an explicit v-bind still merges, like mergeProps
        C: wrapper('Child', 'v-bind="data.rest"'),
        App: `<template>
          <components.A @ready="() => {}" />
          <components.B @ready="() => {}" />
          <components.C @ready="() => {}" />
        </template>`,
      },
      () => ref({ style: undefined, rest: {} }),
      () => {},
      { VdomChild },
    )
    expect(vdom.after).toBe('<i>undefined</i><i>undefined</i><i>object</i>')
    expect(vapor.after).toBe(vdom.after)
  })

  test.each([
    ['', 'defineProps({ ...baseProps, other: String })'],
    ['', 'defineProps(baseProps)'],
    ['export default { props: baseProps }', ''],
  ])('props the compiler cannot see: %s%s', async (script, setup) => {
    const { vdom, vapor } = await renderParity(
      {
        Child: `<script>
            const baseProps = { label: String, other: String }
            ${script}
          </script>
          <script setup>const sep = '-'; ${setup}</script>
          <template><i :title="label">{{ label }}{{ sep }}{{ other }}</i></template>`,
        App: `<template><components.Child :label="data.label" other="b" /></template>`,
      },
      () => ref({ label: 'a' }),
      data => {
        data.value.label = 'c'
      },
    )
    expect(vapor).toEqual(vdom)
    expect(vapor.after).toBe('<i title="c">c-b</i>')
  })

  test('props the compiler cannot see in a dev build', async () => {
    const data = ref({ label: 'a' })
    const Child = compile(
      `<script>const baseProps = { label: String }</script>
      <script setup>defineProps(baseProps)</script>
      <template><i>{{ label }}{{ missing }}</i></template>`,
      data,
      {},
      { inlineTemplate: false },
    )
    const App = compile(
      `<template><components.Child :label="data.label" /></template>`,
      data,
      { Child },
    )
    const { host } = define(App).render()
    expect(host.innerHTML).toBe('<i>a</i>')
    expect(
      'Property "missing" was accessed during render but is not defined on instance.',
    ).toHaveBeenWarned()

    data.value.label = 'c'
    await nextTick()
    expect(host.innerHTML).toBe('<i>c</i>')
  })
})

describe('component: fallthrough props parity', () => {
  const child = `<script setup>
    defineOptions({ inheritAttrs: false })
    const props = defineProps(['style'])
  </script><template><i>{{ typeof props.style }}:{{ JSON.stringify(props.style) }}</i></template>`

  test.each([
    ['Child', ''],
    ['VdomChild', ''],
    ['VaporChild', ''],
    ['Child', 'v-bind="data.rest"'],
    ['VdomChild', 'v-bind="data.rest"'],
    ['VaporChild', 'v-bind="data.rest"'],
  ])(
    'style values and changing fallthrough attrs: %s %s',
    async (target, bind) => {
      const VdomChild = defineComponent({
        inheritAttrs: false,
        props: ['style'],
        setup: props => () =>
          h(
            'i',
            typeof props.style + ':' + (JSON.stringify(props.style) || ''),
          ),
      })
      const snapshots = { vdom: [] as string[], vapor: [] as string[] }
      await renderParity(
        {
          Child: child,
          Wrapper: `<script setup>
          const data = _data
          const components = _components
          defineEmits(['ready'])
        </script><template><components.${target} :style="data.style" ${bind} /></template>`,
          App: '<template><components.Wrapper v-bind="data.attrs" @ready="() => {}" /></template>',
        },
        () => ref({ style: undefined as any, attrs: {} as any, rest: {} }),
        async (data, root, mode) => {
          for (const style of [
            undefined,
            'color: red',
            { color: 'red' },
            [{ color: 'red' }, { background: 'blue' }],
          ]) {
            for (const attrs of [
              {},
              { id: 'inherited' },
              {},
              { style: 'background: blue' },
              {},
            ]) {
              data.value.style = style
              data.value.attrs = attrs
              await nextTick()
              snapshots[mode].push(root.textContent!)
            }
          }
        },
        { VdomChild, VaporChild: compile(child, ref({})) },
      )
      expect(snapshots.vapor).toEqual(snapshots.vdom)
    },
  )

  test.each(['', 'v-bind="data.rest"'])(
    'filtered model listener preserves VDOM merging semantics: %s',
    async bind => {
      const { vdom, vapor } = await renderParity(
        {
          Child: child,
          Wrapper: `<script setup>
            const data = _data
            const components = _components
            defineProps(['modelValue'])
          </script><template><components.Child :style="undefined" ${bind} /></template>`,
          App: '<template><components.Wrapper v-model="data.value" /></template>',
        },
        () => ref({ value: 'x', rest: {} }),
        () => {},
      )
      expect(vdom.text).toBe('object:{}')
      expect(vapor.text).toBe(vdom.text)
    },
  )
})
