import {
  VaporKeepAlive,
  child,
  createComponent,
  createDynamicComponent,
  createFor,
  createIf,
  createKeyedFragment,
  createSlot,
  next,
  renderEffect,
  setInsertionState,
  setText,
  template,
  txt,
} from '../src'
import { nextTick, ref, shallowRef } from '@vue/runtime-dom'
import { makeRender } from './_utils'
import { defineVaporComponent } from '../src/apiDefineComponent'
import { isAdoptedAnchor } from '../src/fragment'
import {
  insertionAnchor,
  insertionIndex,
  insertionParent,
  resetInsertionState,
} from '../src/insertionState'
import {
  locateChildByLogicalIndex,
  updateLastLocatedLogicalChild,
} from '../src/dom/node'
import { toDisplayString } from '@vue/shared'

const define = makeRender()

// CSR anchor adoption: dynamic blocks anchored via a template `<!>`
// placeholder reuse it as their fragment anchor instead of creating and
// inserting a runtime anchor. Each shape asserts the exact child list so an
// extra runtime anchor (or a dropped insertion) fails loudly.
describe('anchor adoption', () => {
  test('v-if in the middle adopts the placeholder', async () => {
    const show = ref(true)
    const { host } = define(() => {
      const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
      const anchor = next(child(n))
      setInsertionState(n, anchor)
      createIf(
        () => show.value,
        () => template('<span>yes</span>')(),
        () => template('<span>no</span>')(),
      )
      return n
    }).render()

    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>yes</span><!--if--><p></p></div>',
    )
    // adopted: exactly h1, branch, comment, p — no extra runtime anchor
    expect(host.firstChild!.childNodes.length).toBe(4)

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>no</span><!--if--><p></p></div>',
    )
  })

  test('prepended v-if adopts the placeholder', async () => {
    const show = ref(true)
    const { host } = define(() => {
      const n = template('<div><!><p></p></div>', 1)() as any
      setInsertionState(n, child(n))
      createIf(
        () => show.value,
        () => template('<span>yes</span>')(),
      )
      return n
    }).render()

    expect(host.innerHTML).toBe('<div><span>yes</span><!--if--><p></p></div>')

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<div><!--if--><p></p></div>')
    expect(host.firstChild!.childNodes.length).toBe(2)
  })

  test('empty v-if branch mounts as the adopted placeholder alone', async () => {
    const show = ref(false)
    const { host } = define(() => {
      const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
      const anchor = next(child(n))
      setInsertionState(n, anchor)
      createIf(
        () => show.value,
        () => template('<span>yes</span>')(),
      )
      return n
    }).render()

    expect(host.innerHTML).toBe('<div><h1></h1><!--if--><p></p></div>')
    expect(host.firstChild!.childNodes.length).toBe(3)

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>yes</span><!--if--><p></p></div>',
    )
  })

  test('v-for in the middle adopts the placeholder', async () => {
    const list = ref(['a', 'b'])
    const { host } = define(() => {
      const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
      const anchor = next(child(n))
      setInsertionState(n, anchor)
      createFor(
        () => list.value,
        item => {
          const el = template('<span> </span>')() as any
          const x = txt(el) as any
          renderEffect(() => setText(x, toDisplayString(item.value)))
          return el
        },
        undefined,
        8 /* IS_SINGLE_NODE */,
      )
      return n
    }).render()

    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>a</span><span>b</span><!--for--><p></p></div>',
    )

    list.value = [...list.value, 'c']
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>a</span><span>b</span><span>c</span><!--for--><p></p></div>',
    )

    list.value = []
    await nextTick()
    expect(host.innerHTML).toBe('<div><h1></h1><!--for--><p></p></div>')
    expect(host.firstChild!.childNodes.length).toBe(3)
  })

  test('dynamic component in the middle adopts the placeholder', async () => {
    const view = shallowRef('one')
    const views: Record<string, any> = {
      one: defineVaporComponent({
        setup: () => template('<span>one</span>')(),
      }),
      two: defineVaporComponent({
        setup: () => template('<span>two</span>')(),
      }),
    }
    const { host } = define(() => {
      const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
      const anchor = next(child(n))
      setInsertionState(n, anchor)
      createDynamicComponent(() => views[view.value])
      return n
    }).render()

    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>one</span><!--dynamic-component--><p></p></div>',
    )
    expect(host.firstChild!.childNodes.length).toBe(4)

    view.value = 'two'
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>two</span><!--dynamic-component--><p></p></div>',
    )
  })

  test('keyed fragment in the middle adopts the placeholder', async () => {
    const key = ref(1)
    const { host } = define(() => {
      const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
      const anchor = next(child(n))
      setInsertionState(n, anchor)
      createKeyedFragment(
        () => key.value,
        () => {
          const el = template('<span> </span>')() as any
          const x = txt(el) as any
          renderEffect(() => setText(x, toDisplayString(key.value)))
          return el
        },
      )
      return n
    }).render()

    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>1</span><!--keyed--><p></p></div>',
    )

    key.value = 2
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>2</span><!--keyed--><p></p></div>',
    )
    expect(host.firstChild!.childNodes.length).toBe(4)
  })

  test('anchored slot outlet adopts the placeholder', () => {
    const Child = defineVaporComponent({
      setup() {
        const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
        const anchor = next(child(n))
        setInsertionState(n, anchor)
        createSlot('default', null)
        return n
      },
    })
    const { host } = define(() => {
      return createComponent(Child, null, {
        default: () => template('<span>content</span>')(),
      })
    }).render()

    expect(host.innerHTML).toBe(
      '<div><h1></h1><span>content</span><!--slot--><p></p></div>',
    )
    expect(host.firstChild!.childNodes.length).toBe(4)
  })

  test('append slot outlet does not adopt and still inserts', () => {
    // regression: append inserts capture no anchor; treating
    // undefined === undefined as adoption skipped the only insertion
    const Child = defineVaporComponent({
      setup() {
        const n = template('<div></div>', 1)() as any
        setInsertionState(n)
        createSlot('default', null)
        return n
      },
    })
    const { host } = define(() => {
      return createComponent(Child, null, {
        default: () => template('<span>content</span>')(),
      })
    }).render()

    expect(host.innerHTML).toBe('<div><span>content</span><!--slot--></div>')
  })

  test('KeepAlive moves adopted anchors with the cached tree', async () => {
    const view = shallowRef('one')
    const show = ref(true)
    const mkView = (label: string) =>
      defineVaporComponent({
        setup() {
          const n = template('<div><h1></h1><!><p></p></div>', 1)() as any
          const anchor = next(child(n))
          setInsertionState(n, anchor)
          createIf(
            () => show.value,
            () => template(`<span>${label}</span>`)(),
          )
          return n
        },
      })
    const views: Record<string, any> = {
      one: mkView('one'),
      two: mkView('two'),
    }

    const { host } = define(() => {
      return createComponent(VaporKeepAlive, null, {
        default: () => createDynamicComponent(() => views[view.value]) as any,
      })
    }).render()

    const mounted = '<div><h1></h1><span>one</span><!--if--><p></p></div>'
    expect(host.innerHTML).toBe(`${mounted}<!--dynamic-component-->`)

    // deactivate + reactivate: the adopted anchor must travel with the
    // cached tree and nothing may be inserted twice
    view.value = 'two'
    await nextTick()
    view.value = 'one'
    await nextTick()
    expect(host.innerHTML).toBe(`${mounted}<!--dynamic-component-->`)

    show.value = false
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><h1></h1><!--if--><p></p></div><!--dynamic-component-->',
    )
  })
})

describe('setInsertionState decode', () => {
  afterEach(resetInsertionState)

  test('node anchor', () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('')
    setInsertionState(parent, anchor)
    expect(insertionParent).toBe(parent)
    expect(insertionAnchor).toBe(anchor)
    expect(insertionIndex).toBeUndefined()
  })

  test('append unit index', () => {
    const parent = document.createElement('div')
    setInsertionState(parent, 3)
    expect(insertionParent).toBe(parent)
    expect(insertionAnchor).toBeUndefined()
    expect(insertionIndex).toBe(3)
  })

  test('absent anchor (append at 0)', () => {
    const parent = document.createElement('div')
    setInsertionState(parent)
    expect(insertionParent).toBe(parent)
    expect(insertionAnchor).toBeUndefined()
    expect(insertionIndex).toBeUndefined()
  })

  test('reset clears all state', () => {
    const parent = document.createElement('div')
    setInsertionState(parent, document.createComment(''))
    resetInsertionState()
    expect(insertionParent).toBeUndefined()
    expect(insertionAnchor).toBeUndefined()
    expect(insertionIndex).toBeUndefined()
  })
})

describe('isAdoptedAnchor', () => {
  test('requires a real insertion anchor', () => {
    const anchor = document.createComment('')
    expect(isAdoptedAnchor(anchor, anchor)).toBe(true)
    expect(isAdoptedAnchor(document.createComment(''), anchor)).toBe(false)
    // append inserts / interop fragments / hydration: both sides can be
    // undefined and must not read as adoption
    expect(isAdoptedAnchor(undefined, undefined)).toBe(false)
    expect(isAdoptedAnchor(anchor, undefined)).toBe(false)
    expect(isAdoptedAnchor(undefined, anchor)).toBe(false)
  })
})

describe('$llc / $idx cache invariants', () => {
  test('locateChildByLogicalIndex stamps and reuses the cache', () => {
    const parent = document.createElement('div') as any
    for (const tag of ['a', 'b', 'i']) {
      parent.appendChild(document.createElement(tag))
    }
    const first = locateChildByLogicalIndex(parent, 0)! as any
    expect(first.tagName).toBe('A')
    expect(first.$idx).toBe(0)
    expect(parent.$llc).toBe(first)

    const third = locateChildByLogicalIndex(parent, 2)! as any
    expect(third.tagName).toBe('I')
    expect(third.$idx).toBe(2)
    expect(parent.$llc).toBe(third)

    // backward target restarts from firstChild instead of trusting the cache
    const second = locateChildByLogicalIndex(parent, 1)! as any
    expect(second.tagName).toBe('B')
    expect(parent.$llc).toBe(second)
  })

  test('updateLastLocatedLogicalChild only transfers a current cache entry', () => {
    const parent = document.createElement('div') as any
    const a = document.createElement('a') as any
    const b = document.createElement('b') as any
    parent.append(a, b)

    locateChildByLogicalIndex(parent, 0)
    // cached entry transfers with the index offset applied
    updateLastLocatedLogicalChild(parent, a, b, 1)
    expect(parent.$llc).toBe(b)
    expect(b.$idx).toBe(1)

    // a stale `from` (not the cached entry) must leave the cache untouched:
    // installing an unindexed node would alias it to unit 0
    const c = document.createElement('i') as any
    updateLastLocatedLogicalChild(parent, a, c, 1)
    expect(parent.$llc).toBe(b)
    expect(c.$idx).toBeUndefined()
  })
})
