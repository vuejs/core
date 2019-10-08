import {
  parse,
  transform,
  CompilerOptions,
  ElementNode
} from '@vue/compiler-core'
import { transformShow } from '../../src/transforms/vShow'
import { transformStyle } from '../../src/transforms/transformStyle'

function parseWithShowTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [transformStyle],
    directiveTransforms: {
      show: transformShow
    },
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: `v-show` transform', () => {
  it('should add style', () => {
    const { node } = parseWithShowTransform(`<div v-show="true"/>`)
    expect(node).toMatchSnapshot()
  })

  it('should append to style', () => {
    const { node } = parseWithShowTransform(
      `<div style="display:flex" v-show="true"/>`
    )
    expect(node).toMatchSnapshot()
  })
})
