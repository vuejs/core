import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes
} from '@vue/compiler-core'
import { mockWarn } from '@vue/runtime-test'
import { transformHtml } from '../../src/transforms/vHtml'

function transformWithHtmlTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformHtml],
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: html transform', () => {
  mockWarn()
  it('should add `innerHtml` prop', () => {
    const { node } = transformWithHtmlTransform(`<div v-html="test"/>`)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `innerHTML`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      }
    })
  })

  it('should remove all children', () => {
    const { node } = transformWithHtmlTransform(
      `<div v-html="test"><p>foo</p><p>bar</p></div>`
    )
    expect(node.children).toHaveLength(0)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `innerHTML`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      }
    })
    expect(`"v-html" replaced children on "div" element`).toHaveBeenWarned()
  })
})
