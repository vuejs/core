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

  test('v-on with v-if', () => {
    const { code, ir } = compileWithVIf(
      `<button v-on="{ click: clickEvent }" v-if="true">w/ v-if</button>`,
    )
    expect(code).toMatchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<button>w/ v-if</button>'])

    expect(ir.block.returns).toEqual([0])
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'true',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
    })
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
})
