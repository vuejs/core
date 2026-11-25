import {
  createComponent,
  createSlot,
  createTextNode,
  defineVaporComponent,
  enableDynamicSlotProps,
  enableDynamicSlots,
  renderEffect,
  setText,
} from '../src'
import { nextTick, ref } from '@vue/runtime-dom'
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

describe('dynamic slot props state', () => {
  const renderWithProps = (rawProps: Record<string, any>) => {
    let slotProps: any
    const Child = defineVaporComponent({
      render: () => createSlot('default', rawProps),
    })
    const result = define({
      render: () =>
        createComponent(Child, null, {
          default: (props: any) => {
            slotProps = props
            const n = createTextNode()
            renderEffect(() => setText(n, props.title))
            return n
          },
        }),
    }).render()
    return { ...result, getSlotProps: () => slotProps }
  }

  test('static slot props without dynamic slot props', async () => {
    const title = ref('a')
    const { html, getSlotProps } = renderWithProps({
      title: () => title.value,
      foo: 'bar',
    })
    const props = getSlotProps()
    expect(html()).toBe('a<!--slot-->')
    expect('title' in props).toBe(true)
    expect('missing' in props).toBe(false)
    expect(Object.keys(props)).toEqual(['title', 'foo'])
    expect({ ...props }).toEqual({ title: 'a', foo: 'bar' })
    expect(props.hasOwnProperty('foo')).toBe(true)
    title.value = 'b'
    await nextTick()
    expect(html()).toBe('b<!--slot-->')
    expect({ ...props }).toEqual({ title: 'b', foo: 'bar' })
  })

  test('ignores dynamic slot props until enabled', () => {
    const { html } = renderWithProps({ $: [() => ({ title: 'a' })] })
    expect(html()).toBe('<!--slot-->')
    expect('Dynamic slot props ($) are ignored').toHaveBeenWarned()
  })

  test('renders dynamic slot props once enabled', () => {
    enableDynamicSlotProps()
    const { html } = renderWithProps({ $: [() => ({ title: 'a' })] })
    expect(html()).toBe('a<!--slot-->')
  })
})
