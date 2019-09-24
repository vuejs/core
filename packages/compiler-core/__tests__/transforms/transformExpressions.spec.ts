import {
  parse,
  transform,
  ExpressionNode,
  ElementNode,
  DirectiveNode
} from '../../src'
import { transformFor } from '../..//src/transforms/vFor'
import { transformExpression } from '../../src/transforms/transformExpression'

function parseWithExpressionTransform(template: string) {
  const ast = parse(template)
  transform(ast, {
    prefixIdentifiers: true,
    nodeTransforms: [transformFor, transformExpression]
  })
  return ast.children[0]
}

describe('compiler: expression transform', () => {
  test('interpolation (root)', () => {
    const node = parseWithExpressionTransform(`{{ foo }}`) as ExpressionNode
    expect(node.content).toBe(`_ctx.foo`)
  })

  test('interpolation (children)', () => {
    const node = parseWithExpressionTransform(
      `<div>{{ foo }}</div>`
    ) as ElementNode
    expect((node.children[0] as ExpressionNode).content).toBe(`_ctx.foo`)
  })

  test('directive value', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:arg="baz"/>`
    ) as ElementNode
    expect((node.props[0] as DirectiveNode).arg!.content).toBe(`arg`)
    expect((node.props[0] as DirectiveNode).exp!.content).toBe(`_ctx.baz`)
  })

  test('dynamic directive arg', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:[arg]="baz"/>`
    ) as ElementNode
    expect((node.props[0] as DirectiveNode).arg!.content).toBe(`_ctx.arg`)
    expect((node.props[0] as DirectiveNode).exp!.content).toBe(`_ctx.baz`)
  })

  test('should prefix complex expressions', () => {
    const node = parseWithExpressionTransform(
      `{{ foo(baz + 1, { key: kuz }) }}`
    ) as ExpressionNode
    // should parse into compound expression
    expect(node.children).toMatchObject([
      { content: `_ctx.foo` },
      `(`,
      { content: `_ctx.baz` },
      ` + 1, { key: `,
      { content: `_ctx.kuz` },
      ` })`
    ])
  })

  // TODO FIXME
  test('should not prefix v-for aliases', () => {
    // const node = parseWithExpressionTransform(`{{ { foo } }}`) as ExpressionNode
    // expect(node.children).toMatchObject([
    //   `{ foo: `,
    //   { content: `_ctx.foo` },
    //   ` }`
    // ])
  })

  test('should prefix id outside of v-for', () => {})

  test('nested v-for', () => {})

  test('should not prefix whitelisted globals', () => {})

  test('should not prefix id of a function declaration', () => {})

  test('should not prefix params of a function expression', () => {
    // also test object + array destructure
  })

  test('should not prefix an object property key', () => {})

  test('should prefix a computed object property key', () => {})

  test('should prefix object property shorthand value', () => {})

  test('should not prefix id in a member expression', () => {})
})
