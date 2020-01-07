import {
  baseParse as parse,
  transform,
  NodeTypes,
  generate,
  CompilerOptions
} from '../../src'
import {
  OPEN_BLOCK,
  CREATE_BLOCK,
  CREATE_VNODE,
  WITH_DIRECTIVES,
  FRAGMENT,
  RENDER_LIST
} from '../../src/runtimeHelpers'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformIf } from '../../src/transforms/vIf'
import { transformFor } from '../../src/transforms/vFor'
import { transformBind } from '../../src/transforms/vBind'
import { transformOn } from '../../src/transforms/vOn'
import { createObjectMatcher, genFlagText } from '../testUtils'
import { PatchFlags } from '@vue/shared'

function transformWithHoist(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    hoistStatic: true,
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformElement
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind
    },
    ...options
  })
  expect(ast.codegenNode).toMatchObject({
    type: NodeTypes.JS_SEQUENCE_EXPRESSION,
    expressions: [
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: OPEN_BLOCK
      },
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_BLOCK
      }
    ]
  })
  return {
    root: ast,
    args: (ast.codegenNode as any).expressions[1].arguments
  }
}

describe('compiler: hoistStatic transform', () => {
  test('should NOT hoist root node', () => {
    // if the whole tree is static, the root still needs to be a block
    // so that it's patched in optimized mode to skip children
    const { root, args } = transformWithHoist(`<div/>`)
    expect(root.hoists.length).toBe(0)
    expect(args).toEqual([`"div"`])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist simple element', () => {
    const { root, args } = transformWithHoist(
      `<div><span class="inline">hello</span></div>`
    )
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          `"span"`,
          createObjectMatcher({ class: 'inline' }),
          {
            type: NodeTypes.TEXT,
            content: `hello`
          }
        ]
      }
    ])
    expect(args).toMatchObject([
      `"div"`,
      `null`,
      [
        {
          type: NodeTypes.ELEMENT,
          codegenNode: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`
          }
        }
      ]
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist nested static tree', () => {
    const { root, args } = transformWithHoist(
      `<div><p><span/><span/></p></div>`
    )
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          `"p"`,
          `null`,
          [
            { type: NodeTypes.ELEMENT, tag: `span` },
            { type: NodeTypes.ELEMENT, tag: `span` }
          ]
        ]
      }
    ])
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `_hoisted_1`
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist nested static tree with comments', () => {
    const { root, args } = transformWithHoist(
      `<div><div><!--comment--></div></div>`
    )
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          `"div"`,
          `null`,
          [{ type: NodeTypes.COMMENT, content: `comment` }]
        ]
      }
    ])
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `_hoisted_1`
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist siblings with common non-hoistable parent', () => {
    const { root, args } = transformWithHoist(`<div><span/><div/></div>`)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [`"span"`]
      },
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [`"div"`]
      }
    ])
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `_hoisted_1`
        }
      },
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `_hoisted_2`
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist components', () => {
    const { root, args } = transformWithHoist(`<div><Comp/></div>`)
    expect(root.hoists.length).toBe(0)
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: CREATE_VNODE,
          arguments: [`_component_Comp`]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist element with dynamic props', () => {
    const { root, args } = transformWithHoist(`<div><div :id="foo"/></div>`)
    expect(root.hoists.length).toBe(0)
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: CREATE_VNODE,
          arguments: [
            `"div"`,
            createObjectMatcher({
              id: `[foo]`
            }),
            `null`,
            genFlagText(PatchFlags.PROPS),
            `["id"]`
          ]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist element with static key', () => {
    const { root, args } = transformWithHoist(`<div><div key="foo"/></div>`)
    expect(root.hoists.length).toBe(1)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [`"div"`, createObjectMatcher({ key: 'foo' })]
      }
    ])
    expect(args).toMatchObject([
      `"div"`,
      `null`,
      [
        {
          type: NodeTypes.ELEMENT,
          codegenNode: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`
          }
        }
      ]
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist element with dynamic key', () => {
    const { root, args } = transformWithHoist(`<div><div :key="foo"/></div>`)
    expect(root.hoists.length).toBe(0)
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: CREATE_VNODE,
          arguments: [
            `"div"`,
            createObjectMatcher({
              key: `[foo]`
            })
          ]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist element with dynamic ref', () => {
    const { root, args } = transformWithHoist(`<div><div :ref="foo"/></div>`)
    expect(root.hoists.length).toBe(0)
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: CREATE_VNODE,
          arguments: [
            `"div"`,
            createObjectMatcher({
              ref: `[foo]`
            }),
            `null`,
            genFlagText(PatchFlags.NEED_PATCH)
          ]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with directives', () => {
    const { root, args } = transformWithHoist(
      `<div><div id="foo" v-foo/></div>`
    )
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: WITH_DIRECTIVES,
          arguments: [
            {
              callee: CREATE_VNODE,
              arguments: [
                `"div"`,
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: `_hoisted_1`
                },
                `null`,
                genFlagText(PatchFlags.NEED_PATCH)
              ]
            },
            {
              type: NodeTypes.JS_ARRAY_EXPRESSION
            }
          ]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with dynamic text children', () => {
    const { root, args } = transformWithHoist(
      `<div><div id="foo">{{ hello }}</div></div>`
    )
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: CREATE_VNODE,
          arguments: [
            `"div"`,
            { content: `_hoisted_1` },
            { type: NodeTypes.INTERPOLATION },
            genFlagText(PatchFlags.TEXT)
          ]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with unhoistable children', () => {
    const { root, args } = transformWithHoist(
      `<div><div id="foo"><Comp/></div></div>`
    )
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect(args[2]).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          callee: CREATE_VNODE,
          arguments: [
            `"div"`,
            { content: `_hoisted_1` },
            [{ type: NodeTypes.ELEMENT, tag: `Comp` }]
          ]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should hoist v-if props/children if static', () => {
    const { root, args } = transformWithHoist(
      `<div><div v-if="ok" id="foo"><span/></div></div>`
    )
    expect(root.hoists).toMatchObject([
      createObjectMatcher({
        key: `[0]`, // key injected by v-if branch
        id: 'foo'
      }),
      {
        callee: CREATE_VNODE,
        arguments: [`"span"`]
      }
    ])
    expect(args[2][0].codegenNode).toMatchObject({
      type: NodeTypes.JS_SEQUENCE_EXPRESSION,
      expressions: [
        { callee: OPEN_BLOCK },
        {
          type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
          consequent: {
            // blocks should NOT be hoisted
            callee: CREATE_BLOCK,
            arguments: [
              `"div"`,
              { content: `_hoisted_1` },
              [
                {
                  codegenNode: { content: `_hoisted_2` }
                }
              ]
            ]
          }
        }
      ]
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should hoist v-for children if static', () => {
    const { root, args } = transformWithHoist(
      `<div><div v-for="i in list" id="foo"><span/></div></div>`
    )
    expect(root.hoists).toMatchObject([
      createObjectMatcher({
        id: 'foo'
      }),
      {
        callee: CREATE_VNODE,
        arguments: [`"span"`]
      }
    ])
    const forBlockCodegen = args[2][0].codegenNode
    expect(forBlockCodegen).toMatchObject({
      type: NodeTypes.JS_SEQUENCE_EXPRESSION,
      expressions: [
        { callee: OPEN_BLOCK },
        {
          callee: CREATE_BLOCK,
          arguments: [
            FRAGMENT,
            `null`,
            {
              type: NodeTypes.JS_CALL_EXPRESSION,
              callee: RENDER_LIST
            },
            genFlagText(PatchFlags.UNKEYED_FRAGMENT)
          ]
        }
      ]
    })
    const innerBlockCodegen =
      forBlockCodegen.expressions[1].arguments[2].arguments[1].returns
    expect(innerBlockCodegen).toMatchObject({
      type: NodeTypes.JS_SEQUENCE_EXPRESSION,
      expressions: [
        { callee: OPEN_BLOCK },
        {
          callee: CREATE_BLOCK,
          arguments: [
            `"div"`,
            { content: `_hoisted_1` },
            [
              {
                codegenNode: { content: `_hoisted_2` }
              }
            ]
          ]
        }
      ]
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  describe('prefixIdentifiers', () => {
    test('hoist nested static tree with static interpolation', () => {
      const { root, args } = transformWithHoist(
        `<div><span>foo {{ 1 }} {{ true }}</span></div>`,
        {
          prefixIdentifiers: true
        }
      )
      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: CREATE_VNODE,
          arguments: [
            `"span"`,
            `null`,
            [
              {
                type: NodeTypes.TEXT,
                content: `foo `
              },
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `1`,
                  isStatic: false,
                  isConstant: true
                }
              },
              {
                type: NodeTypes.TEXT,
                content: ` `
              },
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `true`,
                  isStatic: false,
                  isConstant: true
                }
              }
            ]
          ]
        }
      ])
      expect(args).toMatchObject([
        `"div"`,
        `null`,
        [
          {
            type: NodeTypes.ELEMENT,
            codegenNode: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `_hoisted_1`
            }
          }
        ]
      ])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('hoist nested static tree with static prop value', () => {
      const { root, args } = transformWithHoist(
        `<div><span :foo="0">{{ 1 }}</span></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: CREATE_VNODE,
          arguments: [
            `"span"`,
            createObjectMatcher({ foo: `[0]` }),
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `1`,
                isStatic: false,
                isConstant: true
              }
            }
          ]
        }
      ])
      expect(args).toMatchObject([
        `"div"`,
        `null`,
        [
          {
            type: NodeTypes.ELEMENT,
            codegenNode: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `_hoisted_1`
            }
          }
        ]
      ])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('hoist class with static object value', () => {
      const { root, args } = transformWithHoist(
        `<div><span :class="{ foo: true }">{{ bar }}</span></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `class`,
                isConstant: true,
                isStatic: true
              },
              value: {
                content: `{ foo: true }`,
                isConstant: true,
                isStatic: false
              }
            }
          ]
        }
      ])
      expect(args).toMatchObject([
        `"div"`,
        `null`,
        [
          {
            type: NodeTypes.ELEMENT,
            codegenNode: {
              callee: CREATE_VNODE,
              arguments: [
                `"span"`,
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: `_hoisted_1`
                },
                {
                  type: NodeTypes.INTERPOLATION,
                  content: {
                    content: `_ctx.bar`,
                    isConstant: false,
                    isStatic: false
                  }
                },
                `1 /* TEXT */`
              ]
            }
          }
        ]
      ])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist expressions that refer scope variables', () => {
      const { root } = transformWithHoist(
        `<div><p v-for="o in list"><span>{{ o }}</span></p></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist expressions that refer scope variables (2)', () => {
      const { root } = transformWithHoist(
        `<div><p v-for="o in list"><span>{{ o + 'foo' }}</span></p></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist expressions that refer scope variables (v-slot)', () => {
      const { root } = transformWithHoist(
        `<Comp v-slot="{ foo }">{{ foo }}</Comp>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist elements with cached handlers', () => {
      const { root } = transformWithHoist(
        `<div><div><div @click="foo"/></div></div>`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true
        }
      )

      expect(root.cached).toBe(1)
      expect(root.hoists.length).toBe(0)
      expect(
        generate(root, {
          mode: 'module',
          prefixIdentifiers: true
        }).code
      ).toMatchSnapshot()
    })
  })
})
