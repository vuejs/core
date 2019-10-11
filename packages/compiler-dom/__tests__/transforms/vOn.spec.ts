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
import { V_ON_MODIFIERS_GUARD } from '../../src/runtimeHelpers'
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
  it('should support muliple modifiers w/ prefixIdentifiers: true', () => {
    const node = parseWithVOn(`<div @click.stop.prevent="test"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_MODIFIERS_GUARD,
        arguments: [{ content: '_ctx.test' }, '["stop","prevent"]']
      }
    })
  })
})
