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
      `}, null, ${singleRootNoScope} /* TRUE_SINGLE_ROOT, TRUE_NO_SCOPE */)`,
    )
  })

  test('marks pure static multi-root branch as no-scope', () => {
    const { code } = compileWithVIf(
      `<template v-if="ok"><div>one</div><p>two</p></template>`,
    )

    expect(code).contains(
      `}, null, ${VaporBlockShape.MULTI_ROOT | VaporIfFlags.TRUE_NO_SCOPE} /* TRUE_MULTI_ROOT, TRUE_NO_SCOPE */)`,
    )
  })

  test('packs once flag', () => {
    const { code } = compileWithVIf(`<div v-if="ok" v-once />`)

    expect(code).contains(`}, null, 17 /* TRUE_SINGLE_ROOT, ONCE */)`)
    expect(code).not.contains(`}, null, 1, true)`)
  })

  test('packs branch index', () => {
    const { code } = compileWithVIf(
      `<div v-if="foo">foo</div><div v-else>bar</div>`,
    )

    expect(code).contains(
      `}, ${singleRootIfElseNoScope | (1 << VaporIfFlags.INDEX_SHIFT)} /* TRUE_SINGLE_ROOT, FALSE_SINGLE_ROOT, TRUE_NO_SCOPE, FALSE_NO_SCOPE, KEYED_INDEX_0 */)`,
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
      `}, null, ${VaporBlockShape.MULTI_ROOT | VaporIfFlags.TRUE_NO_SCOPE} /* TRUE_MULTI_ROOT, TRUE_NO_SCOPE */)`,
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
    expect(innermost.blockShape).toBe(
      VaporBlockShape.SINGLE_ROOT |
        (VaporBlockShape.MULTI_ROOT << 2) |
        VaporIfFlags.TRUE_NO_SCOPE |
        VaporIfFlags.FALSE_NO_SCOPE,
    )
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

    test('error on same key in v-if/else branches', () => {
      const codes = (src: string) => {
        const onError = vi.fn()
        compileWithVIf(src, { onError })
        return onError.mock.calls.map(([e]) => e.code)
      }

      expect(codes(`<Comp v-if="ok" key="k"/><Comp2 v-else key="k"/>`)).toEqual(
        [ErrorCodes.X_V_IF_SAME_KEY],
      )
      expect(
        codes(
          `<Comp v-if="ok" key="a"/><Comp2 v-else-if="ok2" key="k"/><Comp3 v-else key="k"/>`,
        ),
      ).toEqual([ErrorCodes.X_V_IF_SAME_KEY])
      expect(
        codes(
          `<Comp v-if="ok" key="k"/><Comp2 v-else-if="ok2" key="b"/><Comp3 v-else key="k"/>`,
        ),
      ).toEqual([ErrorCodes.X_V_IF_SAME_KEY])
      expect(codes(`<div v-if="ok" key="k"/><div v-else key="k"/>`)).toEqual([
        ErrorCodes.X_V_IF_SAME_KEY,
      ])
      expect(
        codes(
          `<template v-if="ok" key="k"><div/></template><template v-else key="k"><div/></template>`,
        ),
      ).toEqual([ErrorCodes.X_V_IF_SAME_KEY])

      // a duplicated dynamic key is caught as well
      expect(
        codes(`<Comp v-if="ok" :key="k"/><Comp2 v-else :key="k"/>`),
      ).toEqual([ErrorCodes.X_V_IF_SAME_KEY])
    })

    test('no error on unique keys in v-if/else branches', () => {
      const codes = (src: string) => {
        const onError = vi.fn()
        compileWithVIf(src, { onError })
        return onError.mock.calls.map(([e]) => e.code)
      }

      expect(codes(`<Comp v-if="ok" key="a"/><Comp2 v-else key="b"/>`)).toEqual(
        [],
      )
      expect(codes(`<Comp v-if="ok" key="a"/><Comp2 v-else/>`)).toEqual([])
      expect(codes(`<Comp v-if="ok"/><Comp2 v-else key="b"/>`)).toEqual([])
      expect(
        codes(`<Comp v-if="ok" :key="a"/><Comp2 v-else :key="b"/>`),
      ).toEqual([])
      // two independent v-if chains may reuse the same key
      expect(
        codes(
          `<Comp v-if="ok" key="k"/><Comp2 v-else key="q"/><Comp3 v-if="ok2" key="k"/><Comp4 v-else key="r"/>`,
        ),
      ).toEqual([])
    })
  })

  test('whitespace between branches', () => {
    const { ir } = compileWithVIf(
      `<div><span v-if="a">a</span> <span v-else-if="b">b</span> <span v-else>c</span>|</div>`,
    )
    expect([...ir.template.keys()]).toEqual([
      '<span>a',
      '<span>b',
      '<span>c',
      '<div><!>|',
    ])

    const { ir: preserved } = compileWithVIf(
      `<div>
        <span v-if="a">a</span>
        <span v-else>b</span>
      </div>`,
      { whitespace: 'preserve' },
    )
    expect([...preserved.template.keys()]).toEqual([
      '<span>a',
      '<span>b',
      '<div>',
    ])
  })
})

describe('compiler: long v-else-if chain', () => {
  // `v-if` + `elseIfs` × `v-else-if` (+ `v-else`), one `<div>` per branch
  function chain(
    elseIfs: number,
    {
      withElse = true,
      branch = (i: number, dir: string) => `<div ${dir}>${i}</div>`,
    }: {
      withElse?: boolean
      branch?: (i: number, dir: string) => string
    } = {},
  ) {
    let src = ''
    for (let i = 0; i <= elseIfs; i++) {
      src += branch(i, i === 0 ? `v-if="c${i}"` : `v-else-if="c${i}"`)
    }
    if (withElse) src += branch(elseIfs + 1, 'v-else')
    return src
  }

  test('nests up to the threshold', () => {
    const { code, helpers } = compileWithVIf(chain(10))
    expect(helpers).not.contains('createIfChain')
    expect(code).contains('() => _createIf(')
  })

  test('flattens past the threshold', () => {
    const { code, ir, helpers } = compileWithVIf(chain(11))
    expect(helpers).contains('createIfChain')
    expect(helpers).not.contains('createIf')
    expect(code).matchSnapshot()

    const op = ir.block.dynamic.children[0].operation as IfIRNode
    // 12 `v-if` nodes took indexes 0-11; the chain's 13 keys span 7 indexes
    expect(op.index).toBe(12)
    expect(op.once).toBe(false)
    expect(code).contains(
      `${(12 + 1) << VaporIfFlags.INDEX_SHIFT} /* KEYED_INDEX_12 */`,
    )
  })

  test('keeps the numbering of the chains around it', () => {
    const { code } = compileWithVIf(
      `<div v-if="a">a</div><div v-else>b</div>` +
        chain(11) +
        `<div v-if="z">z</div><div v-else>y</div>`,
    )
    expect(code).contains('KEYED_INDEX_0 */')
    expect(code).contains('KEYED_INDEX_13 */')
    // reserved after everything else: 14 nodes before it, 7 indexes
    expect(code).contains('KEYED_INDEX_14 */')
  })

  test('selects the empty state without v-else', () => {
    const { code } = compileWithVIf(
      chain(11, {
        withElse: false,
        branch: (i, dir) =>
          i === 11 ? `<template ${dir}><p/><p/></template>` : `<div ${dir}/>`,
      }),
    )
    expect(code).contains(': (_ctx.c11) ? 11')
    expect(code).contains(': 12, [')
    expect(code).contains(
      `], [33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 33 /* SINGLE_ROOT, NO_SCOPE */, 34 /* MULTI_ROOT, NO_SCOPE */, 0 /* EMPTY */], `,
    )
  })

  test('omits default branch flags', () => {
    const { code } = compileWithVIf(
      chain(11, { branch: (i, dir) => `<div ${dir}>{{ m${i} }}</div>` }),
    )
    expect(code).contains('}], null, ')
    const { code: noElse } = compileWithVIf(
      chain(11, {
        withElse: false,
        branch: (i, dir) => `<div ${dir}>{{ m${i} }}</div>`,
      }),
    )
    expect(noElse).contains('}], null, ')
  })

  test('forces multi-root on every state inside template v-for', () => {
    const { code } = compileWithVIf(
      `<template v-for="i in list">${chain(11, { withElse: false })}</template>`,
    )
    expect(code).contains(
      '2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */, 2 /* MULTI_ROOT */]',
    )
  })

  test('static conditions keep the selector live', () => {
    const { code } = compileWithVIf(
      chain(11).replace('v-if="c0"', 'v-if="false"'),
    )
    expect(code).contains('() => (false) ? 0')
    expect(code).not.contains('ONCE')
  })

  test('v-once on a branch freezes that branch only', () => {
    const { code } = compileWithVIf(
      chain(11, {
        branch: (i, dir) => `<div ${dir}>{{ m${i} }}</div>`,
      }).replace('v-else-if="c5"', 'v-else-if="c5" v-once'),
    )
    expect(code).not.contains('ONCE')
    expect(code.match(/_renderEffect\(/g)!.length).toBe(12)
    expect(code).toMatch(/\n\s*_setText\(\w+, _toDisplayString\(_ctx\.m5\)\)/)
  })

  test('v-once on the head freezes the selection', () => {
    const { code } = compileWithVIf(
      chain(11).replace('v-if="c0"', 'v-if="c0" v-once'),
    )
    expect(code).contains('], 16 /* ONCE */)')
    const { code: inVOnce } = compileWithVIf(`<div v-once>${chain(11)}</div>`)
    expect(inVOnce).contains('], 16 /* ONCE */)')
  })
})
