import {
  CompilerOptions,
  parse,
  transform,
  NodeTypes,
  generate
} from '../../src'
import { optimizeText } from '../../src/transforms/optimizeText'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformElement } from '../../src/transforms/transformElement'

function transformWithTextOpt(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      optimizeText,
      transformElement
    ],
    ...options
  })
  return ast
}

describe('compiler: optimize interpolation', () => {
  test('no consecutive text', () => {
    const root = transformWithTextOpt(`{{ foo }}`)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.INTERPOLATION,
      content: {
        content: `foo`
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('consecutive text', () => {
    const root = transformWithTextOpt(`{{ foo }} bar {{ baz }}`)
    expect(root.children.length).toBe(1)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
      ]
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('consecutive text between elements', () => {
    const root = transformWithTextOpt(`<div/>{{ foo }} bar {{ baz }}<div/>`)
    expect(root.children.length).toBe(3)
    expect(root.children[0].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[1]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
      ]
    })
    expect(root.children[2].type).toBe(NodeTypes.ELEMENT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('consecutive text mixed with elements', () => {
    const root = transformWithTextOpt(
      `<div/>{{ foo }} bar {{ baz }}<div/>{{ foo }} bar {{ baz }}<div/>`
    )
    expect(root.children.length).toBe(5)
    expect(root.children[0].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[1]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
      ]
    })
    expect(root.children[2].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[3]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
      ]
    })
    expect(root.children[4].type).toBe(NodeTypes.ELEMENT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('with prefixIdentifiers: true', () => {
    const root = transformWithTextOpt(`{{ foo }} bar {{ baz + qux }}`, {
      prefixIdentifiers: true
    })
    expect(root.children.length).toBe(1)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `_ctx.foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        {
          type: NodeTypes.INTERPOLATION,
          content: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [{ content: `_ctx.baz` }, ` + `, { content: `_ctx.qux` }]
          }
        }
      ]
    })
    expect(
      generate(root, {
        prefixIdentifiers: true
      }).code
    ).toMatchSnapshot()
  })
})
