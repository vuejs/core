import { createApp, defineComponent, h } from '../src'
import { nodeOps } from '../src/nodeOps'

describe('createApp for dom', () => {
  // #5571 the same component into the same container
  test('mount', () => {
    const Comp = defineComponent({
      props: {
        count: {
          default: 'Comp'
        }
      },
      setup(props) {
        return () => props.count
      }
    })

    const root1 = nodeOps.createElement('div')
    createApp(Comp).mount(root1)
    expect(root1.textContent).toBe(`Comp`)
    createApp(Comp).mount(root1)
    expect(`Please do not mount two identical apps on the same node.`).toHaveBeenWarned()
    expect(root1.textContent).toBe(`Comp`)
  })
  // #2926
  test('mount to SVG container', () => {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    createApp({
      render() {
        return h('g')
      }
    }).mount(root)
    expect(root.children.length).toBe(1)
    expect(root.children[0] instanceof SVGElement).toBe(true)
  })
})
