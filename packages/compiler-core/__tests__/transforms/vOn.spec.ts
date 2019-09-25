import {
  parse,
  transform,
  ElementNode,
  ObjectExpression,
  CompilerOptions,
  ErrorCodes
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

describe('compiler: transform v-bind', () => {
  test('basic', () => {
    const node = parseWithVOn(`<div v-on:click="onClick"/>`)
    const props = node.codegenNode!.arguments[1] as ObjectExpression
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
      },
      loc: {
        start: {
          line: 1,
          column: 6
        },
        end: {
          line: 1,
          column: 26
        }
      }
    })
  })

  test('dynamic arg', () => {
    const node = parseWithVOn(`<div v-on:[event]="handler"/>`)
    const props = node.codegenNode!.arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `"on" + event`,
        isStatic: false
      },
      value: {
        content: `handler`,
        isStatic: false
      }
    })
  })

  test('dynamic arg with prefixing', () => {
    const node = parseWithVOn(`<div v-on:[event]="handler"/>`, {
      prefixIdentifiers: true
    })
    const props = node.codegenNode!.arguments[1] as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        isStatic: false,
        children: [`"on" + `, `_ctx.`, { content: `event` }]
      },
      value: {
        content: `handler`,
        isStatic: false
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
