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
import { V_ON_MODIFIERS_GUARD, V_ON_KEYS_GUARD } from '../../src/runtimeHelpers'
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
      value: {
        callee: V_ON_MODIFIERS_GUARD,
        arguments: [{ content: '_ctx.test' }, '["stop","prevent"]']
      }
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
        options: createObjectMatcher({
          capture: { content: 'true', isStatic: false },
          passive: { content: 'true', isStatic: false }
        }),
        persistent: { content: 'true', isStatic: false }
      })
    })
  })

  it('should wrap keys guard for keyboard events or dynamic events', () => {
    const [prop] = parseVOnProperties(
      `<div @keyDown.stop.capture.ctrl.a="test"/>`,
      { prefixIdentifiers: true }
    )
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: createObjectMatcher({
        handler: {
          callee: V_ON_KEYS_GUARD,
          arguments: [
            {
              callee: V_ON_MODIFIERS_GUARD,
              arguments: [{ content: '_ctx.test' }, '["stop","ctrl"]']
            },
            '["a"]'
          ]
        },
        options: createObjectMatcher({
          capture: { content: 'true', isStatic: false }
        }),
        persistent: { content: 'true', isStatic: false }
      })
    })
  })

  it('should not wrap keys guard if no key modifier is present', () => {
    const [prop] = parseVOnProperties(`<div @keyup.exact="test"/>`, {
      prefixIdentifiers: true
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_MODIFIERS_GUARD,
        arguments: [{ content: '_ctx.test' }, '["exact"]']
      }
    })
  })
})
