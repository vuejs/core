import { Fragment, h, render } from '../src'

// #15468 — `Node.normalize()` merges adjacent text nodes and removes empty
// text nodes. Fragment boundary anchors used to be empty text nodes, so
// calling `normalize()` on an ancestor detached them while the vnodes kept
// referencing them, causing subsequent patches to fail (e.g. reading
// `nextSibling` of null). Fragment anchors are comment nodes, which
// `normalize()` leaves untouched, so updates keep working.
describe('fragment anchors survive Node.normalize()', () => {
  const renderFrag = (root: HTMLElement, extra?: boolean) =>
    render(
      h(Fragment, [
        h('b', 'First'),
        h('b', 'Second'),
        ...(extra ? [h('b', 'Third')] : []),
      ]),
      root,
    )

  test('fragment should unmount and re-mount correctly after normalize()', () => {
    const root = document.createElement('div')
    renderFrag(root)
    root.normalize()

    // toggling the branch used to throw
    // "Cannot read properties of null (reading 'nextSibling')"
    render(h('div', 'Replacement'), root)
    expect(root.innerHTML).toBe('<div>Replacement</div>')

    // and should also re-mount cleanly when toggled back
    renderFrag(root)
    expect(root.innerHTML).toBe('<!----><b>First</b><b>Second</b><!---->')
  })

  test('fragment should update its children correctly after normalize()', () => {
    const root = document.createElement('div')
    renderFrag(root)
    root.normalize()

    renderFrag(root, true)
    expect(root.innerHTML).toBe(
      '<!----><b>First</b><b>Second</b><b>Third</b><!---->',
    )
  })

  test('fragment anchors should be comment nodes', () => {
    const root = document.createElement('div')
    renderFrag(root)
    expect(root.firstChild!.nodeType).toBe(Node.COMMENT_NODE)
    expect(root.lastChild!.nodeType).toBe(Node.COMMENT_NODE)
  })
})
