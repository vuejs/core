import { ref, setRef, template } from '../../src'
import { makeRender } from '../_utils'

const define = makeRender()

describe('api: template ref', () => {
  test('string ref mount', () => {
    const t0 = template('<div ref="refKey"></div>')
    const el = ref(null)
    const { render } = define({
      setup() {
        return {
          refKey: el,
        }
      },
      render() {
        const n0 = t0()
        setRef(n0 as Element, 'refKey')
        return n0
      },
    })

    const { host } = render()
    expect(el.value).toBe(host.children[0])
  })
})
