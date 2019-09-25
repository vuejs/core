import {
  generate,
  NodeTypes,
  RootNode,
  SourceLocation,
  createExpression,
  Namespaces,
  ElementTypes,
  CallExpression,
  createObjectExpression,
  createObjectProperty,
  createArrayExpression,
  ElementNode
} from '../src'
import {
  CREATE_VNODE,
  COMMENT,
  TO_STRING,
  RENDER_LIST
} from '../src/runtimeConstants'

const mockLoc: SourceLocation = {
  source: ``,
  start: {
    offset: 0,
    line: 1,
    column: 1
  },
  end: {
    offset: 3,
    line: 1,
    column: 4
  }
}

function createRoot(options: Partial<RootNode> = {}): RootNode {
  return {
    type: NodeTypes.ROOT,
    children: [],
    imports: [],
    statements: [],
    hoists: [],
    loc: mockLoc,
    ...options
  }
}

describe('compiler: codegen', () => {
  test('module mode preamble', () => {
    const root = createRoot({
      imports: [`helperOne`, `helperTwo`]
    })
    const { code } = generate(root, { mode: 'module' })
    expect(code).toMatch(`import { helperOne, helperTwo } from 'vue'`)
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
        createExpression(`hello`, false, mockLoc),
        createObjectExpression(
          [
            createObjectProperty(
              createExpression(`id`, true, mockLoc),
              createExpression(`foo`, true, mockLoc),
              mockLoc
            )
          ],
          mockLoc
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
            loc: mockLoc
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
        children: [createExpression(`hello`, false, mockLoc, true)]
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
            loc: mockLoc
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
            loc: mockLoc
          },
          createExpression(`hello`, false, mockLoc, true),
          {
            type: NodeTypes.COMMENT,
            content: 'foo',
            loc: mockLoc
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
            loc: mockLoc
          },
          createExpression(`hello`, false, mockLoc, true),
          {
            type: NodeTypes.COMMENT,
            content: 'foo',
            loc: mockLoc
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
          {
            type: NodeTypes.EXPRESSION,
            content: 'foo',
            isStatic: false,
            isInterpolation: true,
            loc: mockLoc,
            children: [`_ctx.`, createExpression(`foo`, false, mockLoc)]
          }
        ]
      })
    )
    expect(code).toMatch(`return _${TO_STRING}(_ctx.foo)`)
    expect(code).toMatchSnapshot()
  })

  test('ifNode', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.IF,
            loc: mockLoc,
            branches: [
              {
                type: NodeTypes.IF_BRANCH,
                condition: createExpression('foo', false, mockLoc),
                loc: mockLoc,
                children: [
                  {
                    type: NodeTypes.TEXT,
                    content: 'foo',
                    isEmpty: false,
                    loc: mockLoc
                  }
                ]
              },
              {
                type: NodeTypes.IF_BRANCH,
                condition: createExpression('a + b', false, mockLoc),
                loc: mockLoc,
                children: [createExpression(`bye`, false, mockLoc, true)]
              },
              {
                type: NodeTypes.IF_BRANCH,
                condition: undefined,
                loc: mockLoc,
                children: [
                  {
                    type: NodeTypes.COMMENT,
                    content: 'foo',
                    loc: mockLoc
                  }
                ]
              }
            ]
          }
        ]
      })
    )
    expect(code).toMatch(`
    return foo
      ? "foo"
      : (a + b)
        ? _${TO_STRING}(bye)
        : _${CREATE_VNODE}(_${COMMENT}, 0, "foo")`)
    expect(code).toMatchSnapshot()
  })

  test('ifNode with no v-else', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.IF,
            loc: mockLoc,
            branches: [
              {
                type: NodeTypes.IF_BRANCH,
                condition: createExpression('foo', false, mockLoc),
                loc: mockLoc,
                children: [
                  {
                    type: NodeTypes.TEXT,
                    content: 'foo',
                    isEmpty: false,
                    loc: mockLoc
                  }
                ]
              },
              {
                type: NodeTypes.IF_BRANCH,
                condition: createExpression('a + b', false, mockLoc),
                loc: mockLoc,
                children: [createExpression(`bye`, false, mockLoc, true)]
              }
            ]
          }
        ]
      })
    )
    expect(code).toMatch(`
    return foo
      ? "foo"
      : (a + b)
        ? _${TO_STRING}(bye)
        : null`)
    expect(code).toMatchSnapshot()
  })

  test('forNode', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.FOR,
            loc: mockLoc,
            source: createExpression(`list`, false, mockLoc),
            valueAlias: createExpression(`v`, false, mockLoc),
            keyAlias: createExpression(`k`, false, mockLoc),
            objectIndexAlias: createExpression(`i`, false, mockLoc),
            children: [createExpression(`v`, false, mockLoc, true)]
          }
        ]
      })
    )
    expect(code).toMatch(
      `return _${RENDER_LIST}(list, (v, k, i) => {
      return _${TO_STRING}(v)
    })`
    )
    expect(code).toMatchSnapshot()
  })

  test('forNode w/ prefixIdentifiers: true', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.FOR,
            loc: mockLoc,
            source: createExpression(`list`, false, mockLoc),
            valueAlias: createExpression(`v`, false, mockLoc),
            keyAlias: createExpression(`k`, false, mockLoc),
            objectIndexAlias: createExpression(`i`, false, mockLoc),
            children: [createExpression(`v`, false, mockLoc, true)]
          }
        ]
      }),
      {
        prefixIdentifiers: true
      }
    )
    expect(code).toMatch(
      `return ${RENDER_LIST}(list, (v, k, i) => {
    return ${TO_STRING}(v)
  })`
    )
    expect(code).toMatchSnapshot()
  })

  test('forNode w/ skipped value alias', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.FOR,
            loc: mockLoc,
            source: createExpression(`list`, false, mockLoc),
            valueAlias: undefined,
            keyAlias: createExpression(`k`, false, mockLoc),
            objectIndexAlias: createExpression(`i`, false, mockLoc),
            children: [createExpression(`v`, false, mockLoc, true)]
          }
        ]
      })
    )
    expect(code).toMatch(
      `return _${RENDER_LIST}(list, (__value, k, i) => {
      return _${TO_STRING}(v)
    })`
    )
    expect(code).toMatchSnapshot()
  })

  test('forNode w/ skipped key alias', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.FOR,
            loc: mockLoc,
            source: createExpression(`list`, false, mockLoc),
            valueAlias: createExpression(`v`, false, mockLoc),
            keyAlias: undefined,
            objectIndexAlias: createExpression(`i`, false, mockLoc),
            children: [createExpression(`v`, false, mockLoc, true)]
          }
        ]
      })
    )
    expect(code).toMatch(
      `return _${RENDER_LIST}(list, (v, __key, i) => {
      return _${TO_STRING}(v)
    })`
    )
    expect(code).toMatchSnapshot()
  })

  test('forNode w/ skipped value and key aliases', () => {
    const { code } = generate(
      createRoot({
        children: [
          {
            type: NodeTypes.FOR,
            loc: mockLoc,
            source: createExpression(`list`, false, mockLoc),
            valueAlias: undefined,
            keyAlias: undefined,
            objectIndexAlias: createExpression(`i`, false, mockLoc),
            children: [createExpression(`v`, false, mockLoc, true)]
          }
        ]
      })
    )
    expect(code).toMatch(
      `return _${RENDER_LIST}(list, (__value, __key, i) => {
      return _${TO_STRING}(v)
    })`
    )
    expect(code).toMatchSnapshot()
  })

  test('callExpression + objectExpression + arrayExpression', () => {
    function createElementWithCodegen(
      args: CallExpression['arguments']
    ): ElementNode {
      return {
        type: NodeTypes.ELEMENT,
        loc: mockLoc,
        ns: Namespaces.HTML,
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        isSelfClosing: false,
        props: [],
        children: [],
        codegenNode: {
          type: NodeTypes.JS_CALL_EXPRESSION,
          loc: mockLoc,
          callee: CREATE_VNODE,
          arguments: args
        }
      }
    }

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
                  createExpression(`id`, true, mockLoc),
                  createExpression(`foo`, true, mockLoc),
                  mockLoc
                ),
                createObjectProperty(
                  createExpression(`prop`, false, mockLoc),
                  createExpression(`bar`, false, mockLoc),
                  mockLoc
                ),
                // compound expression as computed key
                createObjectProperty(
                  {
                    type: NodeTypes.EXPRESSION,
                    content: ``,
                    loc: mockLoc,
                    isStatic: false,
                    isInterpolation: false,
                    children: [
                      `foo + `,
                      createExpression(`bar`, false, mockLoc)
                    ]
                  },
                  createExpression(`bar`, false, mockLoc),
                  mockLoc
                )
              ],
              mockLoc
            ),
            // ChildNode[]
            [
              createElementWithCodegen([
                `"p"`,
                createObjectExpression(
                  [
                    createObjectProperty(
                      // should quote the key!
                      createExpression(`some-key`, true, mockLoc),
                      createExpression(`foo`, true, mockLoc),
                      mockLoc
                    )
                  ],
                  mockLoc
                )
              ])
            ],
            // ArrayExpression
            createArrayExpression(
              [
                'foo',
                {
                  type: NodeTypes.JS_CALL_EXPRESSION,
                  loc: mockLoc,
                  callee: CREATE_VNODE,
                  arguments: [`"p"`]
                }
              ],
              mockLoc
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
    }, [${CREATE_VNODE}("p", { "some-key": "foo" })], [
      foo,
      ${CREATE_VNODE}("p")
    ])`)
    expect(code).toMatchSnapshot()
  })
})
