import {
  baseParse as parse,
  transform,
  NodeTypes,
  generate,
  CompilerOptions,
  VNodeCall,
  IfNode,
  ElementNode,
  ForNode,
  ConstantTypes
} from '../../src'
import {
  FRAGMENT,
  RENDER_LIST,
  CREATE_TEXT,
  NORMALIZE_CLASS
} from '../../src/runtimeHelpers'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformIf } from '../../src/transforms/vIf'
import { transformFor } from '../../src/transforms/vFor'
import { transformBind } from '../../src/transforms/vBind'
import { transformOn } from '../../src/transforms/vOn'
import { createObjectMatcher, genFlagText } from '../testUtils'
import { transformText } from '../../src/transforms/transformText'
import { PatchFlags } from '@vue/shared'

const hoistedChildrenArrayMatcher = (startIndex = 1, length = 1) => ({
  type: NodeTypes.JS_ARRAY_EXPRESSION,
  elements: new Array(length).fill(0).map((_, i) => ({
    type: NodeTypes.ELEMENT,
    codegenNode: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_hoisted_${startIndex + i}`
    }
  }))
})

function transformWithHoist(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    hoistStatic: true,
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformElement,
      transformText
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind
    },
    ...options
  })
  expect(ast.codegenNode).toMatchObject({
    type: NodeTypes.VNODE_CALL,
    isBlock: true
  })
  return ast
}

describe('compiler: hoistStatic transform', () => {
  test('should NOT hoist root node', () => {
    // if the whole tree is static, the root still needs to be a block
    // so that it's patched in optimized mode to skip children
    const root = transformWithHoist(`<div/>`)
    expect(root.hoists.length).toBe(0)
    expect(root.codegenNode).toMatchObject({
      tag: `"div"`
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist simple element', () => {
    const root = transformWithHoist(
      `<div><span class="inline">hello</span></div>`
    )
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"span"`,
        props: createObjectMatcher({ class: 'inline' }),
        children: {
          type: NodeTypes.TEXT,
          content: `hello`
        }
      },
      hoistedChildrenArrayMatcher()
    ])
    expect(root.codegenNode).toMatchObject({
      tag: `"div"`,
      props: undefined,
      children: { content: `_hoisted_2` }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist nested static tree', () => {
    const root = transformWithHoist(`<div><p><span/><span/></p></div>`)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"p"`,
        props: undefined,
        children: [
          { type: NodeTypes.ELEMENT, tag: `span` },
          { type: NodeTypes.ELEMENT, tag: `span` }
        ]
      },
      hoistedChildrenArrayMatcher()
    ])
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      content: '_hoisted_2'
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist nested static tree with comments', () => {
    const root = transformWithHoist(`<div><div><!--comment--></div></div>`)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
        props: undefined,
        children: [{ type: NodeTypes.COMMENT, content: `comment` }]
      },
      hoistedChildrenArrayMatcher()
    ])
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      content: `_hoisted_2`
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist siblings with common non-hoistable parent', () => {
    const root = transformWithHoist(`<div><span/><div/></div>`)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"span"`
      },
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`
      },
      hoistedChildrenArrayMatcher(1, 2)
    ])
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      content: '_hoisted_3'
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist components', () => {
    const root = transformWithHoist(`<div><Comp/></div>`)
    expect(root.hoists.length).toBe(0)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `_component_Comp`
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist element with dynamic props (but hoist the props list)', () => {
    const root = transformWithHoist(`<div><div :id="foo"/></div>`)
    expect(root.hoists.length).toBe(1)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: createObjectMatcher({
            id: `[foo]`
          }),
          children: undefined,
          patchFlag: genFlagText(PatchFlags.PROPS),
          dynamicProps: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`,
            isStatic: false
          }
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist element with static key', () => {
    const root = transformWithHoist(`<div><div key="foo"/></div>`)
    expect(root.hoists.length).toBe(2)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
        props: createObjectMatcher({ key: 'foo' })
      },
      hoistedChildrenArrayMatcher()
    ])
    expect(root.codegenNode).toMatchObject({
      tag: `"div"`,
      props: undefined,
      children: { content: `_hoisted_2` }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist element with dynamic key', () => {
    const root = transformWithHoist(`<div><div :key="foo"/></div>`)
    expect(root.hoists.length).toBe(0)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: createObjectMatcher({
            key: `[foo]`
          })
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT hoist element with dynamic ref', () => {
    const root = transformWithHoist(`<div><div :ref="foo"/></div>`)
    expect(root.hoists.length).toBe(0)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: createObjectMatcher({
            ref: `[foo]`
          }),
          children: undefined,
          patchFlag: genFlagText(PatchFlags.NEED_PATCH)
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with directives', () => {
    const root = transformWithHoist(`<div><div id="foo" v-foo/></div>`)
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`
          },
          children: undefined,
          patchFlag: genFlagText(PatchFlags.NEED_PATCH),
          directives: {
            type: NodeTypes.JS_ARRAY_EXPRESSION
          }
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with dynamic text children', () => {
    const root = transformWithHoist(
      `<div><div id="foo">{{ hello }}</div></div>`
    )
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: { content: `_hoisted_1` },
          children: { type: NodeTypes.INTERPOLATION },
          patchFlag: genFlagText(PatchFlags.TEXT)
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with unhoistable children', () => {
    const root = transformWithHoist(`<div><div id="foo"><Comp/></div></div>`)
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: { content: `_hoisted_1` },
          children: [{ type: NodeTypes.ELEMENT, tag: `Comp` }]
        }
      }
    ])
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should hoist v-if props/children if static', () => {
    const root = transformWithHoist(
      `<div><div v-if="ok" id="foo"><span/></div></div>`
    )
    expect(root.hoists).toMatchObject([
      createObjectMatcher({
        key: `[0]`, // key injected by v-if branch
        id: 'foo'
      }),
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"span"`
      },
      hoistedChildrenArrayMatcher(2)
    ])
    expect(
      ((root.children[0] as ElementNode).children[0] as IfNode).codegenNode
    ).toMatchObject({
      type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
      consequent: {
        // blocks should NOT be hoisted
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
        props: { content: `_hoisted_1` },
        children: { content: `_hoisted_3` }
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should hoist v-for children if static', () => {
    const root = transformWithHoist(
      `<div><div v-for="i in list" id="foo"><span/></div></div>`
    )
    expect(root.hoists).toMatchObject([
      createObjectMatcher({
        id: 'foo'
      }),
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"span"`
      },
      hoistedChildrenArrayMatcher(2)
    ])
    const forBlockCodegen = (
      (root.children[0] as ElementNode).children[0] as ForNode
    ).codegenNode
    expect(forBlockCodegen).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: FRAGMENT,
      props: undefined,
      children: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: RENDER_LIST
      },
      patchFlag: genFlagText(PatchFlags.UNKEYED_FRAGMENT)
    })
    const innerBlockCodegen = forBlockCodegen!.children.arguments[1]
    expect(innerBlockCodegen.returns).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: `"div"`,
      props: { content: `_hoisted_1` },
      children: { content: `_hoisted_3` }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static text node between elements', () => {
    const root = transformWithHoist(`<div>static<div>static</div></div>`)
    expect(root.hoists).toMatchObject([
      {
        callee: CREATE_TEXT,
        arguments: [
          {
            type: NodeTypes.TEXT,
            content: `static`
          }
        ]
      },
      {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: [
          {
            type: NodeTypes.TEXT_CALL
          },
          {
            type: NodeTypes.ELEMENT
          }
        ]
      }
    ])
  })

  describe('prefixIdentifiers', () => {
    test('hoist nested static tree with static interpolation', () => {
      const root = transformWithHoist(
        `<div><span>foo {{ 1 }} {{ true }}</span></div>`,
        {
          prefixIdentifiers: true
        }
      )
      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.VNODE_CALL,
          tag: `"span"`,
          props: undefined,
          children: {
            type: NodeTypes.COMPOUND_EXPRESSION
          }
        },
        hoistedChildrenArrayMatcher()
      ])
      expect(root.codegenNode).toMatchObject({
        tag: `"div"`,
        props: undefined,
        children: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `_hoisted_2`
        }
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('hoist nested static tree with static prop value', () => {
      const root = transformWithHoist(
        `<div><span :foo="0">{{ 1 }}</span></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.VNODE_CALL,
          tag: `"span"`,
          props: createObjectMatcher({ foo: `[0]` }),
          children: {
            type: NodeTypes.INTERPOLATION,
            content: {
              content: `1`,
              isStatic: false,
              constType: ConstantTypes.CAN_STRINGIFY
            }
          }
        },
        hoistedChildrenArrayMatcher()
      ])
      expect(root.codegenNode).toMatchObject({
        tag: `"div"`,
        props: undefined,
        children: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `_hoisted_2`
        }
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('hoist class with static object value', () => {
      const root = transformWithHoist(
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
                isStatic: true,
                constType: ConstantTypes.CAN_STRINGIFY
              },
              value: {
                type: NodeTypes.JS_CALL_EXPRESSION,
                callee: NORMALIZE_CLASS,
                arguments: [
                  {
                    content: `{ foo: true }`,
                    isStatic: false,
                    constType: ConstantTypes.CAN_STRINGIFY
                  }
                ]
              }
            }
          ]
        }
      ])
      expect(root.codegenNode).toMatchObject({
        tag: `"div"`,
        props: undefined,
        children: [
          {
            type: NodeTypes.ELEMENT,
            codegenNode: {
              type: NodeTypes.VNODE_CALL,
              tag: `"span"`,
              props: {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `_hoisted_1`
              },
              children: {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `_ctx.bar`,
                  isStatic: false,
                  constType: ConstantTypes.NOT_CONSTANT
                }
              },
              patchFlag: `1 /* TEXT */`
            }
          }
        ]
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist expressions that refer scope variables', () => {
      const root = transformWithHoist(
        `<div><p v-for="o in list"><span>{{ o }}</span></p></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist expressions that refer scope variables (2)', () => {
      const root = transformWithHoist(
        `<div><p v-for="o in list"><span>{{ o + 'foo' }}</span></p></div>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist expressions that refer scope variables (v-slot)', () => {
      const root = transformWithHoist(
        `<Comp v-slot="{ foo }">{{ foo }}</Comp>`,
        {
          prefixIdentifiers: true
        }
      )

      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist elements with cached handlers', () => {
      const root = transformWithHoist(
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

    test('should NOT hoist elements with cached handlers + other bindings', () => {
      const root = transformWithHoist(
        `<div><div><div :class="{}" @click="foo"/></div></div>`,
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

    test('should NOT hoist keyed template v-for with plain element child', () => {
      const root = transformWithHoist(
        `<div><template v-for="item in items" :key="item"><span/></template></div>`
      )
      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT hoist SVG with directives', () => {
      const root = transformWithHoist(`<div><svg v-foo><path d="M2,3H5.5L12"/></svg></div>`)
      expect(root.hoists.length).toBe(2)
      expect(generate(root).code).toMatchSnapshot()
    })
  })
})
