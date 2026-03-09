import {
  type CompilerOptions,
  ConstantTypes,
  type ElementNode,
  type ForNode,
  type IfNode,
  NodeTypes,
  type VNodeCall,
  generate,
  baseParse as parse,
  transform,
} from '../../src'
import {
  FRAGMENT,
  NORMALIZE_CLASS,
  RENDER_LIST,
} from '../../src/runtimeHelpers'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformIf } from '../../src/transforms/vIf'
import { transformFor } from '../../src/transforms/vFor'
import { transformBind } from '../../src/transforms/vBind'
import { transformOn } from '../../src/transforms/vOn'
import { createObjectMatcher } from '../testUtils'
import { transformText } from '../../src/transforms/transformText'
import { PatchFlags } from '@vue/shared'

const cachedChildrenArrayMatcher = (
  tags: string[],
  needArraySpread = false,
) => ({
  type: NodeTypes.JS_CACHE_EXPRESSION,
  needArraySpread,
  value: {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    elements: tags.map(tag => {
      if (tag === '') {
        return {
          type: NodeTypes.TEXT_CALL,
        }
      } else {
        return {
          type: NodeTypes.ELEMENT,
          codegenNode: {
            type: NodeTypes.VNODE_CALL,
            tag: JSON.stringify(tag),
          },
        }
      }
    }),
  },
})

function transformWithCache(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    hoistStatic: true,
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformElement,
      transformText,
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind,
    },
    ...options,
  })
  expect(ast.codegenNode).toMatchObject({
    type: NodeTypes.VNODE_CALL,
    isBlock: true,
  })
  return ast
}

describe('compiler: cacheStatic transform', () => {
  test('should NOT cache root node', () => {
    // if the whole tree is static, the root still needs to be a block
    // so that it's patched in optimized mode to skip children
    const root = transformWithCache(`<div/>`)
    expect(root.codegenNode).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: `"div"`,
    })
    expect(root.cached.length).toBe(0)
  })

  test('cache root node children', () => {
    // we don't have access to the root codegenNode during the transform
    // so we only cache each child individually
    const root = transformWithCache(
      `<span class="inline">hello</span><span class="inline">hello</span>`,
    )
    expect(root.codegenNode).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      children: [
        { codegenNode: { type: NodeTypes.JS_CACHE_EXPRESSION } },
        { codegenNode: { type: NodeTypes.JS_CACHE_EXPRESSION } },
      ],
    })
    expect(root.cached.length).toBe(2)
  })

  test('cache single children array', () => {
    const root = transformWithCache(
      `<div><span class="inline">hello</span></div>`,
    )
    expect(root.codegenNode).toMatchObject({
      tag: `"div"`,
      props: undefined,
      children: cachedChildrenArrayMatcher(['span']),
    })
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('cache nested children array', () => {
    const root = transformWithCache(
      `<div><p><span/><span/></p><p><span/><span/></p></div>`,
    )
    expect((root.codegenNode as VNodeCall).children).toMatchObject(
      cachedChildrenArrayMatcher(['p', 'p']),
    )
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('cache nested static tree with comments', () => {
    const root = transformWithCache(`<div><div><!--comment--></div></div>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject(
      cachedChildrenArrayMatcher(['div']),
    )
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('cache siblings including text with common non-hoistable parent', () => {
    const root = transformWithCache(`<div><span/>foo<div/></div>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject(
      cachedChildrenArrayMatcher(['span', '', 'div']),
    )
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('cache inside default slot', () => {
    const root = transformWithCache(`<Foo>{{x}}<span/></Foo>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      properties: [
        {
          key: { content: 'default' },
          value: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            returns: [
              {
                type: NodeTypes.TEXT_CALL,
              },
              // first slot child cached
              {
                type: NodeTypes.ELEMENT,
                codegenNode: {
                  type: NodeTypes.JS_CACHE_EXPRESSION,
                },
              },
            ],
          },
        },
        {
          /* _ slot flag */
        },
      ],
    })
  })

  test('cache default slot as a whole', () => {
    const root = transformWithCache(`<Foo><span/><span/></Foo>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      properties: [
        {
          key: { content: 'default' },
          value: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            returns: {
              type: NodeTypes.JS_CACHE_EXPRESSION,
              value: {
                type: NodeTypes.JS_ARRAY_EXPRESSION,
                elements: [
                  { type: NodeTypes.ELEMENT },
                  { type: NodeTypes.ELEMENT },
                ],
              },
            },
          },
        },
        {
          /* _ slot flag */
        },
      ],
    })
  })

  test('cache inside named slot', () => {
    const root = transformWithCache(
      `<Foo><template #foo>{{x}}<span/></template></Foo>`,
    )
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      properties: [
        {
          key: { content: 'foo' },
          value: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            returns: [
              {
                type: NodeTypes.TEXT_CALL,
              },
              // first slot child cached
              {
                type: NodeTypes.ELEMENT,
                codegenNode: {
                  type: NodeTypes.JS_CACHE_EXPRESSION,
                },
              },
            ],
          },
        },
        {
          /* _ slot flag */
        },
      ],
    })
  })

  test('cache named slot as a whole', () => {
    const root = transformWithCache(
      `<Foo><template #foo><span/><span/></template></Foo>`,
    )
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      properties: [
        {
          key: { content: 'foo' },
          value: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            returns: {
              type: NodeTypes.JS_CACHE_EXPRESSION,
              value: {
                type: NodeTypes.JS_ARRAY_EXPRESSION,
                elements: [
                  { type: NodeTypes.ELEMENT },
                  { type: NodeTypes.ELEMENT },
                ],
              },
            },
          },
        },
        {
          /* _ slot flag */
        },
      ],
    })
  })

  test('cache dynamically named slot as a whole', () => {
    const root = transformWithCache(
      `<Foo><template #[foo]><span/><span/></template></Foo>`,
    )
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      properties: [
        {
          key: { content: 'foo', isStatic: false },
          value: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            returns: {
              type: NodeTypes.JS_CACHE_EXPRESSION,
              value: {
                type: NodeTypes.JS_ARRAY_EXPRESSION,
                elements: [
                  { type: NodeTypes.ELEMENT },
                  { type: NodeTypes.ELEMENT },
                ],
              },
            },
          },
        },
        {
          /* _ slot flag */
        },
      ],
    })
  })

  test('cache dynamically named (expression) slot as a whole', () => {
    const root = transformWithCache(
      `<Foo><template #[foo+1]><span/><span/></template></Foo>`,
      { prefixIdentifiers: true },
    )
    expect((root.codegenNode as VNodeCall).children).toMatchObject({
      properties: [
        {
          key: { type: NodeTypes.COMPOUND_EXPRESSION },
          value: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            returns: {
              type: NodeTypes.JS_CACHE_EXPRESSION,
              value: {
                type: NodeTypes.JS_ARRAY_EXPRESSION,
                elements: [
                  { type: NodeTypes.ELEMENT },
                  { type: NodeTypes.ELEMENT },
                ],
              },
            },
          },
        },
        {
          /* _ slot flag */
        },
      ],
    })
  })

  test('should NOT cache components', () => {
    const root = transformWithCache(`<div><Comp/></div>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `_component_Comp`,
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT cache element with dynamic props (but hoist the props list)', () => {
    const root = transformWithCache(`<div><div :id="foo"/></div>`)
    expect(root.hoists.length).toBe(1)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: createObjectMatcher({
            id: `[foo]`,
          }),
          children: undefined,
          patchFlag: PatchFlags.PROPS,
          dynamicProps: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`,
            isStatic: false,
          },
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('cache element with static key', () => {
    const root = transformWithCache(`<div><div key="foo"/></div>`)
    expect(root.codegenNode).toMatchObject({
      tag: `"div"`,
      props: undefined,
      children: cachedChildrenArrayMatcher(['div']),
    })
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT cache element with dynamic key', () => {
    const root = transformWithCache(`<div><div :key="foo"/></div>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: createObjectMatcher({
            key: `[foo]`,
          }),
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should NOT cache element with dynamic ref', () => {
    const root = transformWithCache(`<div><div :ref="foo"/></div>`)
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: createObjectMatcher({
            ref: `[foo]`,
          }),
          children: undefined,
          patchFlag: PatchFlags.NEED_PATCH,
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with directives', () => {
    const root = transformWithCache(`<div><div id="foo" v-foo/></div>`)
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`,
          },
          children: undefined,
          patchFlag: PatchFlags.NEED_PATCH,
          directives: {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
          },
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with dynamic text children', () => {
    const root = transformWithCache(
      `<div><div id="foo">{{ hello }}</div></div>`,
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
          patchFlag: PatchFlags.TEXT,
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('hoist static props for elements with unhoistable children', () => {
    const root = transformWithCache(`<div><div id="foo"><Comp/></div></div>`)
    expect(root.hoists).toMatchObject([createObjectMatcher({ id: 'foo' })])
    expect((root.codegenNode as VNodeCall).children).toMatchObject([
      {
        type: NodeTypes.ELEMENT,
        codegenNode: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
          props: { content: `_hoisted_1` },
          children: [{ type: NodeTypes.ELEMENT, tag: `Comp` }],
        },
      },
    ])
    expect(root.cached.length).toBe(0)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should cache v-if props/children if static', () => {
    const root = transformWithCache(
      `<div><div v-if="ok" id="foo"><span/></div></div>`,
    )
    expect(root.hoists).toMatchObject([
      createObjectMatcher({
        key: `[0]`, // key injected by v-if branch
        id: 'foo',
      }),
    ])
    expect(
      ((root.children[0] as ElementNode).children[0] as IfNode).codegenNode,
    ).toMatchObject({
      type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
      consequent: {
        // blocks should NOT be cached
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
        props: { content: `_hoisted_1` },
        children: cachedChildrenArrayMatcher(['span']),
      },
    })
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('should hoist v-for children if static', () => {
    const root = transformWithCache(
      `<div><div v-for="i in list" id="foo"><span/></div></div>`,
    )
    expect(root.hoists).toMatchObject([
      createObjectMatcher({
        id: 'foo',
      }),
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
        callee: RENDER_LIST,
      },
      patchFlag: PatchFlags.UNKEYED_FRAGMENT,
    })
    const innerBlockCodegen = forBlockCodegen!.children.arguments[1]
    expect(innerBlockCodegen.returns).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: `"div"`,
      props: { content: `_hoisted_1` },
      children: cachedChildrenArrayMatcher(['span']),
    })
    expect(root.cached.length).toBe(1)
    expect(generate(root).code).toMatchSnapshot()
  })

  describe('prefixIdentifiers', () => {
    test('cache nested static tree with static interpolation', () => {
      const root = transformWithCache(
        `<div><span>foo {{ 1 }} {{ true }}</span></div>`,
        {
          prefixIdentifiers: true,
        },
      )
      expect(root.codegenNode).toMatchObject({
        tag: `"div"`,
        props: undefined,
        children: cachedChildrenArrayMatcher(['span']),
      })
      expect(root.cached.length).toBe(1)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('cache nested static tree with static prop value', () => {
      const root = transformWithCache(
        `<div><span :foo="0">{{ 1 }}</span></div>`,
        {
          prefixIdentifiers: true,
        },
      )
      expect(root.codegenNode).toMatchObject({
        tag: `"div"`,
        props: undefined,
        children: cachedChildrenArrayMatcher(['span']),
      })
      expect(root.cached.length).toBe(1)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('hoist class with static object value', () => {
      const root = transformWithCache(
        `<div><span :class="{ foo: true }">{{ bar }}</span></div>`,
        {
          prefixIdentifiers: true,
        },
      )

      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `class`,
                isStatic: true,
                constType: ConstantTypes.CAN_STRINGIFY,
              },
              value: {
                type: NodeTypes.JS_CALL_EXPRESSION,
                callee: NORMALIZE_CLASS,
                arguments: [
                  {
                    content: `{ foo: true }`,
                    isStatic: false,
                    constType: ConstantTypes.CAN_STRINGIFY,
                  },
                ],
              },
            },
          ],
        },
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
                content: `_hoisted_1`,
              },
              children: {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `_ctx.bar`,
                  isStatic: false,
                  constType: ConstantTypes.NOT_CONSTANT,
                },
              },
              patchFlag: PatchFlags.TEXT,
            },
          },
        ],
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT cache expressions that refer scope variables', () => {
      const root = transformWithCache(
        `<div><p v-for="o in list"><span>{{ o }}</span></p></div>`,
        {
          prefixIdentifiers: true,
        },
      )

      expect(root.cached.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT cache expressions that refer scope variables (2)', () => {
      const root = transformWithCache(
        `<div><p v-for="o in list"><span>{{ o + 'foo' }}</span></p></div>`,
        {
          prefixIdentifiers: true,
        },
      )

      expect(root.cached.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT cache expressions that refer scope variables (v-slot)', () => {
      const root = transformWithCache(
        `<Comp v-slot="{ foo }">{{ foo }}</Comp>`,
        {
          prefixIdentifiers: true,
        },
      )

      expect(root.cached.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT cache elements with cached handlers', () => {
      const root = transformWithCache(
        `<div><div><div @click="foo"/></div></div>`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )

      expect(root.cached.length).toBe(1)
      expect(root.hoists.length).toBe(0)
      expect(
        generate(root, {
          mode: 'module',
          prefixIdentifiers: true,
        }).code,
      ).toMatchSnapshot()
    })

    test('should NOT cache elements with cached handlers + other bindings', () => {
      const root = transformWithCache(
        `<div><div><div :class="{}" @click="foo"/></div></div>`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )

      expect(root.cached.length).toBe(1)
      expect(root.hoists.length).toBe(0)
      expect(
        generate(root, {
          mode: 'module',
          prefixIdentifiers: true,
        }).code,
      ).toMatchSnapshot()
    })

    test('should NOT cache keyed template v-for with plain element child', () => {
      const root = transformWithCache(
        `<div><template v-for="item in items" :key="item"><span/></template></div>`,
      )
      expect(root.hoists.length).toBe(0)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should NOT cache SVG with directives', () => {
      const root = transformWithCache(
        `<div><svg v-foo><path d="M2,3H5.5L12"/></svg></div>`,
      )
      expect(root.cached.length).toBe(1)
      expect(root.codegenNode).toMatchObject({
        children: [
          {
            tag: 'svg',
            // only cache the children, not the svg tag itself
            codegenNode: {
              children: {
                type: NodeTypes.JS_CACHE_EXPRESSION,
              },
            },
          },
        ],
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('clone hoisted array children in v-for + HMR mode', () => {
      const root = transformWithCache(
        `<div><div v-for="i in 1"><span class="hi"></span></div></div>`,
        {
          hmr: true,
        },
      )
      expect(root.cached.length).toBe(1)
      const forBlockCodegen = (
        (root.children[0] as ElementNode).children[0] as ForNode
      ).codegenNode
      expect(forBlockCodegen).toMatchObject({
        type: NodeTypes.VNODE_CALL,
        tag: FRAGMENT,
        props: undefined,
        children: {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: RENDER_LIST,
        },
        patchFlag: PatchFlags.UNKEYED_FRAGMENT,
      })
      const innerBlockCodegen = forBlockCodegen!.children.arguments[1]
      expect(innerBlockCodegen.returns).toMatchObject({
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
        children: cachedChildrenArrayMatcher(
          ['span'],
          true /* needArraySpread */,
        ),
      })
      expect(generate(root).code).toMatchSnapshot()
    })
  })
})
