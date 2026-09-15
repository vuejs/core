import {
  VaporTransitionGroup,
  createComponent,
  createFor,
  createIf,
  defineVaporAsyncComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src'
import { defineComponent, h, nextTick, ref } from '@vue/runtime-dom'
import { getTransitionKey } from '../../src/components/Transition'
import { compile, makeInteropRender, makeRender } from '../_utils'

const define = makeRender()
const defineInterop = makeInteropRender()
const timeout = (n = 0) => new Promise(r => setTimeout(r, n))

describe('TransitionGroup', () => {
  test('uses the component key for a single transition child', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return createComponent(VaporTransitionGroup, null, {
          default: () => child,
        })
      },
    }).render()

    expect(getTransitionKey(child.block)).toBe('foo')
    // the resolved key never touches the block's own key
    expect(child.block.$key).toBeUndefined()
    expect(child.block.$transition).toBeDefined()
  })

  test('defaults an unkeyed single transition child to the fragment key', () => {
    let frag: any
    define({
      setup() {
        frag = createIf(
          () => true,
          () => template(`<div>child</div>`)() as any,
        )
        setBlockKey(frag, 'foo')
        return createComponent(VaporTransitionGroup, null, {
          default: () => frag,
        })
      },
    }).render()

    expect(getTransitionKey(frag.nodes)).toBe('foo')
    expect(frag.nodes.$transition).toBeDefined()
  })

  test('derives unique keys from outer key across multiple transition children', () => {
    const Child = defineVaporComponent({
      setup() {
        return [
          template(`<div>a</div>`)() as any,
          template(`<div>b</div>`)() as any,
        ]
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return createComponent(VaporTransitionGroup, null, {
          default: () => child,
        })
      },
    }).render()

    expect(getTransitionKey(child.block[0])).toBe('foo0')
    expect(getTransitionKey(child.block[1])).toBe('foo1')
    expect(child.block[0].$transition).toBeDefined()
    expect(child.block[1].$transition).toBeDefined()
  })

  test('prefixes child keys with outer key across multiple transition children', () => {
    const Child = defineVaporComponent({
      setup() {
        const a = template(`<div>a</div>`)() as any
        const b = template(`<div>b</div>`)() as any
        a.$key = 'a'
        b.$key = 'b'
        return [a, b]
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return createComponent(VaporTransitionGroup, null, {
          default: () => child,
        })
      },
    }).render()

    expect(getTransitionKey(child.block[0])).toBe('fooa')
    expect(getTransitionKey(child.block[1])).toBe('foob')
    expect(child.block[0].$transition).toBeDefined()
    expect(child.block[1].$transition).toBeDefined()
  })

  test('preserves outer key when unresolved async child resolves', async () => {
    let resolve!: (comp: any) => void
    const ResolvedChild = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })
    const AsyncChild = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    let child: any
    define({
      setup() {
        child = createComponent(AsyncChild)
        setBlockKey(child, 'foo')
        return createComponent(VaporTransitionGroup, null, {
          default: () => child,
        })
      },
    }).render()

    expect(child.$key).toBe('foo')

    resolve(ResolvedChild)
    await timeout()
    await nextTick()
    await nextTick()

    expect(getTransitionKey(child.block.nodes.block)).toBe('foo')
    expect(child.block.nodes.block.$transition).toBeDefined()
  })

  test('inherits v-for item key when applying transition hooks to new items', async () => {
    const items = ref([1])
    let list: any

    define({
      setup() {
        list = createFor(
          () => items.value,
          item => template(`<div></div>`)(),
          item => item,
        )
        return createComponent(VaporTransitionGroup, null, {
          default: () => list,
        })
      },
    }).render()

    items.value = [1, 2]
    await nextTick()

    expect(getTransitionKey(list.nodes[0][1].nodes)).toBe(2)
    expect(list.nodes[0][1].nodes.$transition).toBeDefined()
  })

  test('preserves unique keys for multi-root v-for items', () => {
    const items = ref([1])
    let list: any

    define({
      setup() {
        list = createFor(
          () => items.value,
          () => [template(`<div></div>`)(), template(`<span></span>`)()],
          item => item,
        )
        return createComponent(VaporTransitionGroup, null, {
          default: () => list,
        })
      },
    }).render()

    const nodes = list.nodes[0][0].nodes

    expect(getTransitionKey(nodes[0])).toBe('1:0')
    expect(getTransitionKey(nodes[1])).toBe('1:1')
    expect(nodes[0].$transition).toBeDefined()
    expect(nodes[1].$transition).toBeDefined()
  })

  test('rows landing at the tail go after leaving rows (vdom order)', async () => {
    // leave is held open so removed rows stay in the DOM as ghosts
    const data = ref<any>({
      items: ['a', 'b', 'c'],
      onLeave: (_el: Element, _done: () => void) => {},
    })
    const App = compile(
      `<template>
        <TransitionGroup tag="div" :css="false" @leave="data.onLeave">
          <div v-for="i in data.items" :key="i">{{ i }}</div>
        </TransitionGroup>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    const text = () => host.querySelector('div')!.textContent

    // remove the tail row and append a new one
    data.value.items = ['a', 'b', 'd']
    await nextTick()
    expect(text()).toBe('abcd')

    // move an existing row to the tail past the leaving one
    data.value.items = ['b', 'd', 'a']
    await nextTick()
    expect(text()).toBe('bcda')
  })

  // vdom re-renders the group (and measures) when the slot's own reads change,
  // which for a component child means its props; child-local state does not
  test('measures on component prop changes but not on child-local state', async () => {
    const data = ref({ items: [{ id: 1, opened: false }] })
    const Item = compile(
      `<script vapor>
        import { ref } from 'vue'
        const data = _data
        const props = defineProps({ opened: Boolean })
        const local = ref(0)
        window.__bumpLocal = () => local.value++
      </script>
      <template><div :class="{ opened: props.opened, odd: local % 2 }">item</div></template>`,
      data,
    )
    const App = compile(
      `<template>
        <TransitionGroup tag="div">
          <components.Item v-for="i in data.items" :key="i.id" :opened="i.opened" />
        </TransitionGroup>
      </template>`,
      data,
      { Item },
    )
    define(App as any).render()
    await nextTick()
    const measure = vi.spyOn(Element.prototype, 'getBoundingClientRect')

    data.value.items[0].opened = true
    await nextTick()
    expect(measure).toHaveBeenCalledTimes(1)

    ;(window as any).__bumpLocal()
    await nextTick()
    expect(measure).toHaveBeenCalledTimes(1)

    // the prop tracking dies with the row
    const removed = data.value.items[0]
    data.value.items = []
    await nextTick()
    measure.mockClear()
    removed.opened = false
    await nextTick()
    expect(measure).not.toHaveBeenCalled()

    measure.mockRestore()
    delete (window as any).__bumpLocal
  })

  test('keys rows of an unkeyed <template v-for> by the child key', async () => {
    const onBeforeEnter = vi.fn()
    const data = ref<any>({ show: false, list: [0, 1], onBeforeEnter })
    const App = compile(
      `<template>
        <TransitionGroup tag="ul" @before-enter="data.onBeforeEnter">
          <template v-for="value in data.list">
            <li v-if="data.show" :key="value">{{ value }}</li>
          </template>
        </TransitionGroup>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    data.value.show = true
    await nextTick()
    expect(onBeforeEnter).toHaveBeenCalledTimes(2)
    const rowKeys = () =>
      Array.from(host.querySelectorAll('li'), li => getTransitionKey(li))
    expect(rowKeys()).toEqual([0, 1])

    data.value.list.push(2)
    await nextTick()
    expect(onBeforeEnter).toHaveBeenCalledTimes(3)
    expect(rowKeys()).toEqual([0, 1, 2])
  })

  test('keeps the wrapper key and resolved type when an async child resolves', async () => {
    let resolve!: (comp: any) => void
    const Child = compile(
      `<template><div class="async">async</div></template>`,
      ref(),
    )
    const AsyncChild = defineVaporAsyncComponent(
      () => new Promise(r => (resolve = r as any)),
    )
    const leaves: (() => void)[] = []
    const data = ref<any>({
      show: true,
      onLeave: (_el: Element, done: () => void) => leaves.push(done),
    })
    const App = compile(
      `<script setup vapor>
        const data = _data
        const AsyncChild = _components.AsyncChild
      </script>
      <template>
        <TransitionGroup :css="false" @leave="data.onLeave">
          <AsyncChild v-if="data.show" key="outer" />
          <span key="fixed">fixed</span>
        </TransitionGroup>
      </template>`,
      data,
      { AsyncChild },
    )
    const { host } = define(App as any).render()

    resolve(Child)
    await timeout()
    await nextTick()
    expect(getTransitionKey(host.querySelector('.async') as any)).toBe('outer')

    data.value.show = false
    await nextTick()
    data.value.show = true
    await nextTick()
    // "outer" re-enters while the first one is still leaving: same key and
    // type, so the leaving child is early-removed
    expect(host.querySelectorAll('.async').length).toBe(1)
    leaves.forEach(done => done())
  })

  test('keyed reorder does not run enter hooks on relocated rows', async () => {
    const onBeforeEnter = vi.fn()
    const data = ref<any>({ items: ['a', 'b', 'c'], onBeforeEnter })
    const App = compile(
      `<template>
        <TransitionGroup tag="div" :css="false" @before-enter="data.onBeforeEnter">
          <div v-for="i in data.items" :key="i">{{ i }}</div>
        </TransitionGroup>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    await nextTick()

    data.value.items = ['c', 'a', 'b']
    await nextTick()
    expect(host.querySelector('div')!.textContent).toBe('cab')
    expect(onBeforeEnter).not.toHaveBeenCalled()

    // a new row still enters
    data.value.items = ['c', 'a', 'b', 'd']
    await nextTick()
    expect(onBeforeEnter).toHaveBeenCalledOnce()
  })

  test('skips group hook and owner bookkeeping on ForBlock wrappers', () => {
    const items = ref([1, 2])
    let list: any

    define({
      setup() {
        list = createFor(
          () => items.value,
          item => {
            const el = template(`<div></div>`)()
            el.textContent = String(item.value)
            return el
          },
          item => item,
        )
        return createComponent(VaporTransitionGroup, null, {
          default: () => list,
        })
      },
    }).render()

    const forBlock = list.nodes[0][0]
    // the wrapper itself has no transition consumers: it overrides neither
    // insert nor remove (the only fragment $transition readers) and its
    // update hook arrays are never invoked
    expect(forBlock.$transition).toBeUndefined()
    expect(forBlock.bu).toBeUndefined()
    expect(forBlock.u).toBeUndefined()
    // while its element child carries the group hooks and the derived key
    expect(forBlock.nodes.$transition).toBeDefined()
    expect(getTransitionKey(forBlock.nodes)).toBe(1)
  })

  test('mounted children should react to transition prop changes', async () => {
    const data = ref({ name: 'a', items: [1, 2, 3] })
    const App = compile(
      `<template>
        <TransitionGroup :name="data.name">
          <div v-for="item in data.items" :key="item">{{ item }}</div>
        </TransitionGroup>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    const el = host.querySelectorAll('div')[2]

    // change the transition name reactively without touching the list
    data.value.name = 'b'
    await nextTick()

    // removing an already-mounted item must leave with the updated name
    data.value.items = [1, 2]
    await nextTick()
    expect(el.className).toBe('b-leave-from b-leave-active')
  })

  test('re-adding a leaving keyed component item early-removes the previous instance', async () => {
    let leaveDone: (() => void) | undefined
    const Comp = compile(
      `<template><div class="item">item</div></template>`,
      ref({}),
    )
    const data = ref<any>({
      list: [0],
      onLeave: (_: Element, done: () => void) => {
        leaveDone = done
      },
    })
    const App = compile(
      `<template>
        <TransitionGroup @leave="data.onLeave">
          <components.Comp v-for="i in data.list" :key="i" />
        </TransitionGroup>
      </template>`,
      data,
      { Comp },
    )
    const { host } = define(App as any).render()
    expect(host.querySelectorAll('.item').length).toBe(1)

    // remove the item -> @leave is held open by the captured done callback
    data.value.list = []
    await nextTick()
    expect(host.querySelectorAll('.item').length).toBe(1)

    // re-add the same key while the previous instance is still leaving. The
    // component child must bucket the leaving cache by component type in both
    // the leaving (group) path and the re-entering (v-for single) path so
    // earlyRemove matches and force-removes the previous instance instead of
    // leaving two elements in the DOM.
    data.value.list = [0]
    await nextTick()
    expect(host.querySelectorAll('.item').length).toBe(1)

    leaveDone && leaveDone()
    await nextTick()
    expect(host.querySelectorAll('.item').length).toBe(1)
  })

  test('preserves vdom slot children', async () => {
    const items = ref(['a', 'b'])
    const Child = compile(
      `<template>
        <TransitionGroup>
          <slot />
        </TransitionGroup>
      </template>`,
      ref({}),
    )
    const App = defineComponent({
      setup() {
        return () =>
          h(Child, null, {
            default: () =>
              items.value.map(item => h('div', { key: item }, item)),
          })
      },
    })
    const { host } = defineInterop(App).render()

    expect(
      Array.from(host.querySelectorAll('div'), el => el.textContent),
    ).toEqual(['a', 'b'])

    items.value = ['b', 'c']
    await nextTick()

    expect(
      Array.from(host.querySelectorAll('div'), el => el.textContent),
    ).toEqual(['b', 'c'])
  })

  test('registers full transition hooks when Transition is used later', async () => {
    const group = define({
      setup() {
        return createComponent(VaporTransitionGroup)
      },
    }).render()
    group.app.unmount()

    let leaveDone: (() => void) | undefined
    const data = ref({
      show: true,
      onLeave: (_: Element, done: () => void) => {
        leaveDone = done
      },
    })
    const App = compile(
      `<template>
        <Transition mode="out-in" :css="false" @leave="data.onLeave">
          <div v-if="data.show" key="a">A</div>
          <div v-else key="b">B</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    data.value.show = false
    await nextTick()

    expect(host.textContent).toContain('A')
    expect(host.textContent).not.toContain('B')

    leaveDone!()
    await nextTick()

    expect(host.textContent).not.toContain('A')
    expect(host.textContent).toContain('B')
  })
  test('reads tag once instead of re-mounting the children on tag change', async () => {
    const onBeforeEnter = vi.fn()
    const data = ref<any>({ tag: 'ul', items: ['a', 'b'], onBeforeEnter })
    const App = compile(
      `<template>
        <TransitionGroup :tag="data.tag" :css="false" @before-enter="data.onBeforeEnter">
          <li v-for="i in data.items" :key="i">{{ i }}</li>
        </TransitionGroup>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    const container = host.firstChild as Element
    const rows = Array.from(container.children)
    expect(container.tagName).toBe('UL')

    data.value.tag = 'ol'
    await nextTick()
    expect(host.firstChild).toBe(container)
    expect(Array.from(container.children)).toEqual(rows)
    expect(onBeforeEnter).not.toHaveBeenCalled()
  })

  test('renders a static default slot without a fragment anchor', () => {
    const data = ref({ items: ['a'] })
    const withTag = compile(
      `<template>
        <TransitionGroup tag="ul">
          <li v-for="i in data.items" :key="i">{{ i }}</li>
        </TransitionGroup>
      </template>`,
      data,
    )
    expect(define(withTag as any).render().host.innerHTML).toBe(
      '<ul><li>a</li><!--for--></ul>',
    )
  })

  test('renders a static default slot without tag as the bare children', () => {
    const data = ref({ items: ['a'] })
    const withoutTag = compile(
      `<template>
        <TransitionGroup>
          <li v-for="i in data.items" :key="i">{{ i }}</li>
        </TransitionGroup>
      </template>`,
      data,
    )
    expect(define(withoutTag as any).render().host.innerHTML).toBe(
      '<li>a</li><!--for-->',
    )
  })

  // coverage guard: conditional default slots keep the dynamic path
  test('re-renders a conditional default slot inside the wrapper element', async () => {
    const data = ref({ show: false, items: ['a'] })
    const App = compile(
      `<template>
        <TransitionGroup tag="ul" :css="false">
          <template v-if="data.show" #default>
            <li v-for="i in data.items" :key="i">{{ i }}</li>
          </template>
        </TransitionGroup>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    expect(host.querySelector('ul')!.innerHTML).toBe('')

    data.value.show = true
    await nextTick()
    expect(host.querySelector('ul')!.innerHTML).toBe('<li>a</li><!--for-->')

    data.value.show = false
    await nextTick()
    expect(host.querySelector('ul')!.innerHTML).toBe('')
  })
})
