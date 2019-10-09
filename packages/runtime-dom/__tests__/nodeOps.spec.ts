import { nodeOps } from '../src/nodeOps'

describe('nodeOps', () => {
  it('insert', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')

    nodeOps.insert(child, parent)

    expect(parent.children[0]).toBe(child)
  })

  it('remove', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')
    parent.appendChild(child)

    nodeOps.remove(child)

    expect(parent.children).toHaveLength(0)
  })

  it('createElement', () => {
    expect(nodeOps.createElement('rect', true).namespaceURI).toBe(
      'http://www.w3.org/2000/svg'
    )
    expect(nodeOps.createElement('div').namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml'
    )
  })

  it('createText', () => {
    const text = nodeOps.createText('test')
    expect(text).toBeInstanceOf(Text)
    expect(text.textContent).toBe('test')
  })

  it('createComment', () => {
    const comment = nodeOps.createComment('test')
    expect(comment).toBeInstanceOf(Comment)
    expect(comment.textContent).toBe('test')
  })

  it('setText', () => {
    const text = nodeOps.createText('test')
    nodeOps.setText(text, 'Vue')

    expect(text.textContent).toBe('Vue')
  })

  it('setElementText', () => {
    const el = document.createElement('div')
    nodeOps.setElementText(el, 'Vue')

    expect(el.textContent).toBe('Vue')
  })

  it('parentNode', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')
    parent.appendChild(child)

    expect(nodeOps.parentNode(child)).toBe(parent)
  })

  it('nextSibling', () => {
    const parent = document.createElement('div')
    const child1 = document.createElement('div')
    const child2 = document.createElement('div')
    parent.appendChild(child1)
    parent.appendChild(child2)

    expect(nodeOps.nextSibling(child1)).toBe(child2)
  })

  it('querySelector', () => {
    expect(nodeOps.querySelector('html')).toBe(document.documentElement)
    expect(nodeOps.querySelector('body')).toBe(document.body)
  })
})
