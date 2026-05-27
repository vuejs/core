import { makeCompile } from './_utils'
import {
  IRNodeTypes,
  type IfIRNode,
  transformChildren,
  transformComment,
  transformElement,
  transformTemplateRef,
  transformText,
  transformVFor,
  transformVIf,
  transformVOnce,
  transformVText,
} from '../../src'
import { ErrorCodes, NodeTypes, type RootNode } from '@vue/compiler-dom'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'

const singleRootNoScope =
  VaporBlockShape.SINGLE_ROOT | VaporIfFlags.TRUE_NO_SCOPE
const singleRootIfElseNoScope =
  VaporBlockShape.SINGLE_ROOT |
  (VaporBlockShape.SINGLE_ROOT << 2) |
  VaporIfFlags.TRUE_NO_SCOPE |
  VaporIfFlags.FALSE_NO_SCOPE

const compileWithVIf = makeCompile({
  nodeTransforms: [
    transformVOnce,
    transformVIf,
    transformVFor,
    transformText,
    transformTemplateRef,
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

    expect([...ir.template.keys()]).toEqual(['<div> '])

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
    expect((op as IfIRNode).blockShape).toBe(VaporBlockShape.SINGLE_ROOT)

    expect(code).matchSnapshot()
  })

  test('omits default single-root flags when branch needs scope', () => {
    const { code } = compileWithVIf(`<div v-if="ok">{{ msg }}</div>`)

    expect(code).contains(`const n0 = _createIf(() => (_ctx.ok), () => {`)
    expect(code).not.contains(`}, null, 1)`)
  })

  test('marks pure static single-root branch as no-scope', () => {
    const { code } = compileWithVIf(`<div v-if="ok">static</div>`)

    expect(code).contains(
      `}, null, ${singleRootNoScope} /* BLOCK_SHAPE, TRUE_NO_SCOPE */)`,
    )
  })

  test('marks pure static multi-root branch as no-scope', () => {
    const { code } = compileWithVIf(
      `<template v-if="ok"><div>one</div><p>two</p></template>`,
    )

    expect(code).contains(
      `}, null, ${VaporBlockShape.MULTI_ROOT | VaporIfFlags.TRUE_NO_SCOPE} /* BLOCK_SHAPE, TRUE_NO_SCOPE */)`,
    )
  })

  test('packs once flag', () => {
    const { code } = compileWithVIf(`<div v-if="ok" v-once />`)

    expect(code).contains(`}, null, 17 /* BLOCK_SHAPE, ONCE */)`)
    expect(code).not.contains(`}, null, 1, true)`)
  })

  test('packs branch index', () => {
    const { code } = compileWithVIf(
      `<div v-if="foo">foo</div><div v-else>bar</div>`,
    )

    expect(code).contains(
      `}, ${singleRootIfElseNoScope | (1 << VaporIfFlags.INDEX_SHIFT)} /* BLOCK_SHAPE, TRUE_NO_SCOPE, FALSE_NO_SCOPE, INDEX_SHIFT */)`,
    )
    expect(code).not.contains(`}, 5, null, 0)`)
  })

  test('does not mark scoped branches as no-scope', () => {
    const cases = [
      `<div v-if="ok">{{ msg }}</div>`,
      `<div v-if="ok" :class="foo"></div>`,
      `<div v-if="ok" @click="foo"></div>`,
      `<Comp v-if="ok" />`,
      `<div v-if="ok" ref="el"></div>`,
      `<template v-if="ok"><div/>{{ msg }}</template>`,
      `<div v-if="ok"><span v-if="bar" /></div>`,
    ]

    for (const source of cases) {
      const { code } = compileWithVIf(source)
      expect(code.includes('NO_SCOPE'), source).toBe(false)
      expect(code.includes(`, ${singleRootNoScope} /*`), source).toBe(false)
    }
  })

  test('multiple v-if at root', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="foo">foo</div><div v-else-if="bar">bar</div><div v-if="baz">baz</div>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).contains(`_template("<div>foo", 2)`)
    expect(code).contains(`_template("<div>bar", 2)`)
    expect(code).contains(`_template("<div>baz", 2)`)
    expect([...ir.template.keys()]).toMatchObject([
      '<div>foo',
      '<div>bar',
      '<div>baz',
    ])
  })

  test('v-if and extra at root', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="foo">foo</div><div v-else-if="bar">bar</div><div>baz</div>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).contains(`_template("<div>foo", 2)`)
    expect(code).contains(`_template("<div>bar", 2)`)
    expect(code).contains(`_template("<div>baz", 2)`)
    expect([...ir.template.keys()]).toMatchObject([
      '<div>foo',
      '<div>bar',
      '<div>baz',
    ])
  })

  test('template v-if', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="ok"><div/>hello<p v-text="msg"/></template>`,
    )
    expect(code).matchSnapshot()

    expect([...ir.template.keys()]).toEqual(['<div>', 'hello', '<p> '])
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
    expect(code).contains(
      `}, null, ${singleRootNoScope} /* BLOCK_SHAPE, TRUE_NO_SCOPE */)`,
    )
    expect(code).toContain('_template("hello", 2)')
    expect([...ir.template.keys()]).toMatchObject(['hello'])
  })

  test('template v-if (single element)', () => {
    // single element should not wrap with fragment
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div>hi</div></template>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>hi", 3)')
    expect([...ir.template.keys()]).toMatchObject(['<div>hi'])
  })

  test('template v-if (multiple element)', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div>hi</div><div>ho</div></template>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>hi", 2)')
    expect(code).toContain('_template("<div>ho", 2)')
    expect([...ir.template.keys()]).toMatchObject(['<div>hi', '<div>ho'])
    expect(
      (ir.block.dynamic.children[0].operation as IfIRNode).blockShape,
    ).toBe(VaporBlockShape.MULTI_ROOT | VaporIfFlags.TRUE_NO_SCOPE)
  })

  test('template v-if (with v-for inside)', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div v-for="i in list"/></template>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>")')
    expect([...ir.template.keys()]).toMatchObject(['<div>'])
  })

  test('template v-if (with v-for on same element)', () => {
    const { code, ir, helpers } = compileWithVIf(
      `<template v-if="arr.length > 0" v-for="(item, index) in arr" :key="index">
        <div>item: {{ item }}</div>
      </template>`,
    )

    expect(code).toMatchSnapshot()
    // should generate both createIf and createFor
    expect(helpers).toContain('createIf')
    expect(helpers).toContain('createFor')
    // v-if should wrap v-for
    const op = ir.block.dynamic.children[0].operation
    expect(op).toMatchObject({
      type: IRNodeTypes.IF,
    })
  })

  test('v-if in template v-for forces MULTI_ROOT shape', () => {
    const { ir, helpers } = compileWithVIf(
      `<template v-for="item in list">
        <span v-if="item.ok">
          <span>{{ item.text }}</span>
        </span>
      </template>`,
    )

    expect(helpers).toContain('createIf')
    expect(helpers).toContain('createFor')

    const forOp = ir.block.dynamic.children[0].operation
    expect(forOp).toMatchObject({
      type: IRNodeTypes.FOR,
    })

    const ifOp = (forOp as any).render.dynamic.children[0].operation as IfIRNode
    expect(ifOp.blockShape).toBe(
      VaporBlockShape.MULTI_ROOT | (VaporBlockShape.MULTI_ROOT << 2),
    )
  })

  test('template v-if + normal v-else', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="foo"><div>hi</div><div>ho</div></template><div v-else/>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain('_template("<div>hi", 2)')
    expect(code).toContain('_template("<div>ho", 2)')
    expect(code).toContain('_template("<div>", 3)')
    expect([...ir.template.keys()]).toMatchObject([
      '<div>hi',
      '<div>ho',
      '<div>',
    ])
    expect(
      (ir.block.dynamic.children[0].operation as IfIRNode).blockShape,
    ).toBe(
      VaporBlockShape.MULTI_ROOT |
        (VaporBlockShape.SINGLE_ROOT << 2) |
        VaporIfFlags.TRUE_NO_SCOPE |
        VaporIfFlags.FALSE_NO_SCOPE,
    )
  })

  test('dedupe same template', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="ok">hello</div><div v-if="ok">hello</div>`,
    )
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<div>hello'])
    expect(ir.block.returns).toEqual([0, 3])
  })

  test('v-if with v-once', () => {
    const { code, ir, helpers } = compileWithVIf(
      `<div v-if="ok" v-once>{{ msg }}</div>`,
    )
    expect(code).matchSnapshot()
    expect(helpers).contains('createIf')
    expect([...ir.template.keys()]).toEqual(['<div> '])
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
            {
              operation: {
                asset: true,
                tag: 'Component',
                type: IRNodeTypes.CREATE_COMPONENT_NODE,
              },
            },
          ],
        },
      },
    })
    expect(ir.block.returns).toEqual([0])
  })

  test('v-if + v-else', () => {
    const { code, ir, helpers } = compileWithVIf(`<div v-if="ok"/><p v-else/>`)
    expect(code).matchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<div>', '<p>'])

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
    expect([...ir.template.keys()]).toEqual(['<div>', '<p>'])

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
    expect([...ir.template.keys()]).toEqual(['<div>', '<p>', 'fine'])

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

    const op = ir.block.dynamic.children[0].operation as IfIRNode
    const nested = op.negative as IfIRNode
    const innermost = nested.negative as IfIRNode
    const noScopeOrSingle =
      VaporBlockShape.SINGLE_ROOT |
      (VaporBlockShape.SINGLE_ROOT << 2) |
      VaporIfFlags.TRUE_NO_SCOPE

    expect(op.blockShape).toBe(noScopeOrSingle)
    expect(nested.blockShape).toBe(noScopeOrSingle)
    expect(innermost.blockShape).toBe(singleRootIfElseNoScope)
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
      '<div>',
      '<!--foo-->',
      '<p>',
      '<!--bar-->',
      'fine',

      '<div> ',
    ])
  })

  test('v-on with v-if', () => {
    const { code, ir } = compileWithVIf(
      `<button v-on="{ click: clickEvent }" v-if="true">w/ v-if</button>`,
    )
    expect(code).toMatchSnapshot()
    expect([...ir.template.keys()]).toEqual(['<button>w/ v-if'])

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
