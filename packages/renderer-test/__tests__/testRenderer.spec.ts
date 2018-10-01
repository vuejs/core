import {
  h,
  render,
  Component,
  nodeOps,
  NodeTypes,
  TestElement,
  TestText
} from '../src'

describe('test renderer', () => {
  it('should work', () => {
    class App extends Component {
      render() {
        return h(
          'div',
          {
            id: 'test'
          },
          'hello'
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(root.children.length).toBe(1)

    const el = root.children[0] as TestElement
    expect(el.type).toBe(NodeTypes.ELEMENT)
    expect(el.props.id).toBe('test')
    expect(el.children.length).toBe(1)

    const text = el.children[0] as TestText
    expect(text.type).toBe(NodeTypes.TEXT)
    expect(text.text).toBe('hello')
  })

  it('should record ops', () => {
    // TODO
  })
})
