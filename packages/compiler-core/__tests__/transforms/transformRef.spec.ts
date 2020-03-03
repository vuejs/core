import { baseParse as parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformRef } from '../../src/transforms/transformRef'
import { ElementNode, NodeTypes } from '../../src/ast'

function transformWithRef(template: string) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformRef]
  })
  return ast.children[0] as ElementNode
}

describe('compiler: transform ref', () => {
  const getExpected = (key: any) => ({
    type: NodeTypes.DIRECTIVE,
    name: 'bind',
    arg: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `ref`
    },
    exp: {
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [`[_ctx, `, key, `]`]
    }
  })

  test('static', () => {
    const node = transformWithRef(`<div ref="test"/>`)
    expect(node.props[0]).toMatchObject(
      getExpected({
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: true
      })
    )
  })

  test('dynamic', () => {
    const node = transformWithRef(`<div :ref="test"/>`)
    expect(node.props[0]).toMatchObject(
      getExpected({
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      })
    )
  })
})
