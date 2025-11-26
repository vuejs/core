import { makeCompile } from './_utils'
import {
  IRNodeTypes,
  type IfIRNode,
  transformChildren,
  transformComment,
  transformElement,
  transformText,
  transformVFor,
  transformVIf,
  transformVOnce,
  transformVText,
} from '../../src'
import { ErrorCodes, NodeTypes, type RootNode } from '@vue/compiler-dom'

const compileWithVIf = makeCompile({
  nodeTransforms: [
    transformVOnce,
    transformVIf,
    transformVFor,
    transformText,
    transformElement,
    transformComment,
    transformChildren,
  ],
  directiveTransforms: {
    text: transformVText,
  },
})

describe('compiler: v-if', () => {
  test('basic v-if', () => {
    const { code, helpers, ir } = compileWithVIf(`<div v-if="ok">{{msg}}</div>`)

    expect(helpers).contains('createIf')

    expect([...ir.template.keys()]).toEqual(['<div> </div>'])

    const op = ir.block.dynamic.children[0].operation
    expect(op).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'ok',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
    })
    expect(ir.block.returns).toEqual([0])

    expect(ir.block.dynamic).toMatchObject({
      children: [{ id: 0 }],
    })

    expect(ir.block.effect).toEqual([])
    expect((op as IfIRNode).positive.effect).lengthOf(1)

    expect(code).matchSnapshot()
  })

  test('multiple v-if at root', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="foo">foo</div><div v-else-if="bar">bar</div><div v-if="baz">baz</div>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).contains(`_template("<div>foo</div>")`)
    expect(code).contains(`_template("<div>bar</div>")`)
    expect(code).contains(`_template("<div>baz</div>")`)
    expect([...ir.template.keys()]).toMatchObject([
      '<div>foo</div>',
      '<div>bar</div>',
      '<div>baz</div>',
    ])
  })

  test('v-if and extra at root', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="foo">foo</div><div v-else-if="bar">bar</div><div>baz</div>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).contains(`_template("<div>foo</div>")`)
    expect(code).contains(`_template("<div>bar</div>")`)
    expect(code).contains(`_template("<div>baz</div>")`)
    expect([...ir.template.keys()]).toMatchObject([
      '<div>foo</div>',
      '<div>bar</div>',
      '<div>baz</div>',
    ])
  })

  test('template v-if', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="ok"><div/>hello<p v-text="msg"/></template>`,
    )
    expect(code).matchSnapshot()

    expect([...ir.template.keys()]).toEqual([
      '<div></div>',
      'hello',
      '<p> </p>',
    ])
    expect(ir.block.effect).toEqual([])
    const op = ir.block.dynamic.children[0].operation as IfIRNode
    expect(op.positive.effect).toMatchObject([
      {
        operations: [
          {
            type: IRNodeTypes.SET_TEXT,
            element: 4,
            values: [
              {
                content: 'msg',
                type: NodeTypes.SIMPLE_EXPRESSION,
                isStatic: false,
              },
            ],
          },
        ],
      },
    ])
    expect(op.positive.dynamic).toMatchObject({
      id: 1,
      children: {
        2: {
          id: 4,
        },
      },
    })
  })

  test('template v-if (text)', () => {
    const { code, ir } = compileWithVIf(`<template v-if="foo">hello</template>`)

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("hello")')
    expect([...ir.template.keys()]).toMatchObject(['hello'])
  })

  test('template v-if (single element)', () => {
    // single element should not wrap with fragment
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div>hi</div></template>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>hi</div>", true)')
    expect([...ir.template.keys()]).toMatchObject(['<div>hi</div>'])
  })

  test('template v-if (multiple element)', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div>hi</div><div>ho</div></template>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>hi</div>")')
    expect(code).toContain('_template("<div>ho</div>")')
    expect([...ir.template.keys()]).toMatchObject([
      '<div>hi</div>',
      '<div>ho</div>',
    ])
  })

  test('template v-if (with v-for inside)', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div v-for="i in list"/></template>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div></div>")')
    expect([...ir.template.keys()]).toMatchObject(['<div></div>'])
  })

  test('template v-if + normal v-else', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div>hi</div><div>ho</div></template><div v-else/>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>hi</div>")')
    expect(code).toContain('_template("<div>ho</div>")')
    expect(code).toContain('_template("<div></div>", true)')
    expect([...ir.template.keys()]).toMatchObject([
      '<div>hi</div>',
      '<div>ho</div>',
      '<div></div>',
    ])
  })

  test('dedupe same template', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="ok">hello</div><div v-if="ok">hello</div>`,
    )
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<div>hello</div>'])
    expect(ir.block.returns).toEqual([0, 3])
  })

  test('v-if with v-once', () => {
    const { code, ir, helpers } = compileWithVIf(
      `<div v-if="ok" v-once>{{ msg }}</div>`,
    )
    expect(code).matchSnapshot()
    expect(helpers).contains('createIf')
    expect([...ir.template.keys()]).toEqual(['<div> </div>'])
  })

  test('component v-if', () => {
    const { code, ir, helpers } = compileWithVIf(
      `<Component v-if="ok"></Component>`,
    )
    expect(code).matchSnapshot()
    expect(helpers).contains('createIf')
    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'ok',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [
            { operation: { asset: true, tag: 'Component', type: 11 } },
          ],
        },
      },
    })
    expect(ir.block.returns).toEqual([0])
  })

  test('v-if + v-else', () => {
    const { code, ir, helpers } = compileWithVIf(`<div v-if="ok"/><p v-else/>`)
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<div></div>', '<p></p>'])

    expect(helpers).contains('createIf')
    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'ok',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
      negative: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 1 }],
        },
      },
    })
    expect(ir.block.returns).toEqual([0])
  })

  test('v-if + v-else-if', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="ok"/><p v-else-if="orNot"/>`,
    )
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<div></div>', '<p></p>'])

    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'ok',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
      negative: {
        type: IRNodeTypes.IF,
        condition: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'orNot',
          isStatic: false,
        },
        positive: {
          type: IRNodeTypes.BLOCK,
          dynamic: {
            children: [{ template: 1 }],
          },
        },
      },
    })
    expect(ir.block.returns).toEqual([0])
  })

  test('v-if + v-else-if + v-else', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="ok"/><p v-else-if="orNot"/><p v-else-if="false"/><template v-else>fine</template>`,
    )
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<div></div>', '<p></p>', 'fine'])

    expect(ir.block.returns).toEqual([0])
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
      negative: {
        type: IRNodeTypes.IF,
        positive: {
          type: IRNodeTypes.BLOCK,
          dynamic: {
            children: [{ template: 1 }],
          },
        },
        negative: {
          type: IRNodeTypes.IF,
          negative: {
            type: IRNodeTypes.BLOCK,
            dynamic: {
              children: [{ template: 2 }],
            },
          },
        },
      },
    })
  })

  test('v-if + v-if / v-else[-if]', () => {
    const { code } = compileWithVIf(
      `<div>
        <span v-if="foo">foo</span>
        <span v-if="bar">bar</span>
        <span v-else>baz</span>
      </div>`,
    )
    expect(code).toMatchSnapshot()
  })

  test('comment between branches', () => {
    const { code, ir } = compileWithVIf(`
      <div v-if="ok"/>
      <!--foo-->
      <p v-else-if="orNot"/>
      <!--bar-->
      <template v-else>fine</template>
      <div v-text="text" />
    `)
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual([
      '<div></div>',
      '<!--foo-->',
      '<p></p>',
      '<!--bar-->',
      'fine',

      '<div> </div>',
    ])
  })

  describe('errors', () => {
    test('error on v-else missing adjacent v-if', () => {
      const onError = vi.fn()

      {
        const { ir } = compileWithVIf(`<div v-else/>`, { onError })
        expect(onError.mock.calls[0]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: ir.node.loc,
          },
        ])
      }

      {
        const { ir } = compileWithVIf(`<div/><div v-else/>`, {
          onError,
        })
        expect(onError.mock.calls[1]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[1].loc,
          },
        ])
      }

      {
        const { ir } = compileWithVIf(`<div/>foo<div v-else/>`, { onError })
        expect(onError.mock.calls[2]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }

      {
        const { ir } = compileWithVIf(`<div v-if="bar"/>foo<div v-else/>`, {
          onError,
        })
        expect(onError.mock.calls[3]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }

      // Non-breaking space
      {
        const { ir } = compileWithVIf(`<div v-if="bar"/>\u00a0<div v-else/>`, {
          onError,
        })
        expect(onError.mock.calls[4]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }
    })

    test('error on v-else-if missing adjacent v-if or v-else-if', () => {
      const onError = vi.fn()
      {
        const { ir } = compileWithVIf(`<div v-else-if="foo"/>`, {
          onError,
        })
        expect(onError.mock.calls[0]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: ir.node.loc,
          },
        ])
      }
      {
        const { ir } = compileWithVIf(`<div/><div v-else-if="foo"/>`, {
          onError,
        })
        expect(onError.mock.calls[1]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[1].loc,
          },
        ])
      }
      {
        const { ir } = compileWithVIf(`<div/>foo<div v-else-if="foo"/>`, {
          onError,
        })
        expect(onError.mock.calls[2]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }
      {
        const { ir } = compileWithVIf(
          `<div v-if="bar"/>foo<div v-else-if="foo"/>`,
          { onError },
        )
        expect(onError.mock.calls[3]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }
      {
        // Non-breaking space
        const { ir } = compileWithVIf(
          `<div v-if="bar"/>\u00a0<div v-else-if="foo"/>`,
          { onError },
        )
        expect(onError.mock.calls[4]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }

      {
        const { ir } = compileWithVIf(
          `<div v-if="notOk"/><div v-else/><div v-else-if="ok"/>`,
          { onError },
        )
        expect(onError.mock.calls[5]).toMatchObject([
          {
            code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
            loc: (ir.block.node as RootNode).children[2].loc,
          },
        ])
      }
    })

    test('error on adjacent v-else', () => {
      const onError = vi.fn()

      const { ir } = compileWithVIf(
        `<div v-if="false"/><div v-else/><div v-else/>`,
        { onError },
      )

      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_V_ELSE_NO_ADJACENT_IF,
          loc: (ir.block.node as RootNode).children[2].loc,
        },
      ])
    })
  })

  // describe('codegen', () => {
  //   function assertSharedCodegen(
  //     node: IfConditionalExpression,
  //     depth: number = 0,
  //     hasElse: boolean = false,
  //   ) {
  //     expect(node).toMatchObject({
  //       type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
  //       test: {
  //         content: `ok`,
  //       },
  //       consequent: {
  //         type: NodeTypes.VNODE_CALL,
  //         isBlock: true,
  //       },
  //       alternate:
  //         depth < 1
  //           ? hasElse
  //             ? {
  //                 type: NodeTypes.VNODE_CALL,
  //                 isBlock: true,
  //               }
  //             : {
  //                 type: NodeTypes.JS_CALL_EXPRESSION,
  //                 callee: CREATE_COMMENT,
  //               }
  //           : {
  //               type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
  //               test: {
  //                 content: `orNot`,
  //               },
  //               consequent: {
  //                 type: NodeTypes.VNODE_CALL,
  //                 isBlock: true,
  //               },
  //               alternate: hasElse
  //                 ? {
  //                     type: NodeTypes.VNODE_CALL,
  //                     isBlock: true,
  //                   }
  //                 : {
  //                     type: NodeTypes.JS_CALL_EXPRESSION,
  //                     callee: CREATE_COMMENT,
  //                   },
  //             },
  //     })
  //   }

  //   test('basic v-if', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok"/>`)
  //     assertSharedCodegen(codegenNode)
  //     expect(codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     expect(codegenNode.alternate).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: CREATE_COMMENT,
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('template v-if', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(`<template v-if="ok"><div/>hello<p/></template>`)
  //     assertSharedCodegen(codegenNode)
  //     expect(codegenNode.consequent).toMatchObject({
  //       tag: FRAGMENT,
  //       props: createObjectMatcher({ key: `[0]` }),
  //       children: [
  //         { type: NodeTypes.ELEMENT, tag: 'div' },
  //         { type: NodeTypes.TEXT, content: `hello` },
  //         { type: NodeTypes.ELEMENT, tag: 'p' },
  //       ],
  //     })
  //     expect(codegenNode.alternate).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: CREATE_COMMENT,
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('template v-if w/ single <slot/> child', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(`<template v-if="ok"><slot/></template>`)
  //     expect(codegenNode.consequent).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: RENDER_SLOT,
  //       arguments: ['$slots', '"default"', createObjectMatcher({ key: `[0]` })],
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('v-if on <slot/>', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(`<slot v-if="ok"></slot>`)
  //     expect(codegenNode.consequent).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: RENDER_SLOT,
  //       arguments: ['$slots', '"default"', createObjectMatcher({ key: `[0]` })],
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('v-if + v-else', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok"/><p v-else/>`)
  //     assertSharedCodegen(codegenNode, 0, true)
  //     expect(codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     expect(codegenNode.alternate).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[1]` }),
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('v-if + v-else-if', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok"/><p v-else-if="orNot" />`)
  //     assertSharedCodegen(codegenNode, 1)
  //     expect(codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     const branch2 = codegenNode.alternate as ConditionalExpression
  //     expect(branch2.consequent).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[1]` }),
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('v-if + v-else-if + v-else', () => {
  //     const {
  //       root,
  //       node: { codegenNode },
  //     } = compileWithVIf(
  //       `<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`,
  //     )
  //     assertSharedCodegen(codegenNode, 1, true)
  //     expect(codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     const branch2 = codegenNode.alternate as ConditionalExpression
  //     expect(branch2.consequent).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[1]` }),
  //     })
  //     expect(branch2.alternate).toMatchObject({
  //       tag: FRAGMENT,
  //       props: createObjectMatcher({ key: `[2]` }),
  //       children: [
  //         {
  //           type: NodeTypes.TEXT,
  //           content: `fine`,
  //         },
  //       ],
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('multiple v-if that are sibling nodes should have different keys', () => {
  //     const { root } = compileWithVIf(
  //       `<div v-if="ok"/><p v-if="orNot"/>`,
  //       {},
  //       0 /* returnIndex, just give the default value */,
  //       2 /* childrenLen */,
  //     )

  //     const ifNode = root.children[0] as IfNode & {
  //       codegenNode: IfConditionalExpression
  //     }
  //     expect(ifNode.codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     const ifNode2 = root.children[1] as IfNode & {
  //       codegenNode: IfConditionalExpression
  //     }
  //     expect(ifNode2.codegenNode.consequent).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[1]` }),
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('increasing key: v-if + v-else-if + v-else', () => {
  //     const { root } = compileWithVIf(
  //       `<div v-if="ok"/><p v-else/><div v-if="another"/><p v-else-if="orNot"/><p v-else/>`,
  //       {},
  //       0 /* returnIndex, just give the default value */,
  //       2 /* childrenLen */,
  //     )
  //     const ifNode = root.children[0] as IfNode & {
  //       codegenNode: IfConditionalExpression
  //     }
  //     expect(ifNode.codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     expect(ifNode.codegenNode.alternate).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[1]` }),
  //     })
  //     const ifNode2 = root.children[1] as IfNode & {
  //       codegenNode: IfConditionalExpression
  //     }
  //     expect(ifNode2.codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[2]` }),
  //     })
  //     const branch = ifNode2.codegenNode.alternate as IfConditionalExpression
  //     expect(branch.consequent).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[3]` }),
  //     })
  //     expect(branch.alternate).toMatchObject({
  //       tag: `"p"`,
  //       props: createObjectMatcher({ key: `[4]` }),
  //     })
  //     expect(generate(root).code).toMatchSnapshot()
  //   })

  //   test('key injection (only v-bind)', () => {
  //     const {
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok" v-bind="obj"/>`)
  //     const branch1 = codegenNode.consequent as VNodeCall
  //     expect(branch1.props).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: NORMALIZE_PROPS,
  //       arguments: [
  //         {
  //           type: NodeTypes.JS_CALL_EXPRESSION,
  //           callee: MERGE_PROPS,
  //           arguments: [
  //             createObjectMatcher({ key: `[0]` }),
  //             { content: `obj` },
  //           ],
  //         },
  //       ],
  //     })
  //   })

  //   test('key injection (before v-bind)', () => {
  //     const {
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok" id="foo" v-bind="obj"/>`)
  //     const branch1 = codegenNode.consequent as VNodeCall
  //     expect(branch1.props).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: MERGE_PROPS,
  //       arguments: [
  //         createObjectMatcher({
  //           key: '[0]',
  //           id: 'foo',
  //         }),
  //         { content: `obj` },
  //       ],
  //     })
  //   })

  //   test('key injection (after v-bind)', () => {
  //     const {
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok" v-bind="obj" id="foo"/>`)
  //     const branch1 = codegenNode.consequent as VNodeCall
  //     expect(branch1.props).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: MERGE_PROPS,
  //       arguments: [
  //         createObjectMatcher({ key: `[0]` }),
  //         { content: `obj` },
  //         createObjectMatcher({
  //           id: 'foo',
  //         }),
  //       ],
  //     })
  //   })

  //   test('key injection (w/ custom directive)', () => {
  //     const {
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok" v-foo />`)
  //     const branch1 = codegenNode.consequent as VNodeCall
  //     expect(branch1.directives).not.toBeUndefined()
  //     expect(branch1.props).toMatchObject(createObjectMatcher({ key: `[0]` }))
  //   })

  //   // #6631
  //   test('avoid duplicate keys', () => {
  //     const {
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok" key="custom_key" v-bind="obj"/>`)
  //     const branch1 = codegenNode.consequent as VNodeCall
  //     expect(branch1.props).toMatchObject({
  //       type: NodeTypes.JS_CALL_EXPRESSION,
  //       callee: MERGE_PROPS,
  //       arguments: [
  //         createObjectMatcher({
  //           key: 'custom_key',
  //         }),
  //         { content: `obj` },
  //       ],
  //     })
  //   })

  //   test('with spaces between branches', () => {
  //     const {
  //       node: { codegenNode },
  //     } = compileWithVIf(`<div v-if="ok"/> <div v-else-if="no"/> <div v-else/>`)
  //     expect(codegenNode.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[0]` }),
  //     })
  //     const branch = codegenNode.alternate as ConditionalExpression
  //     expect(branch.consequent).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[1]` }),
  //     })
  //     expect(branch.alternate).toMatchObject({
  //       tag: `"div"`,
  //       props: createObjectMatcher({ key: `[2]` }),
  //     })
  //   })

  //   test('with comments', () => {
  //     const { node } = compileWithVIf(`
  //         <template v-if="ok">
  //           <!--comment1-->
  //           <div v-if="ok2">
  //             <!--comment2-->
  //           </div>
  //           <!--comment3-->
  //           <b v-else/>
  //           <!--comment4-->
  //           <p/>
  //         </template>
  //       `)
  //     expect(node.type).toBe(NodeTypes.IF)
  //     expect(node.branches.length).toBe(1)

  //     const b1 = node.branches[0]
  //     expect((b1.condition as SimpleExpressionNode).content).toBe(`ok`)
  //     expect(b1.children.length).toBe(4)

  //     expect(b1.children[0].type).toBe(NodeTypes.COMMENT)
  //     expect((b1.children[0] as CommentNode).content).toBe(`comment1`)

  //     expect(b1.children[1].type).toBe(NodeTypes.IF)
  //     expect((b1.children[1] as IfNode).branches.length).toBe(2)
  //     const b1b1: ElementNode = (b1.children[1] as IfNode).branches[0]
  //       .children[0] as ElementNode
  //     expect(b1b1.type).toBe(NodeTypes.ELEMENT)
  //     expect(b1b1.tag).toBe('div')
  //     expect(b1b1.children[0].type).toBe(NodeTypes.COMMENT)
  //     expect((b1b1.children[0] as CommentNode).content).toBe('comment2')

  //     const b1b2: IfBranchNode = (b1.children[1] as IfNode)
  //       .branches[1] as IfBranchNode
  //     expect(b1b2.children[0].type).toBe(NodeTypes.COMMENT)
  //     expect((b1b2.children[0] as CommentNode).content).toBe(`comment3`)
  //     expect(b1b2.children[1].type).toBe(NodeTypes.ELEMENT)
  //     expect((b1b2.children[1] as ElementNode).tag).toBe(`b`)

  //     expect(b1.children[2].type).toBe(NodeTypes.COMMENT)
  //     expect((b1.children[2] as CommentNode).content).toBe(`comment4`)

  //     expect(b1.children[3].type).toBe(NodeTypes.ELEMENT)
  //     expect((b1.children[3] as ElementNode).tag).toBe(`p`)
  //   })

  //   // #6843
  //   test('should parse correctly with comments: true in prod', () => {
  //     __DEV__ = false
  //     compileWithVIf(
  //       `
  //         <template v-if="ok">
  //           <!--comment1-->
  //           <div v-if="ok2">
  //             <!--comment2-->
  //           </div>
  //           <!--comment3-->
  //           <b v-else/>
  //           <!--comment4-->
  //           <p/>
  //         </template>
  //       `,
  //       { comments: true },
  //     )
  //     __DEV__ = true
  //   })
  // })

  // test('v-on with v-if', () => {
  //   const {
  //     node: { codegenNode },
  //   } = compileWithVIf(
  //     `<button v-on="{ click: clickEvent }" v-if="true">w/ v-if</button>`,
  //   )

  //   expect((codegenNode.consequent as any).props.type).toBe(
  //     NodeTypes.JS_CALL_EXPRESSION,
  //   )
  //   expect((codegenNode.consequent as any).props.callee).toBe(MERGE_PROPS)
  //   expect(
  //     (codegenNode.consequent as any).props.arguments[0].properties[0].value
  //       .content,
  //   ).toBe('0')
  //   expect((codegenNode.consequent as any).props.arguments[1].callee).toBe(
  //     TO_HANDLERS,
  //   )
  // })
})
