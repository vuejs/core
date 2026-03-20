import {
  createComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src'
import { resolveTransitionBlock } from '../../src/components/Transition'
import { makeRender } from '../_utils'

const define = makeRender()

describe('Transition', () => {
  test('prefers explicit component key over uid when resolving child', () => {
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
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe('foo')
  })

  test('falls back to component uid when explicit key is absent', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe(child.uid)
  })

  test('preserves falsy explicit component key when resolving child', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 0)
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe(0)
  })
})
