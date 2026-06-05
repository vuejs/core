import {
  VaporKeepAlive,
  VaporTransition,
  createComponent,
  createIf,
  defineVaporComponent,
  insert,
  renderEffect,
  template,
  // @ts-expect-error
  withDirectives,
} from '../src'
import { nextTick, ref } from '@vue/runtime-dom'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import type { Mock } from 'vitest'
import { ifFlags, makeRender } from './_utils'
import { setElementText } from '../src/dom/prop'
import type { DynamicFragment } from '../src/fragment'

const define = makeRender()
const singleRootIfElse =
  VaporBlockShape.SINGLE_ROOT | (VaporBlockShape.SINGLE_ROOT << 2)
const singleRootNoScope =
  VaporBlockShape.SINGLE_ROOT | VaporIfFlags.TRUE_NO_SCOPE
const singleRootNoScopeIfElse =
  singleRootIfElse | VaporIfFlags.TRUE_NO_SCOPE | VaporIfFlags.FALSE_NO_SCOPE

describe('createIf', () => {
  test('basic', async () => {
    // mock this template:
    //  <div>
    //    <p v-if="counter">{{counter}}</p>
    //    <p v-else>zero</p>
    //  </div>

    let spyIfFn: Mock<() => Node>
    let spyElseFn: Mock<() => Node>
    const count = ref(0)

    const spyConditionFn = vi.fn(() => count.value)

    // templates can be reused through caching.
    const t0 = template('<div></div>')
    const t1 = template('<p></p>')
    const t2 = template('<p>zero</p>')

    const { host } = define(() => {
      const n0 = t0()

      insert(
        createIf(
          spyConditionFn,
          // v-if
          (spyIfFn ||= vi.fn(() => {
            const n2 = t1()
            renderEffect(() => {
              setElementText(n2, count.value)
            })
            return n2
          })),
          // v-else
          (spyElseFn ||= vi.fn(() => {
            const n4 = t2()
            return n4
          })),
        ),
        n0 as any as ParentNode,
      )
      return n0
    }).render()

    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(1)
    expect(spyIfFn!).toHaveBeenCalledTimes(0)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>1</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(2)
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>2</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(3)
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value = 0
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(4)
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(2)
  })

  test('should handle nested template', async () => {
    // mock this template:
    //  <template v-if="ok1">
    //    Hello <template v-if="ok2">Vapor</template>
    //  </template>

    const ok1 = ref(true)
    const ok2 = ref(true)

    const t0 = template('Vapor')
    const t1 = template('Hello ')
    const { host } = define(() => {
      const n1 = createIf(
        () => ok1.value,
        () => {
          const n2 = t1()
          const n3 = createIf(
            () => ok2.value,
            () => {
              const n4 = t0()
              return n4
            },
          )
          return [n2, n3]
        },
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe('Hello Vapor<!--if--><!--if-->')

    ok1.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')

    ok1.value = true
    await nextTick()
    expect(host.innerHTML).toBe('Hello Vapor<!--if--><!--if-->')

    ok2.value = false
    await nextTick()
    expect(host.innerHTML).toBe('Hello <!--if--><!--if-->')

    ok1.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')
  })

  test('with v-once', async () => {
    const toggle = ref(false)
    const { html } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => template('<p>foo</p>')(),
          () => template('<p>bar</p>')(),
          ifFlags(singleRootIfElse, true),
        )
      },
    }).render()

    expect(html()).toBe('<p>bar</p>')

    toggle.value = true
    await nextTick()
    // should not change
    expect(html()).toBe('<p>bar</p>')
  })

  test('should trigger fragment onUpdated when branch becomes empty', async () => {
    const show = ref(true)
    const onUpdated = vi.fn()
    let frag!: DynamicFragment

    const { host } = define(() => {
      frag = createIf(
        () => show.value,
        () => template('<div>foo</div>')(),
      ) as DynamicFragment
      frag.onUpdated = [onUpdated]
      return frag
    }).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onUpdated).toHaveBeenLastCalledWith([])

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(onUpdated).toHaveBeenCalledTimes(2)
  })

  test('should skip branch scope for compiler-proven static single-root branch', async () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    let frag!: DynamicFragment

    const { host } = define(() => {
      frag = createIf(
        () => show.value,
        () => t0(),
        undefined,
        singleRootNoScope,
      ) as DynamicFragment
      return frag
    }).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(frag.scope).toBeUndefined()
  })

  test('should keep branch scope for no-scope branch with fallthrough attrs', async () => {
    const show = ref(true)
    const id = ref('a')
    const t0 = template('<div>foo</div>')
    let frag!: DynamicFragment
    const Child = defineVaporComponent({
      setup() {
        return (frag = createIf(
          () => show.value,
          () => t0(),
          undefined,
          singleRootNoScope,
        ) as DynamicFragment)
      },
    })

    const { host } = define(() =>
      createComponent(Child, { id: () => id.value }, null, true),
    ).render()

    expect(host.innerHTML).toBe('<div id="a">foo</div><!--if-->')
    expect(frag.scope).toBeUndefined()
    expect((frag as any).attrs).toBeUndefined()
    expect((frag as any).hasFallthroughAttrs).toBe(true)

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">foo</div><!--if-->')

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">foo</div><!--if-->')
    expect(frag.scope).toBeDefined()
  })

  test('should skip branch scope for compiler-proven static multi-root branch', async () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    const t1 = template('<p>bar</p>')
    let frag!: DynamicFragment

    const { host } = define(() => {
      frag = createIf(
        () => show.value,
        () => [t0(), t1()],
        undefined,
        VaporBlockShape.MULTI_ROOT | VaporIfFlags.TRUE_NO_SCOPE,
      ) as DynamicFragment
      return frag
    }).render()

    expect(host.innerHTML).toBe('<div>foo</div><p>bar</p><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')
    expect(frag.scope).toBeUndefined()
  })

  test('should replace no-scope static if and else branches', async () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    const t1 = template('<p>bar</p>')
    let frag!: DynamicFragment

    const { host } = define(() => {
      frag = createIf(
        () => show.value,
        () => t0(),
        () => t1(),
        singleRootNoScopeIfElse,
      ) as DynamicFragment
      return frag
    }).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<p>bar</p><!--if-->')
    expect(frag.scope).toBeUndefined()
  })

  test('should preserve no-scope pending branch during out-in transition', async () => {
    const show = ref(true)
    const onLeave = vi.fn((_: Element, done: () => void) => setTimeout(done, 0))
    const t0 = template('<div>foo</div>')
    const t1 = template('<p>bar</p>')
    let frag!: DynamicFragment

    const { host } = define(() =>
      createComponent(
        VaporTransition,
        { mode: () => 'out-in', onLeave: () => onLeave },
        {
          default: () =>
            (frag = createIf(
              () => show.value,
              () => t0(),
              () => t1(),
              ifFlags(singleRootNoScopeIfElse, false, 0),
            ) as DynamicFragment),
        },
        true,
      ),
    ).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = false
    await nextTick()
    expect(host.textContent).toContain('foo')
    expect(host.textContent).not.toContain('bar')
    expect(onLeave).toHaveBeenCalledTimes(1)

    await new Promise(r => setTimeout(r, 0))
    await nextTick()
    expect(host.innerHTML).toContain('bar')
    expect(host.innerHTML).not.toContain('foo')
    expect(frag.scope).toBeUndefined()
  })

  test('should skip no-scope static branch under KeepAlive', async () => {
    const show = ref(false)
    const childSetup = vi.fn()
    const t0 = template('<p>static</p>')
    const t1 = template('<div>child</div>')
    const Child = defineVaporComponent({
      name: 'Child',
      setup() {
        childSetup()
        return t1()
      },
    })
    let frag!: DynamicFragment
    const flags = ifFlags(
      singleRootIfElse | VaporIfFlags.FALSE_NO_SCOPE,
      false,
      0,
    )

    const { host } = define(() =>
      createComponent(VaporKeepAlive, null, {
        default: () =>
          (frag = createIf(
            () => show.value,
            () => createComponent(Child),
            () => t0(),
            flags,
          ) as DynamicFragment),
      }),
    ).render()

    expect(host.innerHTML).toBe('<p>static</p><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe('<div>child</div><!--if-->')
    expect(frag.scope).toBeDefined()
    expect(childSetup).toHaveBeenCalledTimes(1)
    const componentScope = frag.scope

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<p>static</p><!--if-->')
    expect(frag.scope).toBeUndefined()

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe('<div>child</div><!--if-->')
    expect(frag.scope).toBe(componentScope)
    expect(childSetup).toHaveBeenCalledTimes(1)
  })

  test('should not set branch block key without Transition or KeepAlive', async () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    const t1 = template('<div>bar</div>')
    let branch!: any

    const { host } = define(() =>
      createIf(
        () => show.value,
        () => (branch = t0()),
        () => (branch = t1()),
        ifFlags(singleRootIfElse, false, 0),
      ),
    ).render()

    expect(host.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(branch.$key).toBeUndefined()

    show.value = false
    await nextTick()

    expect(host.innerHTML).toBe('<div>bar</div><!--if-->')
    expect(branch.$key).toBeUndefined()
  })

  test('should not set branch block key outside Transition after Transition is used', async () => {
    const show = ref(true)
    const transitionChild = template('<span>transition</span>')
    const t0 = template('<div>foo</div>')
    const t1 = template('<div>bar</div>')
    let branch!: any

    const { host } = define(() => [
      createComponent(
        VaporTransition,
        null,
        {
          default: () => transitionChild(),
        },
        true,
      ),
      createIf(
        () => show.value,
        () => (branch = t0()),
        () => (branch = t1()),
        ifFlags(singleRootIfElse, false, 0),
      ),
    ]).render()

    expect(host.innerHTML).toBe(
      '<span>transition</span><div>foo</div><!--if-->',
    )
    expect(branch.$key).toBeUndefined()

    show.value = false
    await nextTick()

    expect(host.innerHTML).toBe(
      '<span>transition</span><div>bar</div><!--if-->',
    )
    expect(branch.$key).toBeUndefined()
  })

  test('should set branch block key inside Transition', () => {
    const show = ref(true)
    const t0 = template('<div>foo</div>')
    const t1 = template('<div>bar</div>')
    let branch!: any

    define(() =>
      createComponent(
        VaporTransition,
        null,
        {
          default: () =>
            createIf(
              () => show.value,
              () => (branch = t0()),
              () => (branch = t1()),
              ifFlags(singleRootIfElse, false, 0),
            ),
        },
        true,
      ),
    ).render()

    expect(branch.$key).toBe(0)
  })
})
