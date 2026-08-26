import { h } from 'vue'
import {
  VaporFragment,
  createComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src'
import { makeRender } from '../_utils'
import { setInteropEnabled } from '../../src/vdomInteropState'

const define = makeRender()

describe('helpers: setBlockKey', () => {
  test('sets key on node', () => {
    const el = template(`<div></div>`)() as any
    setBlockKey(el, 'foo')
    expect(el.$key).toBe('foo')

    setBlockKey(el, 'bar')
    expect(el.$key).toBe('bar')
  })

  test('does not override an existing key when overwrite is false', () => {
    const el = template(`<div></div>`)() as any
    setBlockKey(el, 'inner')
    setBlockKey(el, 'outer', false)
    expect(el.$key).toBe('inner')
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
    setInteropEnabled()
    const frag = new VaporFragment(template(`<div></div>`)() as any)
    frag.vnode = h('div', { key: 'old' })
    // interop fragments install the key-sync protocol (createInteropFragment)
    frag.setKey = function (key) {
      if (this.vnode) this.vnode.key = key
    }

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
