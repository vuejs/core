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

  test('sets key on the component only, never on its rendered block', () => {
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
    expect(child.block.$key).toBeUndefined()
    expect((host.children[0] as any).$key).toBeUndefined()
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
    expect((frag.nodes as any).$key).toBeUndefined()
  })
})
