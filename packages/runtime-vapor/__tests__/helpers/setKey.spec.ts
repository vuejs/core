import { h } from 'vue'
import {
  VaporFragment,
  createComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src'
import { makeRender } from '../_utils'

const define = makeRender()

describe('helpers: setBlockKey', () => {
  test('sets key on node', () => {
    const el = template(`<div></div>`)() as any
    setBlockKey(el, 'foo')
    expect(el.$key).toBe('foo')
  })

  test('sets key on component and rendered block', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    const { host } = define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return child
      },
    }).render()

    expect(child.$key).toBe('foo')
    expect(child.block.$key).toBe('foo')
    expect((host.children[0] as any).$key).toBe('foo')
  })

  test('syncs interop fragment vnode.key', () => {
    const frag = new VaporFragment(template(`<div></div>`)() as any)
    frag.vnode = h('div', { key: 'old' })

    setBlockKey(frag, 'foo')

    expect(frag.$key).toBe('foo')
    expect(frag.vnode!.key).toBe('foo')
    expect((frag.nodes as any).$key).toBe('foo')
  })

  test('does not duplicate key across multiple root blocks', () => {
    const blocks = [
      template(`<div>a</div>`)() as any,
      template(`<div>b</div>`)() as any,
    ]

    setBlockKey(blocks, 'foo')

    expect(blocks[0].$key).toBeUndefined()
    expect(blocks[1].$key).toBeUndefined()
  })
})
