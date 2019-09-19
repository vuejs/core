import { parse } from '../src/parse'
import { transform, Transform } from '../src/transform'
import { ElementNode, NodeTypes } from '../src/ast'
import { ErrorCodes, createCompilerError } from '../src/errors'

describe('compiler: transform', () => {
  test('context state', () => {
    const ast = parse(`<div>hello {{ world }}</div>`)

    // manually store call arguments because context is mutable and shared
    // across calls
    const calls: any[] = []
    const plugin: Transform = (node, context) => {
      calls.push([node, Object.assign({}, context)])
    }

    transform(ast, {
      transforms: [plugin]
    })

    const div = ast.children[0] as ElementNode
    expect(calls.length).toBe(3)
    expect(calls[0]).toMatchObject([
      div,
      {
        parent: ast,
        ancestors: [ast],
        childIndex: 0
      }
    ])
    expect(calls[1]).toMatchObject([
      div.children[0],
      {
        parent: div,
        ancestors: [ast, div],
        childIndex: 0
      }
    ])
    expect(calls[2]).toMatchObject([
      div.children[1],
      {
        parent: div,
        ancestors: [ast, div],
        childIndex: 1
      }
    ])
  })

  test('context.replaceNode', () => {
    const ast = parse(`<div/><span/>`)
    const plugin: Transform = (node, context) => {
      if (node.type === NodeTypes.ELEMENT && node.tag === 'div') {
        // change the node to <p>
        context.replaceNode(
          Object.assign({}, node, {
            tag: 'p',
            children: [
              {
                type: NodeTypes.TEXT,
                content: 'hello',
                isEmpty: false
              }
            ]
          })
        )
      }
    }
    const spy = jest.fn(plugin)
    transform(ast, {
      transforms: [spy]
    })

    expect(ast.children.length).toBe(2)
    const newElement = ast.children[0] as ElementNode
    expect(newElement.tag).toBe('p')
    expect(spy).toHaveBeenCalledTimes(3)
    // should traverse the children of replaced node
    expect(spy.mock.calls[1][0]).toBe(newElement.children[0])
    // should traverse the node after the replaced node
    expect(spy.mock.calls[2][0]).toBe(ast.children[1])
  })

  test('context.removeNode', () => {
    const ast = parse(`<span/><div/><span/>`)
    const c1 = ast.children[0]
    const c2 = ast.children[2]

    const plugin: Transform = (node, context) => {
      if (node.type === NodeTypes.ELEMENT && node.tag === 'div') {
        context.removeNode()
      }
    }
    const spy = jest.fn(plugin)
    transform(ast, {
      transforms: [spy]
    })

    expect(ast.children.length).toBe(2)
    expect(ast.children[0]).toBe(c1)
    expect(ast.children[1]).toBe(c2)

    expect(spy).toHaveBeenCalledTimes(3)
    // should traverse nodes around removed
    expect(spy.mock.calls[0][0]).toBe(c1)
    expect(spy.mock.calls[2][0]).toBe(c2)
  })

  test('onError option', () => {
    const ast = parse(`<div/>`)
    const loc = ast.children[0].loc.start
    const plugin: Transform = (node, context) => {
      context.onError(
        createCompilerError(ErrorCodes.X_INVALID_END_TAG, node.loc.start)
      )
    }
    const spy = jest.fn()
    transform(ast, {
      transforms: [plugin],
      onError: spy
    })
    expect(spy.mock.calls[0]).toMatchObject([
      {
        code: ErrorCodes.X_INVALID_END_TAG,
        loc
      }
    ])
  })
})
