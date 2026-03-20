import {
  VaporTransitionGroup,
  createComponent,
  createIf,
  defineVaporAsyncComponent,
  defineVaporComponent,
  setBlockKey,
  template,
  withVaporCtx,
} from '../../src'
import { nextTick } from '@vue/runtime-dom'
import { makeRender } from '../_utils'

const define = makeRender()
const timeout = (n = 0) => new Promise(r => setTimeout(r, n))

describe('TransitionGroup', () => {
  test('prefixes outer component key for a single transition child', () => {
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
        child.block.$key = undefined
        return createComponent(VaporTransitionGroup, null, {
          default: withVaporCtx(() => child),
        })
      },
    }).render()

    expect(child.block.$key).toBe('foo0')
    expect(child.block.$transition).toBeDefined()
  })

  test('prefixes outer fragment key for a single transition child', () => {
    let frag: any
    define({
      setup() {
        frag = createIf(
          () => true,
          () => template(`<div>child</div>`)() as any,
        )
        setBlockKey(frag, 'foo')
        frag.nodes.$key = undefined
        return createComponent(VaporTransitionGroup, null, {
          default: withVaporCtx(() => frag),
        })
      },
    }).render()

    expect(frag.nodes.$key).toBe('foo0')
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
        child.block[0].$key = undefined
        child.block[1].$key = undefined
        return createComponent(VaporTransitionGroup, null, {
          default: withVaporCtx(() => child),
        })
      },
    }).render()

    expect(child.block[0].$key).toBe('foo0')
    expect(child.block[1].$key).toBe('foo1')
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
          default: withVaporCtx(() => child),
        })
      },
    }).render()

    expect(child.block[0].$key).toBe('fooa')
    expect(child.block[1].$key).toBe('foob')
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
          default: withVaporCtx(() => child),
        })
      },
    }).render()

    expect(child.$key).toBe('foo')
    expect(child.block.$key).toBe('foo')

    resolve(ResolvedChild)
    await timeout()
    await nextTick()
    await nextTick()

    expect(child.block.nodes.$key).toBe('foo')
    expect(child.block.nodes.block.$key).toBe('foo')
    expect(child.block.nodes.block.$transition).toBeDefined()
  })
})
