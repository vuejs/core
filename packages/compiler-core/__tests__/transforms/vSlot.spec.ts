import {
  CompilerOptions,
  parse,
  transform,
  generate,
  ElementNode,
  NodeTypes,
  ErrorCodes,
  ForNode,
  CallExpression
} from '../../src'
import { transformElement } from '../../src/transforms/transformElement'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { transformExpression } from '../../src/transforms/transformExpression'
import {
  trackSlotScopes,
  trackVForSlotScopes
} from '../../src/transforms/vSlot'
import { CREATE_SLOTS, RENDER_LIST } from '../../src/runtimeHelpers'
import { createObjectMatcher } from '../testUtils'
import { PatchFlags, PatchFlagNames } from '@vue/shared'
import { transformFor } from '../../src/transforms/vFor'
import { transformIf } from '../../src/transforms/vIf'

function parseWithSlots(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(options.prefixIdentifiers
        ? [trackVForSlotScopes, transformExpression]
        : []),
      trackSlotScopes,
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
    slots:
      ast.children[0].type === NodeTypes.ELEMENT
        ? (ast.children[0].codegenNode as CallExpression).arguments[2]
        : null
  }
}

function createSlotMatcher(obj: Record<string, any>) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties: Object.keys(obj)
      .map(key => {
        return {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            isStatic: !/^\[/.test(key),
            content: key.replace(/^\[|\]$/g, '')
          },
          value: obj[key]
        } as any
      })
      .concat({
        key: { content: `_compiled` },
        value: { content: `true` }
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
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
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
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
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
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
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
        },
        two: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `bar` }, ` }`]
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
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
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
        },
        '[_ctx.two]': {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `bar` }, ` }`]
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
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `foo` }, ` }`]
          },
          returns: [
            {
              type: NodeTypes.ELEMENT,
              codegenNode: {
                type: NodeTypes.JS_CALL_EXPRESSION,
                arguments: [
                  `_component_Inner`,
                  `null`,
                  createSlotMatcher({
                    default: {
                      type: NodeTypes.JS_FUNCTION_EXPRESSION,
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
                  }),
                  // nested slot should be forced dynamic, since scope variables
                  // are not tracked as dependencies of the slot.
                  `${PatchFlags.DYNAMIC_SLOTS} /* ${
                    PatchFlagNames[PatchFlags.DYNAMIC_SLOTS]
                  } */`
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

  test('should force dynamic when inside v-for', () => {
    const { root } = parseWithSlots(
      `<div v-for="i in list">
        <Comp v-slot="bar">foo</Comp>
      </div>`
    )
    const div = ((root.children[0] as ForNode).children[0] as ElementNode)
      .codegenNode as any
    const comp = div.arguments[2][0]
    expect(comp.codegenNode.arguments[3]).toMatch(PatchFlags.DYNAMIC_SLOTS + '')
  })

  test('named slot with v-if', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one v-if="ok">hello</template>
      </Comp>`
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _compiled: `[true]`
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
              test: { content: `ok` },
              consequent: createObjectMatcher({
                name: `one`,
                fn: {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  returns: [{ type: NodeTypes.TEXT, content: `hello` }]
                }
              }),
              alternate: {
                content: `undefined`,
                isStatic: false
              }
            }
          ]
        }
      ]
    })
    expect((root as any).children[0].codegenNode.arguments[3]).toMatch(
      PatchFlags.DYNAMIC_SLOTS + ''
    )
    expect(generate(root).code).toMatchSnapshot()
  })

  test('named slot with v-if + prefixIdentifiers: true', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one="props" v-if="ok">{{ props }}</template>
      </Comp>`,
      { prefixIdentifiers: true }
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _compiled: `[true]`
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
              test: { content: `_ctx.ok` },
              consequent: createObjectMatcher({
                name: `one`,
                fn: {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  params: { content: `props` },
                  returns: [
                    {
                      type: NodeTypes.INTERPOLATION,
                      content: { content: `props` }
                    }
                  ]
                }
              }),
              alternate: {
                content: `undefined`,
                isStatic: false
              }
            }
          ]
        }
      ]
    })
    expect((root as any).children[0].codegenNode.arguments[3]).toMatch(
      PatchFlags.DYNAMIC_SLOTS + ''
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('named slot with v-if + v-else-if + v-else', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one v-if="ok">foo</template>
        <template #two="props" v-else-if="orNot">bar</template>
        <template #one v-else>baz</template>
      </Comp>`
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _compiled: `[true]`
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
              test: { content: `ok` },
              consequent: createObjectMatcher({
                name: `one`,
                fn: {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  params: undefined,
                  returns: [{ type: NodeTypes.TEXT, content: `foo` }]
                }
              }),
              alternate: {
                type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
                test: { content: `orNot` },
                consequent: createObjectMatcher({
                  name: `two`,
                  fn: {
                    type: NodeTypes.JS_FUNCTION_EXPRESSION,
                    params: { content: `props` },
                    returns: [{ type: NodeTypes.TEXT, content: `bar` }]
                  }
                }),
                alternate: createObjectMatcher({
                  name: `one`,
                  fn: {
                    type: NodeTypes.JS_FUNCTION_EXPRESSION,
                    params: undefined,
                    returns: [{ type: NodeTypes.TEXT, content: `baz` }]
                  }
                })
              }
            }
          ]
        }
      ]
    })
    expect((root as any).children[0].codegenNode.arguments[3]).toMatch(
      PatchFlags.DYNAMIC_SLOTS + ''
    )
    expect(generate(root).code).toMatchSnapshot()
  })

  test('named slot with v-for w/ prefixIdentifiers: true', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template v-for="name in list" #[name]>{{ name }}</template>
      </Comp>`,
      { prefixIdentifiers: true }
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _compiled: `[true]`
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CALL_EXPRESSION,
              callee: RENDER_LIST,
              arguments: [
                { content: `_ctx.list` },
                {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  params: [{ content: `name` }],
                  returns: createObjectMatcher({
                    name: `[name]`,
                    fn: {
                      type: NodeTypes.JS_FUNCTION_EXPRESSION,
                      returns: [
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: { content: `name`, isStatic: false }
                        }
                      ]
                    }
                  })
                }
              ]
            }
          ]
        }
      ]
    })
    expect((root as any).children[0].codegenNode.arguments[3]).toMatch(
      PatchFlags.DYNAMIC_SLOTS + ''
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  describe('errors', () => {
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
})
