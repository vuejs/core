import {
  CompilerOptions,
  parse,
  transform,
  generate,
  ElementNode,
  NodeTypes,
  ErrorCodes
} from '../../src'
import { transformElement } from '../../src/transforms/transformElement'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { transformExpression } from '../../src/transforms/transformExpression'
import { trackSlotScopes } from '../../src/transforms/vSlot'

function parseWithSlots(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      ...(options.prefixIdentifiers
        ? [transformExpression, trackSlotScopes]
        : []),
      transformElement
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind
    },
    ...options
  })
  return {
    root: ast,
    slots: (ast.children[0] as ElementNode).codegenNode!.arguments[2]
  }
}

function createSlotMatcher(obj: Record<string, any>) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties: Object.keys(obj).map(key => {
      return {
        type: NodeTypes.JS_PROPERTY,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          isStatic: !/^\[/.test(key),
          content: key.replace(/^\[|\]$/g, '')
        },
        value: obj[key]
      }
    })
  }
}

describe('compiler: transform component slots', () => {
  test('implicit default slot', () => {
    const { root, slots } = parseWithSlots(`<Comp><div/></Comp>`, {
      prefixIdentifiers: true
    })
    expect(slots).toMatchObject(
      createSlotMatcher({
        default: {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: undefined,
          returns: [
            {
              type: NodeTypes.ELEMENT,
              tag: `div`
            }
          ]
        }
      })
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('explicit default slot', () => {
    const { root, slots } = parseWithSlots(
      `<Comp v-slot="{ foo }">{{ foo }}{{ bar }}</Comp>`,
      { prefixIdentifiers: true }
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        default: {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `foo` }, ` }`]
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`
              }
            }
          ]
        }
      })
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('named slots', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template v-slot:one="{ foo }">
          {{ foo }}{{ bar }}
        </template>
        <template #two="{ bar }">
          {{ foo }}{{ bar }}
        </template>
      </Comp>`,
      { prefixIdentifiers: true }
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        one: {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ foo }`,
            isStatic: false
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`
              }
            }
          ]
        },
        two: {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ bar }`,
            isStatic: false
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.foo`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `bar`
              }
            }
          ]
        }
      })
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('dynamically named slots', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template v-slot:[one]="{ foo }">
          {{ foo }}{{ bar }}
        </template>
        <template #[two]="{ bar }">
          {{ foo }}{{ bar }}
        </template>
      </Comp>`,
      { prefixIdentifiers: true }
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        '[_ctx.one]': {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ foo }`,
            isStatic: false
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`
              }
            }
          ]
        },
        '[_ctx.two]': {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ bar }`,
            isStatic: false
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.foo`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `bar`
              }
            }
          ]
        }
      })
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('nested slots scoping', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #default="{ foo }">
          <Inner v-slot="{ bar }">
            {{ foo }}{{ bar }}{{ baz }}
          </Inner>
          {{ foo }}{{ bar }}{{ baz }}
        </template>
      </Comp>`,
      { prefixIdentifiers: true }
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        default: {
          type: NodeTypes.JS_SLOT_FUNCTION,
          params: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ foo }`,
            isStatic: false
          },
          returns: [
            {
              type: NodeTypes.ELEMENT,
              codegenNode: {
                type: NodeTypes.JS_CALL_EXPRESSION,
                arguments: [
                  `_component_Inner`,
                  `0`,
                  createSlotMatcher({
                    default: {
                      type: NodeTypes.JS_SLOT_FUNCTION,
                      params: {
                        type: NodeTypes.COMPOUND_EXPRESSION,
                        children: [`{ `, { content: `bar` }, ` }`]
                      },
                      returns: [
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: {
                            content: `foo`
                          }
                        },
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: {
                            content: `bar`
                          }
                        },
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: {
                            content: `_ctx.baz`
                          }
                        }
                      ]
                    }
                  })
                ]
              }
            },
            // test scope
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`
              }
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.baz`
              }
            }
          ]
        }
      })
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('error on extraneous children w/ named slots', () => {
    const onError = jest.fn()
    const source = `<Comp><template #default>foo</template>bar</Comp>`
    parseWithSlots(source, { onError })
    const index = source.indexOf('bar')
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_EXTRANEOUS_NON_SLOT_CHILDREN,
      loc: {
        source: `bar`,
        start: {
          offset: index,
          line: 1,
          column: index + 1
        },
        end: {
          offset: index + 3,
          line: 1,
          column: index + 4
        }
      }
    })
  })

  test('error on duplicated slot names', () => {
    const onError = jest.fn()
    const source = `<Comp><template #foo></template><template #foo></template></Comp>`
    parseWithSlots(source, { onError })
    const index = source.lastIndexOf('#foo')
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_DUPLICATE_SLOT_NAMES,
      loc: {
        source: `#foo`,
        start: {
          offset: index,
          line: 1,
          column: index + 1
        },
        end: {
          offset: index + 4,
          line: 1,
          column: index + 5
        }
      }
    })
  })

  test('error on invalid mixed slot usage', () => {
    const onError = jest.fn()
    const source = `<Comp v-slot="foo"><template #foo></template></Comp>`
    parseWithSlots(source, { onError })
    const index = source.lastIndexOf('#foo')
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_MIXED_SLOT_USAGE,
      loc: {
        source: `#foo`,
        start: {
          offset: index,
          line: 1,
          column: index + 1
        },
        end: {
          offset: index + 4,
          line: 1,
          column: index + 5
        }
      }
    })
  })

  test('error on v-slot usage on plain elements', () => {
    const onError = jest.fn()
    const source = `<div v-slot/>`
    parseWithSlots(source, { onError })
    const index = source.indexOf('v-slot')
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_MISPLACED_V_SLOT,
      loc: {
        source: `v-slot`,
        start: {
          offset: index,
          line: 1,
          column: index + 1
        },
        end: {
          offset: index + 6,
          line: 1,
          column: index + 7
        }
      }
    })
  })

  test('error on named slot on component', () => {
    const onError = jest.fn()
    const source = `<Comp v-slot:foo>foo</Comp>`
    parseWithSlots(source, { onError })
    const index = source.indexOf('v-slot')
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_NAMED_SLOT_ON_COMPONENT,
      loc: {
        source: `v-slot:foo`,
        start: {
          offset: index,
          line: 1,
          column: index + 1
        },
        end: {
          offset: index + 10,
          line: 1,
          column: index + 11
        }
      }
    })
  })
})
