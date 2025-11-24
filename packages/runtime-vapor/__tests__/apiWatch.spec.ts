import {
  type EffectScope,
  ReactiveEffect,
  currentInstance,
  effectScope,
  nextTick,
  onMounted,
  onUpdated,
  ref,
  watch,
  watchEffect,
} from '@vue/runtime-dom'
import {
  createComponent,
  createIf,
  createTemplateRefSetter,
  defineVaporComponent,
  renderEffect,
  template,
} from '../src'
import { makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'
import type { RefEl } from '../src/apiTemplateRef'

const define = makeRender()

// only need to port test cases related to in-component usage
describe('apiWatch', () => {
  // #7030
  it(// need if support
  'should not fire on child component unmount w/ flush: pre', async () => {
    const visible = ref(true)
    const cb = vi.fn()
    const Parent = defineVaporComponent({
      props: ['visible'],
      setup() {
        return createIf(
          () => visible.value,
          () => createComponent(Comp),
        )
      },
    })
    const Comp = {
      setup() {
        watch(visible, cb, { flush: 'pre' })
        return []
      },
    }
    define(Parent).render({
      visible: () => visible.value,
    })
    expect(cb).not.toHaveBeenCalled()
    visible.value = false
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  // #7030
  it('flush: pre watcher in child component should not fire before parent update', async () => {
    const b = ref(0)
    const calls: string[] = []

    const Comp = {
      setup() {
        watch(
          () => b.value,
          val => {
            calls.push('watcher child')
          },
          { flush: 'pre' },
        )
        renderEffect(() => {
          b.value
          calls.push('render child')
        })
        return []
      },
    }

    const Parent = {
      props: ['a'],
      setup() {
        watch(
          () => b.value,
          val => {
            calls.push('watcher parent')
          },
          { flush: 'pre' },
        )
        renderEffect(() => {
          b.value
          calls.push('render parent')
        })

        return createComponent(Comp)
      },
    }

    define(Parent).render({
      a: () => b.value,
    })

    expect(calls).toEqual(['render parent', 'render child'])

    b.value++
    await nextTick()
    expect(calls).toEqual([
      'render parent',
      'render child',
      'watcher parent',
      'render parent',
      'watcher child',
      'render child',
    ])
  })

  // #1763
  it('flush: pre watcher watching props should fire before child update', async () => {
    const a = ref(0)
    const b = ref(0)
    const c = ref(0)
    const calls: string[] = []

    const Comp = {
      props: ['a', 'b'],
      setup(props: any) {
        watch(
          () => props.a + props.b,
          () => {
            calls.push('watcher 1')
            c.value++
          },
          { flush: 'pre' },
        )

        // #1777 chained pre-watcher
        watch(
          c,
          () => {
            calls.push('watcher 2')
          },
          { flush: 'pre' },
        )
        renderEffect(() => {
          c.value
          calls.push('render')
        })
        return []
      },
    }

    define(Comp).render({
      a: () => a.value,
      b: () => b.value,
    })

    expect(calls).toEqual(['render'])

    // both props are updated
    // should trigger pre-flush watcher first and only once
    // then trigger child render
    a.value++
    b.value++
    await nextTick()
    expect(calls).toEqual(['render', 'watcher 1', 'watcher 2', 'render'])
  })

  // #5721
  it('flush: pre triggered in component setup should be buffered and called before mounted', () => {
    const count = ref(0)
    const calls: string[] = []
    const App = {
      setup() {
        watch(
          count,
          () => {
            calls.push('watch ' + count.value)
          },
          { flush: 'pre' },
        )
        onMounted(() => {
          calls.push('mounted')
        })
        // mutate multiple times
        count.value++
        count.value++
        count.value++
        return []
      },
    }
    define(App).render()
    expect(calls).toMatchObject(['watch 3', 'mounted'])
  })

  // #1852
  it('flush: post watcher should fire after template refs updated', async () => {
    const toggle = ref(false)
    let dom: Element | null = null

    const App = {
      setup() {
        const domRef = ref<Element | null>(null)

        watch(
          toggle,
          () => {
            dom = domRef.value
          },
          { flush: 'post' },
        )

        const setRef = createTemplateRefSetter()
        return createIf(
          () => toggle.value,
          () => {
            const n = template('<p>')()
            setRef(n as RefEl, domRef)
            return n
          },
        )
      },
    }

    define(App).render()
    expect(dom).toBe(null)

    toggle.value = true
    await nextTick()
    expect(dom!.tagName).toBe('P')
  })

  test('should not leak `this.proxy` to setup()', () => {
    const source = vi.fn()

    const Comp = defineVaporComponent({
      setup() {
        watch(source, () => {})
        return []
      },
    })

    define(Comp).render()

    // should not have any arguments
    expect(source.mock.calls[0]).toMatchObject([])
  })

  // #2728
  test('pre watcher callbacks should not track dependencies', async () => {
    const a = ref(0)
    const b = ref(0)
    const updated = vi.fn()

    const Comp = defineVaporComponent({
      props: ['a'],
      setup(props) {
        onUpdated(updated)
        watch(
          () => props.a,
          () => {
            b.value
          },
        )
        renderEffect(() => {
          props.a
        })
        return []
      },
    })

    define(Comp).render({
      a: () => a.value,
    })

    a.value++
    await nextTick()
    expect(updated).toHaveBeenCalledTimes(1)

    b.value++
    await nextTick()
    // should not track b as dependency of Child
    expect(updated).toHaveBeenCalledTimes(1)
  })

  // #4158
  test('watch should not register in owner component if created inside detached scope', () => {
    let instance: VaporComponentInstance
    const Comp = {
      setup() {
        instance = currentInstance as VaporComponentInstance
        effectScope(true).run(() => {
          watch(
            () => 1,
            () => {},
          )
        })
        return []
      },
    }
    define(Comp).render()
    // should not record watcher in detached scope
    // the 1 is the props validation effect
    expect(getEffectsCount(instance!.scope)).toBe(1)
  })

  test('watchEffect should keep running if created in a detached scope', async () => {
    const trigger = ref(0)
    let countWE = 0
    let countW = 0
    const Comp = {
      setup() {
        effectScope(true).run(() => {
          watchEffect(() => {
            trigger.value
            countWE++
          })
          watch(trigger, () => countW++)
        })
        return []
      },
    }
    const { app } = define(Comp).render()
    // only watchEffect as ran so far
    expect(countWE).toBe(1)
    expect(countW).toBe(0)
    trigger.value++
    await nextTick()
    // both watchers run while component is mounted
    expect(countWE).toBe(2)
    expect(countW).toBe(1)

    app.unmount()
    await nextTick()
    trigger.value++
    await nextTick()
    // both watchers run again event though component has been unmounted
    expect(countWE).toBe(3)
    expect(countW).toBe(2)
  })
})

function getEffectsCount(scope: EffectScope): number {
  let n = 0
  for (let dep = scope.deps; dep !== undefined; dep = dep.nextDep) {
    if (dep.dep instanceof ReactiveEffect) {
      n++
    }
  }
  return n
}
