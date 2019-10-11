import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  ObjectExpression,
  CallExpression,
  NodeTypes
} from '@vue/compiler-core'
import { transformOn } from '../../src/transforms/vOn'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { transformExpression } from '../../../compiler-core/src/transforms/transformExpression'

function parseWithVOn(
  template: string,
  options: CompilerOptions = {}
): ElementNode {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformExpression, transformElement],
    directiveTransforms: {
      on: transformOn
    },
    ...options
  })
  return ast.children[0] as ElementNode
}

describe('compiler-dom: transform v-on', () => {
  it('should support .stop modifier', () => {
    const node = parseWithVOn(`<div @click.stop="test"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0].value).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `$event => {`,
        `$event.stopPropagation();`,
        '(',
        {
          content: '_ctx.test',
          isStatic: false,
          type: NodeTypes.SIMPLE_EXPRESSION,
          loc: expect.anything()
        },
        ')',
        '($event)',
        '}'
      ]
    })
  })

  it('should support muliple modifiers, and ignore unknown modifier', () => {
    const node = parseWithVOn(`<div @click.stop.prevent.gibberish="test"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0].value).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `$event => {`,
        `$event.stopPropagation();`,
        `$event.preventDefault();`,
        '', // ignored modifier "gibberish"
        '(',
        {
          content: '_ctx.test',
          isStatic: false,
          type: NodeTypes.SIMPLE_EXPRESSION,
          loc: expect.anything()
        },
        ')',
        '($event)',
        '}'
      ]
    })
  })
})
