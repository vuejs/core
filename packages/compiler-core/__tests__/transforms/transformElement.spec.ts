import {
  BindingTypes,
  type CompilerOptions,
  ErrorCodes,
  type NodeTransform,
  baseCompile,
  baseParse as parse,
  transform,
  transformExpression,
} from '../../src'
import {
  BASE_TRANSITION,
  CREATE_VNODE,
  GUARD_REACTIVE_PROPS,
  KEEP_ALIVE,
  MERGE_PROPS,
  NORMALIZE_CLASS,
  NORMALIZE_PROPS,
  NORMALIZE_STYLE,
  RESOLVE_COMPONENT,
  RESOLVE_DIRECTIVE,
  RESOLVE_DYNAMIC_COMPONENT,
  SUSPENSE,
  TELEPORT,
  TO_HANDLERS,
  helperNameMap,
} from '../../src/runtimeHelpers'
import {
  type DirectiveNode,
  NodeTypes,
  type RootNode,
  type VNodeCall,
  createObjectProperty,
} from '../../src/ast'
import { transformElement } from '../../src/transforms/transformElement'
import { transformStyle } from '../../../compiler-dom/src/transforms/transformStyle'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { PatchFlags } from '@vue/shared'
import { createObjectMatcher } from '../testUtils'
import { transformText } from '../../src/transforms/transformText'
import { parseWithForTransform } from './vFor.spec'

function parseWithElementTransform(
  template: string,
  options: CompilerOptions = {},
): {
  root: RootNode
  node: VNodeCall
} {
  // wrap raw template in an extra div so that it doesn't get turned into a
  // block as root node
  const ast = parse(`<div>${template}</div>`, options)
  transform(ast, {
    nodeTransforms: [transformElement, transformText],
    ...options,
  })
  const codegenNode = (ast as any).children[0].children[0]
    .codegenNode as VNodeCall
  expect(codegenNode.type).toBe(NodeTypes.VNODE_CALL)
  return {
    root: ast,
    node: codegenNode,
  }
}

function parseWithBind(template: string, options?: CompilerOptions) {
  return parseWithElementTransform(template, {
    ...options,
    directiveTransforms: {
      ...options?.directiveTransforms,
      bind: transformBind,
    },
  })
}

describe('compiler: element transform', () => {
  test('import + resolve component', () => {
    const { root } = parseWithElementTransform(`<Foo/>`)
    expect(root.helpers).toContain(RESOLVE_COMPONENT)
    expect(root.components).toContain(`Foo`)
  })

  test('resolve implicitly self-referencing component', () => {
    const { root } = parseWithElementTransform(`<Example/>`, {
      filename: `/foo/bar/Example.vue?vue&type=template`,
    })
    expect(root.helpers).toContain(RESOLVE_COMPONENT)
    expect(root.components).toContain(`Example__self`)
  })

  test('resolve component from setup bindings', () => {
    const { root, node } = parseWithElementTransform(`<Example/>`, {
      bindingMetadata: {
        Example: BindingTypes.SETUP_MAYBE_REF,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`$setup["Example"]`)
  })

  test('resolve component from setup bindings (inline)', () => {
    const { root, node } = parseWithElementTransform(`<Example/>`, {
      inline: true,
      bindingMetadata: {
        Example: BindingTypes.SETUP_MAYBE_REF,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`_unref(Example)`)
  })

  test('resolve component from setup bindings (inline const)', () => {
    const { root, node } = parseWithElementTransform(`<Example/>`, {
      inline: true,
      bindingMetadata: {
        Example: BindingTypes.SETUP_CONST,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`Example`)
  })

  test('resolve namespaced component from setup bindings', () => {
    const { root, node } = parseWithElementTransform(`<Foo.Example/>`, {
      bindingMetadata: {
        Foo: BindingTypes.SETUP_MAYBE_REF,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`$setup["Foo"].Example`)
  })

  test('resolve namespaced component from setup bindings (inline)', () => {
    const { root, node } = parseWithElementTransform(`<Foo.Example/>`, {
      inline: true,
      bindingMetadata: {
        Foo: BindingTypes.SETUP_MAYBE_REF,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`_unref(Foo).Example`)
  })

  test('resolve namespaced component from setup bindings (inline const)', () => {
    const { root, node } = parseWithElementTransform(`<Foo.Example/>`, {
      inline: true,
      bindingMetadata: {
        Foo: BindingTypes.SETUP_CONST,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`Foo.Example`)
  })

  test('resolve namespaced component from props bindings (inline)', () => {
    const { root, node } = parseWithElementTransform(`<Foo.Example/>`, {
      inline: true,
      bindingMetadata: {
        Foo: BindingTypes.PROPS,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe(`_unref(__props["Foo"]).Example`)
  })

  test('resolve namespaced component from props bindings (non-inline)', () => {
    const { root, node } = parseWithElementTransform(`<Foo.Example/>`, {
      inline: false,
      bindingMetadata: {
        Foo: BindingTypes.PROPS,
      },
    })
    expect(root.helpers).not.toContain(RESOLVE_COMPONENT)
    expect(node.tag).toBe('_unref($props["Foo"]).Example')
  })

  test('do not resolve component from non-script-setup bindings', () => {
    const bindingMetadata = {
      Example: BindingTypes.SETUP_MAYBE_REF,
    }
    Object.defineProperty(bindingMetadata, '__isScriptSetup', { value: false })
    const { root } = parseWithElementTransform(`<Example/>`, {
      bindingMetadata,
    })
    expect(root.helpers).toContain(RESOLVE_COMPONENT)
    expect(root.components).toContain(`Example`)
  })

  test('static props', () => {
    const { node } = parseWithElementTransform(`<div id="foo" class="bar" />`)
    expect(node).toMatchObject({
      tag: `"div"`,
      props: createObjectMatcher({
        id: 'foo',
        class: 'bar',
      }),
      children: undefined,
    })
  })

  test('props + children', () => {
    const { node } = parseWithElementTransform(`<div id="foo"><span/></div>`)

    expect(node).toMatchObject({
      tag: `"div"`,
      props: createObjectMatcher({
        id: 'foo',
      }),
      children: [
        {
          type: NodeTypes.ELEMENT,
          tag: 'span',
          codegenNode: {
            type: NodeTypes.VNODE_CALL,
            tag: `"span"`,
          },
        },
      ],
    })
  })

  test('0 placeholder for children with no props', () => {
    const { node } = parseWithElementTransform(`<div><span/></div>`)

    expect(node).toMatchObject({
      tag: `"div"`,
      props: undefined,
      children: [
        {
          type: NodeTypes.ELEMENT,
          tag: 'span',
          codegenNode: {
            type: NodeTypes.VNODE_CALL,
            tag: `"span"`,
          },
        },
      ],
    })
  })

  test('v-bind="obj"', () => {
    const { root, node } = parseWithElementTransform(`<div v-bind="obj" />`)
    // single v-bind doesn't need mergeProps
    expect(root.helpers).not.toContain(MERGE_PROPS)
    expect(root.helpers).toContain(NORMALIZE_PROPS)
    expect(root.helpers).toContain(GUARD_REACTIVE_PROPS)

    // should directly use `obj` in props position
    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: GUARD_REACTIVE_PROPS,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `obj`,
            },
          ],
        },
      ],
    })
  })

  test('v-bind="obj" after static prop', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-bind="obj" />`,
    )
    expect(root.helpers).toContain(MERGE_PROPS)

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo',
        }),
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`,
        },
      ],
    })
  })

  test('v-bind="obj" before static prop', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-bind="obj" id="foo" />`,
    )
    expect(root.helpers).toContain(MERGE_PROPS)

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`,
        },
        createObjectMatcher({
          id: 'foo',
        }),
      ],
    })
  })

  test('v-bind="obj" between static props', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-bind="obj" class="bar" />`,
    )
    expect(root.helpers).toContain(MERGE_PROPS)

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo',
        }),
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`,
        },
        createObjectMatcher({
          class: 'bar',
        }),
      ],
    })
  })

  test('v-on="obj"', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-on="obj" class="bar" />`,
    )
    expect(root.helpers).toContain(MERGE_PROPS)

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo',
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: TO_HANDLERS,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `obj`,
            },
            `true`,
          ],
        },
        createObjectMatcher({
          class: 'bar',
        }),
      ],
    })
  })

  test('v-on="obj" on component', () => {
    const { root, node } = parseWithElementTransform(
      `<Foo id="foo" v-on="obj" class="bar" />`,
    )
    expect(root.helpers).toContain(MERGE_PROPS)

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo',
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: TO_HANDLERS,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `obj`,
            },
          ],
        },
        createObjectMatcher({
          class: 'bar',
        }),
      ],
    })
  })

  test('v-on="obj" + v-bind="obj"', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-on="handlers" v-bind="obj" />`,
    )
    expect(root.helpers).toContain(MERGE_PROPS)

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo',
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: TO_HANDLERS,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `handlers`,
            },
            `true`,
          ],
        },
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`,
        },
      ],
    })
  })

  test('should handle plain <template> as normal element', () => {
    const { node } = parseWithElementTransform(`<template id="foo" />`)

    expect(node).toMatchObject({
      tag: `"template"`,
      props: createObjectMatcher({
        id: 'foo',
      }),
    })
  })

  test('should handle <Teleport> with normal children', () => {
    function assert(tag: string) {
      const { root, node } = parseWithElementTransform(
        `<${tag} target="#foo"><span /></${tag}>`,
      )
      expect(root.components.length).toBe(0)
      expect(root.helpers).toContain(TELEPORT)

      expect(node).toMatchObject({
        tag: TELEPORT,
        props: createObjectMatcher({
          target: '#foo',
        }),
        children: [
          {
            type: NodeTypes.ELEMENT,
            tag: 'span',
            codegenNode: {
              type: NodeTypes.VNODE_CALL,
              tag: `"span"`,
            },
          },
        ],
      })
    }

    assert(`teleport`)
    assert(`Teleport`)
  })

  test('should handle <Suspense>', () => {
    function assert(tag: string, content: string, hasFallback?: boolean) {
      const { root, node } = parseWithElementTransform(
        `<${tag}>${content}</${tag}>`,
      )
      expect(root.components.length).toBe(0)
      expect(root.helpers).toContain(SUSPENSE)

      expect(node).toMatchObject({
        tag: SUSPENSE,
        props: undefined,
        children: hasFallback
          ? createObjectMatcher({
              default: {
                type: NodeTypes.JS_FUNCTION_EXPRESSION,
              },
              fallback: {
                type: NodeTypes.JS_FUNCTION_EXPRESSION,
              },
              _: `[1 /* STABLE */]`,
            })
          : createObjectMatcher({
              default: {
                type: NodeTypes.JS_FUNCTION_EXPRESSION,
              },
              _: `[1 /* STABLE */]`,
            }),
      })
    }

    assert(`suspense`, `foo`)
    assert(`suspense`, `<template #default>foo</template>`)
    assert(
      `suspense`,
      `<template #default>foo</template><template #fallback>fallback</template>`,
      true,
    )
  })

  test('should handle <KeepAlive>', () => {
    function assert(tag: string) {
      const root = parse(`<div><${tag}><span /></${tag}></div>`)
      transform(root, {
        nodeTransforms: [transformElement, transformText],
      })
      expect(root.components.length).toBe(0)
      expect(root.helpers).toContain(KEEP_ALIVE)
      const node = (root.children[0] as any).children[0].codegenNode
      expect(node).toMatchObject({
        type: NodeTypes.VNODE_CALL,
        tag: KEEP_ALIVE,
        isBlock: true, // should be forced into a block
        props: undefined,
        // keep-alive should not compile content to slots
        children: [{ type: NodeTypes.ELEMENT, tag: 'span' }],
        // should get a dynamic slots flag to force updates
        patchFlag: PatchFlags.DYNAMIC_SLOTS,
      })
    }

    assert(`keep-alive`)
    assert(`KeepAlive`)
  })

  test('should handle <BaseTransition>', () => {
    function assert(tag: string) {
      const { root, node } = parseWithElementTransform(
        `<${tag}><span /></${tag}>`,
      )
      expect(root.components.length).toBe(0)
      expect(root.helpers).toContain(BASE_TRANSITION)

      expect(node).toMatchObject({
        tag: BASE_TRANSITION,
        props: undefined,
        children: createObjectMatcher({
          default: {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
          },
          _: `[1 /* STABLE */]`,
        }),
      })
    }

    assert(`base-transition`)
    assert(`BaseTransition`)
  })

  test('error on v-bind with no argument', () => {
    const onError = vi.fn()
    parseWithElementTransform(`<div v-bind/>`, { onError })
    expect(onError.mock.calls[0]).toMatchObject([
      {
        code: ErrorCodes.X_V_BIND_NO_EXPRESSION,
      },
    ])
  })

  test('directiveTransforms', () => {
    let _dir: DirectiveNode
    const { node } = parseWithElementTransform(`<div v-foo:bar="hello" />`, {
      directiveTransforms: {
        foo(dir) {
          _dir = dir
          return {
            props: [createObjectProperty(dir.arg!, dir.exp!)],
          }
        },
      },
    })

    expect(node.props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: _dir!.arg,
          value: _dir!.exp,
        },
      ],
    })
    // should factor in props returned by custom directive transforms
    // in patchFlag analysis
    expect(node.patchFlag).toBe(PatchFlags.PROPS)
    expect(node.dynamicProps).toMatch(`"bar"`)
  })

  test('directiveTransform with needRuntime: true', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-foo:bar="hello" />`,
      {
        directiveTransforms: {
          foo() {
            return {
              props: [],
              needRuntime: true,
            }
          },
        },
      },
    )
    expect(root.helpers).toContain(RESOLVE_DIRECTIVE)
    expect(root.directives).toContain(`foo`)
    expect(node).toMatchObject({
      tag: `"div"`,
      props: undefined,
      children: undefined,
      patchFlag: PatchFlags.NEED_PATCH, // should generate appropriate flag
      directives: {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: [
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              `_directive_foo`,
              // exp
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `hello`,
                isStatic: false,
              },
              // arg
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `bar`,
                isStatic: true,
              },
            ],
          },
        ],
      },
    })
  })

  test('directiveTransform with needRuntime: Symbol', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-foo:bar="hello" />`,
      {
        directiveTransforms: {
          foo() {
            return {
              props: [],
              needRuntime: CREATE_VNODE,
            }
          },
        },
      },
    )

    expect(root.helpers).toContain(CREATE_VNODE)
    expect(root.helpers).not.toContain(RESOLVE_DIRECTIVE)
    expect(root.directives.length).toBe(0)
    expect(node.directives!.elements[0].elements[0]).toBe(
      `_${helperNameMap[CREATE_VNODE]}`,
    )
  })

  test('runtime directives', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-foo v-bar="x" v-baz:[arg].mod.mad="y" />`,
    )
    expect(root.helpers).toContain(RESOLVE_DIRECTIVE)
    expect(root.directives).toContain(`foo`)
    expect(root.directives).toContain(`bar`)
    expect(root.directives).toContain(`baz`)

    expect(node).toMatchObject({
      directives: {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: [
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [`_directive_foo`],
          },
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              `_directive_bar`,
              // exp
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `x`,
              },
            ],
          },
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              `_directive_baz`,
              // exp
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `y`,
                isStatic: false,
              },
              // arg
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `arg`,
                isStatic: false,
              },
              // modifiers
              {
                type: NodeTypes.JS_OBJECT_EXPRESSION,
                properties: [
                  {
                    type: NodeTypes.JS_PROPERTY,
                    key: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `mod`,
                      isStatic: true,
                    },
                    value: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `true`,
                      isStatic: false,
                    },
                  },
                  {
                    type: NodeTypes.JS_PROPERTY,
                    key: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `mad`,
                      isStatic: true,
                    },
                    value: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `true`,
                      isStatic: false,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  test(`props merging: event handlers`, () => {
    const { node } = parseWithElementTransform(
      `<div @click.foo="a" @click.bar="b" />`,
      {
        directiveTransforms: {
          on: transformOn,
        },
      },
    )
    expect(node.props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `onClick`,
            isStatic: true,
          },
          value: {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `a`,
                isStatic: false,
              },
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `b`,
                isStatic: false,
              },
            ],
          },
        },
      ],
    })
  })

  test(`props merging: style`, () => {
    const { node, root } = parseWithElementTransform(
      `<div style="color: green" :style="{ color: 'red' }" />`,
      {
        nodeTransforms: [transformStyle, transformElement],
        directiveTransforms: {
          bind: transformBind,
        },
      },
    )
    expect(root.helpers).toContain(NORMALIZE_STYLE)
    expect(node.props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true,
          },
          value: {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: NORMALIZE_STYLE,
            arguments: [
              {
                type: NodeTypes.JS_ARRAY_EXPRESSION,
                elements: [
                  {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: `{"color":"green"}`,
                    isStatic: false,
                  },
                  {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: `{ color: 'red' }`,
                    isStatic: false,
                  },
                ],
              },
            ],
          },
        },
      ],
    })
  })

  test(`props merging: style w/ transformExpression`, () => {
    const { node, root } = parseWithElementTransform(
      `<div style="color: green" :style="{ color: 'red' }" />`,
      {
        nodeTransforms: [transformExpression, transformStyle, transformElement],
        directiveTransforms: {
          bind: transformBind,
        },
        prefixIdentifiers: true,
      },
    )
    expect(root.helpers).toContain(NORMALIZE_STYLE)
    expect(node.props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true,
          },
          value: {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: NORMALIZE_STYLE,
          },
        },
      ],
    })
  })

  test(':style with array literal', () => {
    const { node, root } = parseWithElementTransform(
      `<div :style="[{ color: 'red' }]" />`,
      {
        nodeTransforms: [transformExpression, transformStyle, transformElement],
        directiveTransforms: {
          bind: transformBind,
        },
        prefixIdentifiers: true,
      },
    )
    expect(root.helpers).toContain(NORMALIZE_STYLE)
    expect(node.props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true,
          },
          value: {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: NORMALIZE_STYLE,
          },
        },
      ],
    })
  })

  test(`props merging: class`, () => {
    const { node, root } = parseWithElementTransform(
      `<div class="foo" :class="{ bar: isBar }" />`,
      {
        directiveTransforms: {
          bind: transformBind,
        },
      },
    )
    expect(root.helpers).toContain(NORMALIZE_CLASS)
    expect(node.props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `class`,
            isStatic: true,
          },
          value: {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: NORMALIZE_CLASS,
            arguments: [
              {
                type: NodeTypes.JS_ARRAY_EXPRESSION,
                elements: [
                  {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: `foo`,
                    isStatic: true,
                  },
                  {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: `{ bar: isBar }`,
                    isStatic: false,
                  },
                ],
              },
            ],
          },
        },
      ],
    })
  })

  describe('patchFlag analysis', () => {
    test('TEXT', () => {
      const { node } = parseWithBind(`<div>foo</div>`)
      expect(node.patchFlag).toBeUndefined()

      const { node: node2 } = parseWithBind(`<div>{{ foo }}</div>`)
      expect(node2.patchFlag).toBe(PatchFlags.TEXT)

      // multiple nodes, merged with optimize text
      const { node: node3 } = parseWithBind(`<div>foo {{ bar }} baz</div>`)
      expect(node3.patchFlag).toBe(PatchFlags.TEXT)
    })

    test('CLASS', () => {
      const { node } = parseWithBind(`<div :class="foo" />`)
      expect(node.patchFlag).toBe(PatchFlags.CLASS)
    })

    test('STYLE', () => {
      const { node } = parseWithBind(`<div :style="foo" />`)
      expect(node.patchFlag).toBe(PatchFlags.STYLE)
    })

    test('PROPS', () => {
      const { node } = parseWithBind(`<div id="foo" :foo="bar" :baz="qux" />`)
      expect(node.patchFlag).toBe(PatchFlags.PROPS)
      expect(node.dynamicProps).toBe(`["foo", "baz"]`)
    })

    test('CLASS + STYLE + PROPS', () => {
      const { node } = parseWithBind(
        `<div id="foo" :class="cls" :style="styl" :foo="bar" :baz="qux"/>`,
      )
      expect(node.patchFlag).toBe(
        PatchFlags.CLASS | PatchFlags.STYLE | PatchFlags.PROPS,
      )
      expect(node.dynamicProps).toBe(`["foo", "baz"]`)
    })

    // should treat `class` and `style` as PROPS
    test('PROPS on component', () => {
      const { node } = parseWithBind(
        `<Foo :id="foo" :class="cls" :style="styl" />`,
      )
      expect(node.patchFlag).toBe(PatchFlags.PROPS)
      expect(node.dynamicProps).toBe(`["id", "class", "style"]`)
    })

    test('FULL_PROPS (v-bind)', () => {
      const { node } = parseWithBind(`<div v-bind="foo" />`)
      expect(node.patchFlag).toBe(PatchFlags.FULL_PROPS)
    })

    test('FULL_PROPS (dynamic key)', () => {
      const { node } = parseWithBind(`<div :[foo]="bar" />`)
      expect(node.patchFlag).toBe(PatchFlags.FULL_PROPS)
    })

    test('FULL_PROPS (w/ others)', () => {
      const { node } = parseWithBind(
        `<div id="foo" v-bind="bar" :class="cls" />`,
      )
      expect(node.patchFlag).toBe(PatchFlags.FULL_PROPS)
    })

    test('NEED_PATCH (static ref)', () => {
      const { node } = parseWithBind(`<div ref="foo" />`)
      expect(node.patchFlag).toBe(PatchFlags.NEED_PATCH)
    })

    test('NEED_PATCH (dynamic ref)', () => {
      const { node } = parseWithBind(`<div :ref="foo" />`)
      expect(node.patchFlag).toBe(PatchFlags.NEED_PATCH)
    })

    test('NEED_PATCH (custom directives)', () => {
      const { node } = parseWithBind(`<div v-foo />`)
      expect(node.patchFlag).toBe(PatchFlags.NEED_PATCH)
    })

    test('NEED_PATCH (vnode hooks)', () => {
      const root = baseCompile(`<div @vue:updated="foo" />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
      }).ast
      const node = (root as any).children[0].codegenNode
      expect(node.patchFlag).toBe(PatchFlags.NEED_PATCH)
    })

    test('script setup inline mode template ref (binding exists)', () => {
      const { node } = parseWithElementTransform(`<input ref="input"/>`, {
        inline: true,
        bindingMetadata: {
          input: BindingTypes.SETUP_REF,
        },
      })
      expect(node.props).toMatchObject({
        type: NodeTypes.JS_OBJECT_EXPRESSION,
        properties: [
          {
            type: NodeTypes.JS_PROPERTY,
            key: {
              content: 'ref_key',
              isStatic: true,
            },
            value: {
              content: 'input',
              isStatic: true,
            },
          },
          {
            type: NodeTypes.JS_PROPERTY,
            key: {
              content: 'ref',
              isStatic: true,
            },
            value: {
              content: 'input',
              isStatic: false,
            },
          },
        ],
      })
    })

    test('script setup inline mode template ref (binding does not exist)', () => {
      const { node } = parseWithElementTransform(`<input ref="input"/>`, {
        inline: true,
      })
      expect(node.props).toMatchObject({
        type: NodeTypes.JS_OBJECT_EXPRESSION,
        properties: [
          {
            type: NodeTypes.JS_PROPERTY,
            key: {
              content: 'ref',
              isStatic: true,
            },
            value: {
              content: 'input',
              isStatic: true,
            },
          },
        ],
      })
    })

    test('script setup inline mode template ref (binding does not exist but props with the same name exist)', () => {
      const { node } = parseWithElementTransform(`<input ref="msg"/>`, {
        inline: true,
        bindingMetadata: {
          msg: BindingTypes.PROPS,
          ref: BindingTypes.SETUP_CONST,
        },
      })
      expect(node.props).toMatchObject({
        type: NodeTypes.JS_OBJECT_EXPRESSION,
        properties: [
          {
            type: NodeTypes.JS_PROPERTY,
            key: {
              content: 'ref',
              isStatic: true,
            },
            value: {
              content: 'msg',
              isStatic: true,
            },
          },
        ],
      })
    })

    test('NEED_HYDRATION for v-on', () => {
      // ignore click events (has dedicated fast path)
      const { node } = parseWithElementTransform(`<div @click="foo" />`, {
        directiveTransforms: {
          on: transformOn,
        },
      })
      // should only have props flag
      expect(node.patchFlag).toBe(PatchFlags.PROPS)

      const { node: node2 } = parseWithElementTransform(
        `<div @keyup="foo" />`,
        {
          directiveTransforms: {
            on: transformOn,
          },
        },
      )
      expect(node2.patchFlag).toBe(PatchFlags.PROPS | PatchFlags.NEED_HYDRATION)
    })

    test('NEED_HYDRATION for v-bind.prop', () => {
      const { node } = parseWithBind(`<div v-bind:id.prop="id" />`)
      expect(node.patchFlag).toBe(PatchFlags.PROPS | PatchFlags.NEED_HYDRATION)

      const { node: node2 } = parseWithBind(`<div .id="id" />`)
      expect(node2.patchFlag).toBe(PatchFlags.PROPS | PatchFlags.NEED_HYDRATION)
    })

    // #5870
    test('NEED_HYDRATION on dynamic component', () => {
      const { node } = parseWithElementTransform(
        `<component :is="foo" @input="foo" />`,
        {
          directiveTransforms: {
            on: transformOn,
          },
        },
      )
      expect(node.patchFlag).toBe(PatchFlags.PROPS | PatchFlags.NEED_HYDRATION)
    })

    test('should not have PROPS patchflag for constant v-on handlers', () => {
      const { node } = parseWithElementTransform(`<div @keydown="foo" />`, {
        prefixIdentifiers: true,
        bindingMetadata: {
          foo: BindingTypes.SETUP_CONST,
        },
        directiveTransforms: {
          on: transformOn,
        },
      })
      // should only have hydration flag
      expect(node.patchFlag).toBe(PatchFlags.NEED_HYDRATION)
    })
  })

  describe('dynamic component', () => {
    test('static binding', () => {
      const { node, root } = parseWithBind(`<component is="foo" />`)
      expect(root.helpers).toContain(RESOLVE_DYNAMIC_COMPONENT)
      expect(node).toMatchObject({
        isBlock: true,
        tag: {
          callee: RESOLVE_DYNAMIC_COMPONENT,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'foo',
              isStatic: true,
            },
          ],
        },
      })
    })

    test('capitalized version w/ static binding', () => {
      const { node, root } = parseWithBind(`<Component is="foo" />`)
      expect(root.helpers).toContain(RESOLVE_DYNAMIC_COMPONENT)
      expect(node).toMatchObject({
        isBlock: true,
        tag: {
          callee: RESOLVE_DYNAMIC_COMPONENT,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'foo',
              isStatic: true,
            },
          ],
        },
      })
    })

    test('dynamic binding', () => {
      const { node, root } = parseWithBind(`<component :is="foo" />`)
      expect(root.helpers).toContain(RESOLVE_DYNAMIC_COMPONENT)
      expect(node).toMatchObject({
        isBlock: true,
        tag: {
          callee: RESOLVE_DYNAMIC_COMPONENT,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'foo',
              isStatic: false,
            },
          ],
        },
      })
    })

    test('dynamic binding shorthand', () => {
      const { node, root } = parseWithBind(`<component :is />`)
      expect(root.helpers).toContain(RESOLVE_DYNAMIC_COMPONENT)
      expect(node).toMatchObject({
        isBlock: true,
        tag: {
          callee: RESOLVE_DYNAMIC_COMPONENT,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'is',
              isStatic: false,
            },
          ],
        },
      })
    })

    test('is casting', () => {
      const { node, root } = parseWithBind(`<div is="vue:foo" />`)
      expect(root.helpers).toContain(RESOLVE_COMPONENT)
      expect(node).toMatchObject({
        type: NodeTypes.VNODE_CALL,
        tag: '_component_foo',
      })
    })

    // #3934
    test('normal component with is prop', () => {
      const { node, root } = parseWithBind(`<custom-input is="foo" />`, {
        isNativeTag: () => false,
      })
      expect(root.helpers).toContain(RESOLVE_COMPONENT)
      expect(root.helpers).not.toContain(RESOLVE_DYNAMIC_COMPONENT)
      expect(node).toMatchObject({
        tag: '_component_custom_input',
      })
    })
  })

  test('<svg> should be forced into blocks', () => {
    const ast = parse(`<div><svg/></div>`)
    transform(ast, {
      nodeTransforms: [transformElement],
    })
    expect((ast as any).children[0].children[0].codegenNode).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: `"svg"`,
      isBlock: true,
    })
  })

  test('<math> should be forced into blocks', () => {
    const ast = parse(`<div><math/></div>`)
    transform(ast, {
      nodeTransforms: [transformElement],
    })
    expect((ast as any).children[0].children[0].codegenNode).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: `"math"`,
      isBlock: true,
    })
  })

  test('force block for runtime custom directive w/ children', () => {
    const { node } = parseWithElementTransform(`<div v-foo>hello</div>`)
    expect(node.isBlock).toBe(true)
  })

  test('force block for inline before-update handlers w/ children', () => {
    expect(
      parseWithElementTransform(`<div @vue:before-update>hello</div>`).node
        .isBlock,
    ).toBe(true)
  })

  // #938
  test('element with dynamic keys should be forced into blocks', () => {
    const ast = parse(`<div><div :key="foo" /></div>`)
    transform(ast, {
      nodeTransforms: [transformElement],
    })
    expect((ast as any).children[0].children[0].codegenNode).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: `"div"`,
      isBlock: true,
    })
  })

  test('should process node when node has been replaced', () => {
    // a NodeTransform that swaps out <div id="foo" /> with <span id="foo" />
    const customNodeTransform: NodeTransform = (node, context) => {
      if (
        node.type === NodeTypes.ELEMENT &&
        node.tag === 'div' &&
        node.props.some(
          prop =>
            prop.type === NodeTypes.ATTRIBUTE &&
            prop.name === 'id' &&
            prop.value &&
            prop.value.content === 'foo',
        )
      ) {
        context.replaceNode({
          ...node,
          tag: 'span',
        })
      }
    }
    const ast = parse(`<div><div id="foo" /></div>`)
    transform(ast, {
      nodeTransforms: [transformElement, transformText, customNodeTransform],
    })
    expect((ast as any).children[0].children[0].codegenNode).toMatchObject({
      type: NodeTypes.VNODE_CALL,
      tag: '"span"',
      isBlock: false,
    })
  })

  test('ref_for marker on static ref', () => {
    const { node } = parseWithForTransform(`<div v-for="i in l" ref="x"/>`)
    expect((node.children[0] as any).codegenNode.props).toMatchObject(
      createObjectMatcher({
        ref_for: `[true]`,
        ref: 'x',
      }),
    )
  })

  test('ref_for marker on dynamic ref', () => {
    const { node } = parseWithForTransform(`<div v-for="i in l" :ref="x"/>`)
    expect((node.children[0] as any).codegenNode.props).toMatchObject(
      createObjectMatcher({
        ref_for: `[true]`,
        ref: '[x]',
      }),
    )
  })

  test('ref_for marker on v-bind', () => {
    const { node } = parseWithForTransform(`<div v-for="i in l" v-bind="x" />`)
    expect((node.children[0] as any).codegenNode.props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          ref_for: `[true]`,
        }),
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'x',
          isStatic: false,
        },
      ],
    })
  })
})
