import { createApp, h } from '../src'

describe('createApp for dom', () => {
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

  // #4398
  test('should not mutate original root component options object', () => {
    
    const originalObj =  {
      data() {
        return {
          counter: 0
        }
      }
    }

    const handler = jest.fn(msg => {
      expect(msg).toMatch(`Component is missing template or render function`)
    })

    const Root = { ...originalObj}
    
    const app = createApp(Root)
    app.config.warnHandler = handler
    app.mount(document.createElement('div')) 
    expect(originalObj).toMatchObject(Root) // ensure no additional properties are added to Root
  })
})
