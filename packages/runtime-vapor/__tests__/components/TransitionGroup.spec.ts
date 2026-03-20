import {
  VaporTransitionGroup,
  createComponent,
  createIf,
  defineVaporComponent,
  setBlockKey,
  template,
  withVaporCtx,
} from '../../src'
import { makeRender } from '../_utils'

const define = makeRender()

describe('TransitionGroup', () => {
  test('inherits outer component key for a single transition child', () => {
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

    expect(child.block.$key).toBe('foo')
    expect(child.block.$transition).toBeDefined()
  })

  test('inherits outer fragment key for a single transition child', () => {
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

    expect(frag.nodes.$key).toBe('foo')
    expect(frag.nodes.$transition).toBeDefined()
  })

  test('does not duplicate outer key across multiple transition children', () => {
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

    expect(child.block[0].$key).toBeUndefined()
    expect(child.block[1].$key).toBeUndefined()
    expect(child.block[0].$transition).toBeUndefined()
    expect(child.block[1].$transition).toBeUndefined()
    if (__DEV__) {
      expect(`<transition-group> children must be keyed`).toHaveBeenWarnedTimes(
        2,
      )
    }
  })
})
