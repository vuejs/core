import {
  locStub,
  generate,
  NodeTypes,
  RootNode,
  createSimpleExpression,
  createObjectExpression,
  createObjectProperty,
  createArrayExpression,
  createCompoundExpression,
  createInterpolation,
  createSequenceExpression,
  createCallExpression,
  createConditionalExpression
} from '../src'
import { CREATE_VNODE, COMMENT, TO_STRING } from '../src/runtimeConstants'
import { createElementWithCodegen } from './testUtils'

function createRoot(options: Partial<RootNode> = {}): RootNode {
  return {
    type: NodeTypes.ROOT,
    children: [],
    imports: [],
    statements: [],
    hoists: [],
    loc: locStub,
    ...options
  }
}

describe('compiler: codegen', () => {
  test('module mode preamble', () => {
    const root = createRoot({
      imports: [`helperOne`, `helperTwo`]
    })
    const { code } = generate(root, { mode: 'module' })
    expect(code).toMatch(`import { helperOne, helperTwo } from "vue"`)
    expect(code).toMatchSnapshot()
  })

  test('function mode preamble', () => {
    const root = createRoot({
      imports: [`helperOne`, `helperTwo`]
    })
    const { code } = generate(root, { mode: 'function' })
    expect(code).toMatch(`const _Vue = Vue`)
    expect(code).toMatch(
      `const { helperOne: _helperOne, helperTwo: _helperTwo } = _Vue`
    )
    expect(code).toMatchSnapshot()
  })

  test('function mode preamble w/ prefixIdentifiers: true', () => {
    const root = createRoot({
      imports: [`helperOne`, `helperTwo`]
    })
    const { code } = generate(root, {
      mode: 'function',
      prefixIdentifiers: true
    })
    expect(code).not.toMatch(`const _Vue = Vue`)
    expect(code).toMatch(`const { helperOne, helperTwo } = Vue`)
    expect(code).toMatchSnapshot()
  })

  test('statements', () => {
    const root = createRoot({
      statements: [`const a = 1`, `const b = 2`]
    })
    const { code } = generate(root, { mode: 'function' })
    expect(code).toMatch(`const a = 1\n`)
    expect(code).toMatch(`const b = 2\n`)
    expect(code).toMatchSnapshot()
  })

  test('hoists', () => {
    const root = createRoot({
      hoists: [
        createSimpleExpression(`hello`, false, locStub),
        createObjectExpression(
          [
            createObjectProperty(
              createSimpleExpression(`id`, true, locStub),
              createSimpleExpression(`foo`, true, locStub)
            )
          ],
          locStub
        )
      ]
    })
    const { code } = generate(root)
    expect(code).toMatch(`const _hoisted_1 = hello`)
    expect(code).toMatch(`const _hoisted_2 = { id: "foo" }`)
    expect(code).toMatchSnapshot()
  })

  test('prefixIdentifiers: true should inject _ctx statement', () => {
    const { code } = generate(createRoot(), { prefixIdentifiers: true })
    expect(code).toMatch(`const _ctx = this\n`)
    expect(code).toMatchSnapshot()
  })

  test('static text', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.TEXT,
            content: 'hello',
            isEmpty: false,
            loc: locStub
          }
        ]
      })
    )
    expect(code).toMatch(`return "hello"`)
    expect(code).toMatchSnapshot()
  })

  test('interpolation', () => {
    const { code } = generate(
      createRoot({
        children: [createInterpolation(`hello`, locStub)]
      })
    )
    expect(code).toMatch(`return _${TO_STRING}(hello)`)
    expect(code).toMatchSnapshot()
  })

  test('comment', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.COMMENT,
            content: 'foo',
            loc: locStub
          }
        ]
      })
    )
    expect(code).toMatch(`return _${CREATE_VNODE}(_${COMMENT}, 0, "foo")`)
    expect(code).toMatchSnapshot()
  })

  test('text + comment + interpolation', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.TEXT,
            content: 'foo',
            isEmpty: false,
            loc: locStub
          },
          createInterpolation(`hello`, locStub),
          {
            type: NodeTypes.COMMENT,
            content: 'foo',
            loc: locStub
          }
        ]
      })
    )
    expect(code).toMatch(`
    return [
      "foo",
      _${TO_STRING}(hello),
      _${CREATE_VNODE}(_${COMMENT}, 0, "foo")
    ]`)
    expect(code).toMatchSnapshot()
  })

  test('text + comment + interpolation w/ prefixIdentifiers: true', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.TEXT,
            content: 'foo',
            isEmpty: false,
            loc: locStub
          },
          createInterpolation(`hello`, locStub),
          {
            type: NodeTypes.COMMENT,
            content: 'foo',
            loc: locStub
          }
        ]
      }),
      {
        prefixIdentifiers: true
      }
    )
    expect(code).toMatch(`
  return [
    "foo",
    ${TO_STRING}(hello),
    ${CREATE_VNODE}(${COMMENT}, 0, "foo")
  ]`)
    expect(code).toMatchSnapshot()
  })

  test('compound expression', () => {
    const { code } = generate(
      createRoot({
        children: [
          createCompoundExpression([
            `_ctx.`,
            createSimpleExpression(`foo`, false, locStub),
            ` + `,
            {
              type: NodeTypes.INTERPOLATION,
              loc: locStub,
              content: createSimpleExpression(`bar`, false, locStub)
            }
          ])
        ]
      })
    )
    expect(code).toMatch(`return _ctx.foo + _${TO_STRING}(bar)`)
    expect(code).toMatchSnapshot()
  })

  test('ifNode', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.IF,
            loc: locStub,
            branches: [],
            codegenNode: createSequenceExpression([
              createSimpleExpression('foo', false),
              createSimpleExpression('bar', false)
            ])
          }
        ]
      })
    )
    expect(code).toMatch(`return (foo, bar)`)
    expect(code).toMatchSnapshot()
  })

  // test('forNode', () => {
  //   const { code } = generate(
  //     createRoot({
  //       children: [
  //         {
  //           type: NodeTypes.FOR,
  //           loc: locStub,
  //           source: createSimpleExpression(`list`, false, locStub),
  //           valueAlias: createSimpleExpression(`v`, false, locStub),
  //           keyAlias: createSimpleExpression(`k`, false, locStub),
  //           objectIndexAlias: createSimpleExpression(`i`, false, locStub),
  //           children: [createInterpolation(`v`, locStub)]
  //         }
  //       ]
  //     })
  //   )
  //   expect(code).toMatch(
  //     `return _${RENDER_LIST}(list, (v, k, i) => {
  //     return _${TO_STRING}(v)
  //   })`
  //   )
  //   expect(code).toMatchSnapshot()
  // })

  // test('forNode w/ prefixIdentifiers: true', () => {
  //   const { code } = generate(
  //     createRoot({
  //       children: [
  //         {
  //           type: NodeTypes.FOR,
  //           loc: locStub,
  //           source: createSimpleExpression(`list`, false, locStub),
  //           valueAlias: createSimpleExpression(`v`, false, locStub),
  //           keyAlias: createSimpleExpression(`k`, false, locStub),
  //           objectIndexAlias: createSimpleExpression(`i`, false, locStub),
  //           children: [createInterpolation(`v`, locStub)]
  //         }
  //       ]
  //     }),
  //     {
  //       prefixIdentifiers: true
  //     }
  //   )
  //   expect(code).toMatch(
  //     `return ${RENDER_LIST}(list, (v, k, i) => {
  //   return ${TO_STRING}(v)
  // })`
  //   )
  //   expect(code).toMatchSnapshot()
  // })

  // test('forNode w/ skipped value alias', () => {
  //   const { code } = generate(
  //     createRoot({
  //       children: [
  //         {
  //           type: NodeTypes.FOR,
  //           loc: locStub,
  //           source: createSimpleExpression(`list`, false, locStub),
  //           valueAlias: undefined,
  //           keyAlias: createSimpleExpression(`k`, false, locStub),
  //           objectIndexAlias: createSimpleExpression(`i`, false, locStub),
  //           children: [createInterpolation(`v`, locStub)]
  //         }
  //       ]
  //     })
  //   )
  //   expect(code).toMatch(
  //     `return _${RENDER_LIST}(list, (__value, k, i) => {
  //     return _${TO_STRING}(v)
  //   })`
  //   )
  //   expect(code).toMatchSnapshot()
  // })

  // test('forNode w/ skipped key alias', () => {
  //   const { code } = generate(
  //     createRoot({
  //       children: [
  //         {
  //           type: NodeTypes.FOR,
  //           loc: locStub,
  //           source: createSimpleExpression(`list`, false, locStub),
  //           valueAlias: createSimpleExpression(`v`, false, locStub),
  //           keyAlias: undefined,
  //           objectIndexAlias: createSimpleExpression(`i`, false, locStub),
  //           children: [createInterpolation(`v`, locStub)]
  //         }
  //       ]
  //     })
  //   )
  //   expect(code).toMatch(
  //     `return _${RENDER_LIST}(list, (v, __key, i) => {
  //     return _${TO_STRING}(v)
  //   })`
  //   )
  //   expect(code).toMatchSnapshot()
  // })

  // test('forNode w/ skipped value and key aliases', () => {
  //   const { code } = generate(
  //     createRoot({
  //       children: [
  //         {
  //           type: NodeTypes.FOR,
  //           loc: locStub,
  //           source: createSimpleExpression(`list`, false, locStub),
  //           valueAlias: undefined,
  //           keyAlias: undefined,
  //           objectIndexAlias: createSimpleExpression(`i`, false, locStub),
  //           children: [createInterpolation(`v`, locStub)]
  //         }
  //       ]
  //     })
  //   )
  //   expect(code).toMatch(
  //     `return _${RENDER_LIST}(list, (__value, __key, i) => {
  //     return _${TO_STRING}(v)
  //   })`
  //   )
  //   expect(code).toMatchSnapshot()
  // })

  // test('SlotFunctionExpression', () => {
  //   const { code } = generate(
  //     createRoot({
  //       children: [
  //         {
  //           type: NodeTypes.ELEMENT,
  //           tagType: ElementTypes.COMPONENT,
  //           ns: Namespaces.HTML,
  //           isSelfClosing: false,
  //           tag: `Comp`,
  //           loc: locStub,
  //           props: [],
  //           children: [],
  //           codegenNode: {
  //             type: NodeTypes.JS_CALL_EXPRESSION,
  //             loc: locStub,
  //             callee: `_${CREATE_VNODE}`,
  //             arguments: [
  //               `Comp`,
  //               `0`,
  //               {
  //                 type: NodeTypes.JS_OBJECT_EXPRESSION,
  //                 loc: locStub,
  //                 properties: [
  //                   {
  //                     type: NodeTypes.JS_PROPERTY,
  //                     loc: locStub,
  //                     key: {
  //                       type: NodeTypes.SIMPLE_EXPRESSION,
  //                       isStatic: true,
  //                       content: `default`,
  //                       loc: locStub
  //                     },
  //                     value: {
  //                       type: NodeTypes.JS_FUNCTION_EXPRESSION,
  //                       loc: locStub,
  //                       params: {
  //                         type: NodeTypes.SIMPLE_EXPRESSION,
  //                         isStatic: false,
  //                         content: `{ foo }`,
  //                         loc: locStub
  //                       },
  //                       returns: [
  //                         {
  //                           type: NodeTypes.INTERPOLATION,
  //                           loc: locStub,
  //                           content: {
  //                             type: NodeTypes.SIMPLE_EXPRESSION,
  //                             isStatic: false,
  //                             content: `foo`,
  //                             loc: locStub
  //                           }
  //                         }
  //                       ]
  //                     }
  //                   }
  //                 ]
  //               }
  //             ]
  //           }
  //         }
  //       ]
  //     })
  //   )
  //   expect(code).toMatch(
  //     `return _createVNode(Comp, 0, {
  //     default: ({ foo }) => [
  //       _toString(foo)
  //     ]
  //   })`
  //   )
  //   expect(code).toMatchSnapshot()
  // })

  test('callExpression + objectExpression + arrayExpression', () => {
    const { code } = generate(
      createRoot({
        children: [
          createElementWithCodegen([
            // string
            `"div"`,
            // ObjectExpression
            createObjectExpression(
              [
                createObjectProperty(
                  createSimpleExpression(`id`, true, locStub),
                  createSimpleExpression(`foo`, true, locStub)
                ),
                createObjectProperty(
                  createSimpleExpression(`prop`, false, locStub),
                  createSimpleExpression(`bar`, false, locStub)
                ),
                // compound expression as computed key
                createObjectProperty(
                  {
                    type: NodeTypes.COMPOUND_EXPRESSION,
                    loc: locStub,
                    children: [
                      `foo + `,
                      createSimpleExpression(`bar`, false, locStub)
                    ]
                  },
                  createSimpleExpression(`bar`, false, locStub)
                )
              ],
              locStub
            ),
            // ChildNode[]
            [
              createElementWithCodegen([
                `"p"`,
                createObjectExpression(
                  [
                    createObjectProperty(
                      // should quote the key!
                      createSimpleExpression(`some-key`, true, locStub),
                      createSimpleExpression(`foo`, true, locStub)
                    )
                  ],
                  locStub
                )
              ])
            ],
            // ArrayExpression
            createArrayExpression(
              [
                'foo',
                {
                  type: NodeTypes.JS_CALL_EXPRESSION,
                  loc: locStub,
                  callee: CREATE_VNODE,
                  arguments: [`"p"`]
                }
              ],
              locStub
            )
          ])
        ]
      })
    )
    expect(code).toMatch(`
    return ${CREATE_VNODE}("div", {
      id: "foo",
      [prop]: bar,
      [foo + bar]: bar
    }, [
      ${CREATE_VNODE}("p", { "some-key": "foo" })
    ], [
      foo,
      ${CREATE_VNODE}("p")
    ])`)
    expect(code).toMatchSnapshot()
  })

  test('SequenceExpression', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.IF,
            loc: locStub,
            branches: [],
            codegenNode: createSequenceExpression([
              createSimpleExpression(`foo`, false),
              createCallExpression(`bar`, [`baz`])
            ])
          }
        ]
      })
    )
    expect(code).toMatch(`return (foo, bar(baz))`)
    expect(code).toMatchSnapshot()
  })

  test('ConditionalExpression', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.IF,
            loc: locStub,
            branches: [],
            codegenNode: createSequenceExpression([
              createSimpleExpression(`foo`, false),
              createConditionalExpression(
                createSimpleExpression(`ok`, false),
                createCallExpression(`foo`),
                createConditionalExpression(
                  createSimpleExpression(`orNot`, false),
                  createCallExpression(`bar`),
                  createCallExpression(`baz`)
                )
              )
            ])
          }
        ]
      })
    )
    expect(code).toMatch(
      `return (foo, ok
      ? foo()
      : orNot
        ? bar()
        : baz())`
    )
    expect(code).toMatchSnapshot()
  })
})
