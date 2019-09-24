import { parse } from '../src/parse'
import { transform, NodeTransform } from '../src/transform'
import { ElementNode, NodeTypes } from '../src/ast'
import { ErrorCodes, createCompilerError } from '../src/errors'
import { TO_STRING, CREATE_VNODE, COMMENT } from '../src/runtimeConstants'

describe('compiler: transform', () => {
  test('context state', () => {
    const ast = parse(`<div>hello {{ world }}</div>`)

    // manually store call arguments because context is mutable and shared
    // across calls
    const calls: any[] = []
    const plugin: NodeTransform = (node, context) => {
      calls.push([node, Object.assign({}, context)])
    }

    transform(ast, {
      nodeTransforms: [plugin]
    })

    const div = ast.children[0] as ElementNode
    expect(calls.length).toBe(3)
    expect(calls[0]).toMatchObject([
      div,
      {
        parent: ast,
        currentNode: div
      }
    ])
    expect(calls[1]).toMatchObject([
      div.children[0],
      {
        parent: div,
        currentNode: div.children[0]
      }
    ])
    expect(calls[2]).toMatchObject([
      div.children[1],
      {
        parent: div,
        currentNode: div.children[1]
      }
    ])
  })

  test('context.replaceNode', () => {
    const ast = parse(`<div/><span/>`)
    const plugin: NodeTransform = (node, context) => {
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
      nodeTransforms: [spy]
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
    const ast = parse(`<span/><div>hello</div><span/>`)
    const c1 = ast.children[0]
    const c2 = ast.children[2]

    const plugin: NodeTransform = (node, context) => {
      if (node.type === NodeTypes.ELEMENT && node.tag === 'div') {
        context.removeNode()
      }
    }
    const spy = jest.fn(plugin)
    transform(ast, {
      nodeTransforms: [spy]
    })

    expect(ast.children.length).toBe(2)
    expect(ast.children[0]).toBe(c1)
    expect(ast.children[1]).toBe(c2)

    // should not traverse children of remove node
    expect(spy).toHaveBeenCalledTimes(3)
    // should traverse nodes around removed
    expect(spy.mock.calls[0][0]).toBe(c1)
    expect(spy.mock.calls[2][0]).toBe(c2)
  })

  test('context.removeNode (prev sibling)', () => {
    const ast = parse(`<span/><div/><span/>`)
    const c1 = ast.children[0]
    const c2 = ast.children[2]

    const plugin: NodeTransform = (node, context) => {
      if (node.type === NodeTypes.ELEMENT && node.tag === 'div') {
        context.removeNode()
        // remove previous sibling
        context.removeNode(context.parent.children[0])
      }
    }
    const spy = jest.fn(plugin)
    transform(ast, {
      nodeTransforms: [spy]
    })

    expect(ast.children.length).toBe(1)
    expect(ast.children[0]).toBe(c2)

    expect(spy).toHaveBeenCalledTimes(3)
    // should still traverse first span before removal
    expect(spy.mock.calls[0][0]).toBe(c1)
    // should still traverse last span
    expect(spy.mock.calls[2][0]).toBe(c2)
  })

  test('context.removeNode (next sibling)', () => {
    const ast = parse(`<span/><div/><span/>`)
    const c1 = ast.children[0]
    const d1 = ast.children[1]

    const plugin: NodeTransform = (node, context) => {
      if (node.type === NodeTypes.ELEMENT && node.tag === 'div') {
        context.removeNode()
        // remove next sibling
        context.removeNode(context.parent.children[1])
      }
    }
    const spy = jest.fn(plugin)
    transform(ast, {
      nodeTransforms: [spy]
    })

    expect(ast.children.length).toBe(1)
    expect(ast.children[0]).toBe(c1)

    expect(spy).toHaveBeenCalledTimes(2)
    // should still traverse first span before removal
    expect(spy.mock.calls[0][0]).toBe(c1)
    // should not traverse last span
    expect(spy.mock.calls[1][0]).toBe(d1)
  })

  test('onError option', () => {
    const ast = parse(`<div/>`)
    const loc = ast.children[0].loc
    const plugin: NodeTransform = (node, context) => {
      context.onError(
        createCompilerError(ErrorCodes.X_INVALID_END_TAG, node.loc)
      )
    }
    const spy = jest.fn()
    transform(ast, {
      nodeTransforms: [plugin],
      onError: spy
    })
    expect(spy.mock.calls[0]).toMatchObject([
      {
        code: ErrorCodes.X_INVALID_END_TAG,
        loc
      }
    ])
  })

  test('should inject toString helper for interpolations', () => {
    const ast = parse(`{{ foo }}`)
    transform(ast, {})
    expect(ast.imports).toContain(TO_STRING)
  })

  test('should inject createVNode and Comment for comments', () => {
    const ast = parse(`<!--foo-->`)
    transform(ast, {})
    expect(ast.imports).toContain(CREATE_VNODE)
    expect(ast.imports).toContain(COMMENT)
  })
})
