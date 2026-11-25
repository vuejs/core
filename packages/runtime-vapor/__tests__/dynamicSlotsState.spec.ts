import {
  createComponent,
  createSlot,
  createTextNode,
  defineVaporComponent,
  enableDynamicSlots,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender()

// hand-written `$` slots: the compiler enables them for compiled templates
describe('dynamic slots state', () => {
  const Child = defineVaporComponent({
    render: () => createSlot('foo'),
  })
  const render = () =>
    define({
      render: () =>
        createComponent(Child, null, {
          $: [() => ({ name: 'foo', fn: () => createTextNode('foo') })],
        }),
    }).render()

  test('ignores dynamic slots until enabled', () => {
    const { html } = render()
    expect(html()).toBe('<!--slot-->')
    expect('Dynamic slots ($) are ignored').toHaveBeenWarned()
  })

  test('renders dynamic slots once enabled', () => {
    enableDynamicSlots()
    const { html } = render()
    expect(html()).toBe('foo<!--slot-->')
  })
})
