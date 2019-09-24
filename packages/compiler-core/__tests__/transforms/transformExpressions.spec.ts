import {
  parse,
  transform,
  ExpressionNode,
  ElementNode,
  DirectiveNode,
  NodeTypes,
  ForNode,
  CompilerOptions,
  IfNode
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
    const node = parseWithExpressionTransform(`{{ foo }}`) as ExpressionNode
    expect(node.children).toMatchObject([
      `_ctx.`,
      {
        content: `foo`,
        loc: node.loc
      }
    ])
  })

  test('interpolation (children)', () => {
    const node = parseWithExpressionTransform(
      `<div>{{ foo }}</div>`
    ) as ElementNode
    expect((node.children[0] as ExpressionNode).children).toMatchObject([
      `_ctx.`,
      {
        content: `foo`,
        loc: node.children[0].loc
      }
    ])
  })

  test('directive value', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:arg="baz"/>`
    ) as ElementNode
    expect((node.props[0] as DirectiveNode).arg!.children).toBeUndefined()
    const exp = (node.props[0] as DirectiveNode).exp!
    expect(exp.children).toMatchObject([
      `_ctx.`,
      {
        content: `baz`,
        loc: exp.loc
      }
    ])
  })

  test('dynamic directive arg', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:[arg]="baz"/>`
    ) as ElementNode
    const arg = (node.props[0] as DirectiveNode).arg!
    const exp = (node.props[0] as DirectiveNode).exp!
    expect(arg.children).toMatchObject([
      `_ctx.`,
      {
        content: `arg`,
        loc: arg.loc
      }
    ])
    expect(exp.children).toMatchObject([
      `_ctx.`,
      {
        content: `baz`,
        loc: exp.loc
      }
    ])
  })

  test('should prefix complex expressions', () => {
    const node = parseWithExpressionTransform(
      `{{ foo(baz + 1, { key: kuz }) }}`
    ) as ExpressionNode
    // should parse into compound expression
    expect(node.children).toMatchObject([
      `_ctx.`,
      {
        content: `foo`,
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
      `(_ctx.`,
      {
        content: `baz`,
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
      ` + 1, { key: _ctx.`,
      {
        content: `kuz`,
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
    ])
  })

  test('should prefix v-if condition', () => {
    const node = parseWithExpressionTransform(`<div v-if="ok"/>`) as IfNode
    expect(node.branches[0].condition!.children).toMatchObject([
      `_ctx.`,
      { content: `ok` }
    ])
  })

  test('should prefix v-for source', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="i in list"/>`
    ) as ForNode
    expect(node.source.children).toMatchObject([`_ctx.`, { content: `list` }])
  })

  test('should not prefix v-for alias', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="i in list">{{ i }}{{ j }}</div>`
    ) as ForNode
    const div = node.children[0] as ElementNode

    const i = div.children[0] as ExpressionNode
    expect(i.type).toBe(NodeTypes.EXPRESSION)
    expect(i.content).toBe(`i`)
    expect(i.children).toBeUndefined()

    const j = div.children[1] as ExpressionNode
    expect(j.type).toBe(NodeTypes.EXPRESSION)
    expect(j.children).toMatchObject([`_ctx.`, { content: `j` }])
  })

  test('should not prefix v-for aliases (multiple)', () => {
    const node = parseWithExpressionTransform(
      `<div v-for="(i, j, k) in list">{{ i + j + k }}{{ l }}</div>`
    ) as ForNode
    const div = node.children[0] as ElementNode

    const exp = div.children[0] as ExpressionNode
    expect(exp.type).toBe(NodeTypes.EXPRESSION)
    expect(exp.content).toBe(`i + j + k`)
    expect(exp.children).toBeUndefined()

    const l = div.children[1] as ExpressionNode
    expect(l.type).toBe(NodeTypes.EXPRESSION)
    expect(l.children).toMatchObject([`_ctx.`, { content: `l` }])
  })

  test('should prefix id outside of v-for', () => {
    const node = parseWithExpressionTransform(
      `<div><div v-for="i in list" />{{ i }}</div>`
    ) as ElementNode
    const exp = node.children[1] as ExpressionNode
    expect(exp.type).toBe(NodeTypes.EXPRESSION)
    expect(exp.content).toBe(`i`)
    expect(exp.children).toMatchObject([`_ctx.`, { content: `i` }])
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
      .children[0] as ExpressionNode
    expect(innerExp.type).toBe(NodeTypes.EXPRESSION)
    expect(innerExp.children).toMatchObject([`i + _ctx.`, { content: `j` }])

    // when an inner v-for shadows a variable of an outer v-for and exit,
    // it should not cause the outer v-for's alias to be removed from known ids
    const outerExp = outerDiv.children[1] as ExpressionNode
    expect(outerExp.type).toBe(NodeTypes.EXPRESSION)
    expect(outerExp.content).toBe(`i`)
    expect(outerExp.children).toBeUndefined()
  })

  test('should not prefix whitelisted globals', () => {
    const node = parseWithExpressionTransform(
      `{{ Math.max(1, 2) }}`
    ) as ExpressionNode
    expect(node.type).toBe(NodeTypes.EXPRESSION)
    expect(node.content).toBe(`Math.max(1, 2)`)
    expect(node.children).toBeUndefined()
  })

  test('should not prefix id of a function declaration', () => {
    const node = parseWithExpressionTransform(
      `{{ function foo() { return bar } }}`
    ) as ExpressionNode
    expect(node.type).toBe(NodeTypes.EXPRESSION)
    expect(node.children).toMatchObject([
      `function foo() { return _ctx.`,
      { content: `bar` },
      ` }`
    ])
  })

  test('should not prefix params of a function expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo => foo + bar }}`
    ) as ExpressionNode
    expect(node.type).toBe(NodeTypes.EXPRESSION)
    expect(node.children).toMatchObject([
      `foo => foo + _ctx.`,
      { content: `bar` }
    ])
  })

  test('should not prefix an object property key', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo: bar } }}`
    ) as ExpressionNode
    expect(node.type).toBe(NodeTypes.EXPRESSION)
    expect(node.children).toMatchObject([
      `{ foo: _ctx.`,
      { content: `bar` },
      ` }`
    ])
  })

  test('should prefix a computed object property key', () => {
    const node = parseWithExpressionTransform(
      `{{ { [foo]: bar } }}`
    ) as ExpressionNode
    expect(node.type).toBe(NodeTypes.EXPRESSION)
    expect(node.children).toMatchObject([
      `{ [_ctx.`,
      { content: `foo` },
      `]: _ctx.`,
      { content: `bar` },
      ` }`
    ])
  })

  test('should prefix object property shorthand value', () => {
    const node = parseWithExpressionTransform(`{{ { foo } }}`) as ExpressionNode
    expect(node.children).toMatchObject([
      `{ foo: _ctx.`,
      { content: `foo` },
      ` }`
    ])
  })

  test('should not prefix id in a member expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo.bar.baz }}`
    ) as ExpressionNode
    expect(node.children).toMatchObject([
      `_ctx.`,
      { content: `foo` },
      `.bar.baz`
    ])
  })

  test('should prefix computed id in a member expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo[bar][baz] }}`
    ) as ExpressionNode
    expect(node.children).toMatchObject([
      `_ctx.`,
      { content: `foo` },
      `[_ctx.`,
      { content: `bar` },
      `][_ctx.`,
      { content: 'baz' },
      `]`
    ])
  })

  test('should handle parse error', () => {
    const onError = jest.fn()
    parseWithExpressionTransform(`{{ a( }}`, { onError })
    expect(onError.mock.calls[0][0].message).toMatch(`Expected ')'`)
  })
})
