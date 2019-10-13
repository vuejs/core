import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  ObjectExpression,
  CallExpression,
  NodeTypes,
  Property
} from '@vue/compiler-core'
import { transformOn } from '../../src/transforms/vOn'
import { V_ON_MODIFIERS_GUARD } from '../../src/runtimeHelpers'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { transformExpression } from '../../../compiler-core/src/transforms/transformExpression'
import { createObjectMatcher } from '../../../compiler-core/__tests__/testUtils'

function parseVOnProperties(
  template: string,
  options: CompilerOptions = {}
): Property[] {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformExpression, transformElement],
    directiveTransforms: {
      on: transformOn
    },
    ...options
  })
  return (((ast.children[0] as ElementNode).codegenNode as CallExpression)
    .arguments[1] as ObjectExpression).properties
}

describe('compiler-dom: transform v-on', () => {
  it('should support muliple modifiers w/ prefixIdentifiers: true', () => {
    const [prop] = parseVOnProperties(`<div @click.stop.prevent="test"/>`, {
      prefixIdentifiers: true
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: createObjectMatcher({
        handler: {
          callee: V_ON_MODIFIERS_GUARD,
          arguments: [{ content: '_ctx.test' }, '["stop","prevent"]']
        },
        persistent: { content: true }
      })
    })
  })

  it('should support multiple modifiers and event options w/ prefixIdentifiers: true', () => {
    const [prop] = parseVOnProperties(
      `<div @click.stop.capture.passive="test"/>`,
      { prefixIdentifiers: true }
    )
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: createObjectMatcher({
        handler: {
          callee: V_ON_MODIFIERS_GUARD,
          arguments: [{ content: '_ctx.test' }, '["stop"]']
        },
        persistent: { content: true },
        options: createObjectMatcher({
          capture: { content: true },
          passive: { content: true }
        })
      })
    })
  })
})
