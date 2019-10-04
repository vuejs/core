import {
  parse,
  transform,
  ElementNode,
  ObjectExpression,
  CompilerOptions,
  ErrorCodes,
  NodeTypes,
  CallExpression
} from '../../src'
import { transformOn } from '../../src/transforms/vOn'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'

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

describe('compiler: transform v-on', () => {
  test('basic', () => {
    const node = parseWithVOn(`<div v-on:click="onClick"/>`)
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `onClick`,
        isStatic: true,
        loc: {
          start: {
            line: 1,
            column: 11
          },
          end: {
            line: 1,
            column: 16
          }
        }
      },
      value: {
        content: `onClick`,
        isStatic: false,
        loc: {
          start: {
            line: 1,
            column: 18
          },
          end: {
            line: 1,
            column: 25
          }
        }
      }
    })
  })

  test('dynamic arg', () => {
    const node = parseWithVOn(`<div v-on:[event]="handler"/>`)
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [`"on" + (`, { content: `event` }, `)`]
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `handler`,
        isStatic: false
      }
    })
  })

  test('dynamic arg with prefixing', () => {
    const node = parseWithVOn(`<div v-on:[event]="handler"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [`"on" + (`, { content: `_ctx.event` }, `)`]
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `_ctx.handler`,
        isStatic: false
      }
    })
  })

  test('dynamic arg with complex exp prefixing', () => {
    const node = parseWithVOn(`<div v-on:[event(foo)]="handler"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          `"on" + (`,
          { content: `_ctx.event` },
          `(`,
          { content: `_ctx.foo` },
          `)`,
          `)`
        ]
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `_ctx.handler`,
        isStatic: false
      }
    })
  })

  test('should wrap as function if expression is inline statement', () => {
    const node = parseWithVOn(`<div @click="i++"/>`)
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: { content: `onClick` },
      value: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [`$event => (`, { content: `i++` }, `)`]
      }
    })
  })

  test('inline statement w/ prefixIdentifiers: true', () => {
    const node = parseWithVOn(`<div @click="foo($event)"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: { content: `onClick` },
      value: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          `$event => (`,
          { content: `_ctx.foo` },
          `(`,
          // should NOT prefix $event
          { content: `$event` },
          `)`,
          `)`
        ]
      }
    })
  })

  test('should NOT wrap as function if expression is already function expression', () => {
    const node = parseWithVOn(`<div @click="$event => foo($event)"/>`)
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: { content: `onClick` },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `$event => foo($event)`
      }
    })
  })

  test('function expression w/ prefixIdentifiers: true', () => {
    const node = parseWithVOn(`<div @click="e => foo(e)"/>`, {
      prefixIdentifiers: true
    })
    const props = (node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: { content: `onClick` },
      value: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          { content: `e` },
          ` => `,
          { content: `_ctx.foo` },
          `(`,
          { content: `e` },
          `)`
        ]
      }
    })
  })

  test('should error if no expression AND no modifier', () => {
    const onError = jest.fn()
    parseWithVOn(`<div v-on:click />`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_ON_NO_EXPRESSION,
      loc: {
        start: {
          line: 1,
          column: 6
        },
        end: {
          line: 1,
          column: 16
        }
      }
    })
  })

  test('should NOT error if no expression but has modifier', () => {
    const onError = jest.fn()
    parseWithVOn(`<div v-on:click.prevent />`, { onError })
    expect(onError).not.toHaveBeenCalled()
  })

  test.todo('.once modifier')
})
