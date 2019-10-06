import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes
} from '@vue/compiler-core'
import { mockWarn } from '@vue/runtime-test'
import { transformText } from '../../src/transforms/vText'

function transformWithTextTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformText],
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: text transform', () => {
  mockWarn()

  it('should add `textContent` prop', () => {
    const { node } = transformWithTextTransform(`<div v-text="test"/>`)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `textContent`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      }
    })
  })

  it('should replace all children', () => {
    const { node } = transformWithTextTransform(
      `<div v-text="test"><p>foo</p><p>bar</p></div>`
    )
    expect(node.children).toHaveLength(0)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `textContent`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      }
    })

    expect(`"v-text" replaced children on "div" element`).toHaveBeenWarned()
  })
})
