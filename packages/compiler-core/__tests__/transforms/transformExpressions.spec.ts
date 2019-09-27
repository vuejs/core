import {
  parse,
  transform,
  ElementNode,
  DirectiveNode,
  NodeTypes,
  ForNode,
  CompilerOptions,
  IfNode,
  InterpolationNode
} from '../../src'
import { transformIf } from '../../src/transforms/vIf'
import { transformFor } from '../../src/transforms/vFor'
import { transformExpression } from '../../src/transforms/transformExpression'

function parseWithExpressionTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template)
  transform(ast, {
    prefixIdentifiers: true,
    nodeTransforms: [transformIf, transformFor, transformExpression],
    ...options
  })
  return ast.children[0]
}

describe('compiler: expression transform', () => {
  test('interpolation (root)', () => {
    const node = parseWithExpressionTransform(`{{ foo }}`) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.foo`
    })
  })

  test('interpolation (children)', () => {
    const el = parseWithExpressionTransform(
      `<div>{{ foo }}</div>`
    ) as ElementNode
    const node = el.children[0] as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.foo`
    })
  })

  test('interpolation (complex)', () => {
    const el = parseWithExpressionTransform(
      `<div>{{ foo + bar(baz.qux) }}</div>`
    ) as ElementNode
    const node = el.children[0] as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.foo` },
        ` + `,
        { content: `_ctx.bar` },
        `(`,
        { content: `_ctx.baz` },
        `.`,
        { content: `qux` },
        `)`
      ]
    })
  })

  test('directive value', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:arg="baz"/>`
    ) as ElementNode
    const arg = (node.props[0] as DirectiveNode).arg!
    expect(arg).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `arg`
    })
    const exp = (node.props[0] as DirectiveNode).exp!
    expect(exp).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.baz`
    })
  })

  test('dynamic directive arg', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:[arg]="baz"/>`
    ) as ElementNode
    const arg = (node.props[0] as DirectiveNode).arg!
    expect(arg).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.arg`
    })
    const exp = (node.props[0] as DirectiveNode).exp!
    expect(exp).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.baz`
    })
  })

  test('should prefix complex expressions', () => {
    const node = parseWithExpressionTransform(
      `{{ foo(baz + 1, { key: kuz }) }}`
    ) as InterpolationNode
    // should parse into compound expression
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        {
          content: `_ctx.foo`,
          loc: {
            source: `foo`,
            start: {
              offset: 3,
              line: 1,
              column: 4
            },
            end: {
              offset: 6,
              line: 1,
              column: 7
            }
          }
        },
        `(`,
        {
          content: `_ctx.baz`,
          loc: {
            source: `baz`,
            start: {
              offset: 7,
              line: 1,
              column: 8
            },
            end: {
              offset: 10,
              line: 1,
              column: 11
            }
          }
        },
        ` + 1, { key: `,
        {
          content: `_ctx.kuz`,
          loc: {
            source: `kuz`,
            start: {
              offset: 23,
              line: 1,
              column: 24
            },
            end: {
              offset: 26,
              line: 1,
              column: 27
            }
          }
        },
        ` })`
      ]
    })
  })

  test('should prefix v-if condition', () => {
    const node = parseWithExpressionTransform(`<div v-if="ok"/>`) as IfNode
    expect(node.branches[0].condition).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.ok`
    })
  })

  test('should prefix v-for source', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="i in list"/>`
    ) as ForNode
    expect(node.source).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.list`
    })
  })

  test('should prefix v-for source w/ complex expression', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="i in list.concat([foo])"/>`
    ) as ForNode
    expect(node.source).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.list` },
        `.`,
        { content: `concat` },
        `([`,
        { content: `_ctx.foo` },
        `])`
      ]
    })
  })

  test('should not prefix v-for alias', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="i in list">{{ i }}{{ j }}</div>`
    ) as ForNode
    const div = node.children[0] as ElementNode
    expect((div.children[0] as InterpolationNode).content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `i`
    })
    expect((div.children[1] as InterpolationNode).content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.j`
    })
  })

  test('should not prefix v-for aliases (multiple)', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="(i, j, k) in list">{{ i + j + k }}{{ l }}</div>`
    ) as ForNode
    const div = node.children[0] as ElementNode
    expect((div.children[0] as InterpolationNode).content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `i` },
        ` + `,
        { content: `j` },
        ` + `,
        { content: `k` }
      ]
    })
    expect((div.children[1] as InterpolationNode).content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.l`
    })
  })

  test('should prefix id outside of v-for', () => {
    const node = parseWithExpressionTransform(
      `<div><div v-for="i in list" />{{ i }}</div>`
    ) as ElementNode
    expect((node.children[1] as InterpolationNode).content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.i`
    })
  })

  test('nested v-for', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="i in list">
        <div v-for="i in list">{{ i + j }}</div>{{ i }}
      </div>`
    ) as ForNode
    const outerDiv = node.children[0] as ElementNode
    const innerFor = outerDiv.children[0] as ForNode
    const innerExp = (innerFor.children[0] as ElementNode)
      .children[0] as InterpolationNode
    expect(innerExp.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [{ content: 'i' }, ` + `, { content: `_ctx.j` }]
    })

    // when an inner v-for shadows a variable of an outer v-for and exit,
    // it should not cause the outer v-for's alias to be removed from known ids
    const outerExp = outerDiv.children[1] as InterpolationNode
    expect(outerExp.content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `i`
    })
  })

  test('should not prefix whitelisted globals', () => {
    const node = parseWithExpressionTransform(
      `{{ Math.max(1, 2) }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [{ content: `Math` }, `.`, { content: `max` }, `(1, 2)`]
    })
  })

  test('should not prefix id of a function declaration', () => {
    const node = parseWithExpressionTransform(
      `{{ function foo() { return bar } }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `function `,
        { content: `foo` },
        `() { return `,
        { content: `_ctx.bar` },
        ` }`
      ]
    })
  })

  test('should not prefix params of a function expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo => foo + bar }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `foo` },
        ` => `,
        { content: `foo` },
        ` + `,
        { content: `_ctx.bar` }
      ]
    })
  })

  test('should not prefix an object property key', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo: bar } }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [`{ foo: `, { content: `_ctx.bar` }, ` }`]
    })
  })

  test('should prefix a computed object property key', () => {
    const node = parseWithExpressionTransform(
      `{{ { [foo]: bar } }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `{ [`,
        { content: `_ctx.foo` },
        `]: `,
        { content: `_ctx.bar` },
        ` }`
      ]
    })
  })

  test('should prefix object property shorthand value', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo } }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [`{ foo: `, { content: `_ctx.foo` }, ` }`]
    })
  })

  test('should not prefix id in a member expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo.bar.baz }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.foo` },
        `.`,
        { content: `bar` },
        `.`,
        { content: `baz` }
      ]
    })
  })

  test('should prefix computed id in a member expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo[bar][baz] }}`
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.foo` },
        `[`,
        { content: `_ctx.bar` },
        `][`,
        { content: '_ctx.baz' },
        `]`
      ]
    })
  })

  test('should handle parse error', () => {
    const onError = jest.fn()
    parseWithExpressionTransform(`{{ a( }}`, { onError })
    expect(onError.mock.calls[0][0].message).toMatch(`Expected ')'`)
  })
})
