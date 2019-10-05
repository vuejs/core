import {
  ElementNode,
  CompilerOptions,
  parse,
  transform,
  ErrorCodes
} from '../../src'
import {
  RESOLVE_COMPONENT,
  CREATE_VNODE,
  MERGE_PROPS,
  RESOLVE_DIRECTIVE,
  APPLY_DIRECTIVES,
  TO_HANDLERS
} from '../../src/runtimeHelpers'
import {
  CallExpression,
  NodeTypes,
  createObjectProperty,
  DirectiveNode,
  RootNode
} from '../../src/ast'
import { transformElement } from '../../src/transforms/transformElement'
import { transformStyle } from '../../../compiler-dom/src/transforms/transformStyle'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { PatchFlags } from '@vue/shared'
import { createObjectMatcher } from '../testUtils'
import { optimizeText } from '../../src/transforms/optimizeText'

function parseWithElementTransform(
  template: string,
  options: CompilerOptions = {}
): {
  root: RootNode
  node: CallExpression
} {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [optimizeText, transformElement],
    ...options
  })
  const codegenNode = (ast.children[0] as ElementNode)
    .codegenNode as CallExpression
  expect(codegenNode.type).toBe(NodeTypes.JS_CALL_EXPRESSION)
  return {
    root: ast,
    node: codegenNode
  }
}

describe('compiler: element transform', () => {
  test('import + resolve component', () => {
    const { root } = parseWithElementTransform(`<Foo/>`)
    expect(root.helpers).toContain(RESOLVE_COMPONENT)
    expect(root.components).toContain(`Foo`)
  })

  test('static props', () => {
    const { node } = parseWithElementTransform(`<div id="foo" class="bar" />`)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments).toMatchObject([
      `"div"`,
      createObjectMatcher({
        id: 'foo',
        class: 'bar'
      })
    ])
  })

  test('props + children', () => {
    const { node } = parseWithElementTransform(`<div id="foo"><span/></div>`)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments).toMatchObject([
      `"div"`,
      createObjectMatcher({
        id: 'foo'
      }),
      [
        {
          type: NodeTypes.ELEMENT,
          tag: 'span',
          codegenNode: {
            callee: CREATE_VNODE,
            arguments: [`"span"`]
          }
        }
      ]
    ])
  })

  test('0 placeholder for children with no props', () => {
    const { node } = parseWithElementTransform(`<div><span/></div>`)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments).toMatchObject([
      `"div"`,
      `null`,
      [
        {
          type: NodeTypes.ELEMENT,
          tag: 'span',
          codegenNode: {
            callee: CREATE_VNODE,
            arguments: [`"span"`]
          }
        }
      ]
    ])
  })

  test('v-bind="obj"', () => {
    const { root, node } = parseWithElementTransform(`<div v-bind="obj" />`)
    // single v-bind doesn't need mergeProps
    expect(root.helpers).not.toContain(MERGE_PROPS)
    expect(node.callee).toBe(CREATE_VNODE)
    // should directly use `obj` in props position
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `obj`
    })
  })

  test('v-bind="obj" after static prop', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-bind="obj" />`
    )
    expect(root.helpers).toContain(MERGE_PROPS)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo'
        }),
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`
        }
      ]
    })
  })

  test('v-bind="obj" before static prop', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-bind="obj" id="foo" />`
    )
    expect(root.helpers).toContain(MERGE_PROPS)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`
        },
        createObjectMatcher({
          id: 'foo'
        })
      ]
    })
  })

  test('v-bind="obj" between static props', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-bind="obj" class="bar" />`
    )
    expect(root.helpers).toContain(MERGE_PROPS)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo'
        }),
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`
        },
        createObjectMatcher({
          class: 'bar'
        })
      ]
    })
  })

  test('v-on="obj"', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-on="obj" class="bar" />`
    )
    expect(root.helpers).toContain(MERGE_PROPS)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo'
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: TO_HANDLERS,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `obj`
            }
          ]
        },
        createObjectMatcher({
          class: 'bar'
        })
      ]
    })
  })

  test('v-on="obj" + v-bind="obj"', () => {
    const { root, node } = parseWithElementTransform(
      `<div id="foo" v-on="handlers" v-bind="obj" />`
    )
    expect(root.helpers).toContain(MERGE_PROPS)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: MERGE_PROPS,
      arguments: [
        createObjectMatcher({
          id: 'foo'
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: TO_HANDLERS,
          arguments: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `handlers`
            }
          ]
        },
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `obj`
        }
      ]
    })
  })

  test('should handle plain <template> as normal element', () => {
    const { node } = parseWithElementTransform(`<template id="foo" />`)
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments).toMatchObject([
      `"template"`,
      createObjectMatcher({
        id: 'foo'
      })
    ])
  })

  test('error on v-bind with no argument', () => {
    const onError = jest.fn()
    parseWithElementTransform(`<div v-bind/>`, { onError })
    expect(onError.mock.calls[0]).toMatchObject([
      {
        code: ErrorCodes.X_V_BIND_NO_EXPRESSION
      }
    ])
  })

  test('directiveTransforms', () => {
    let _dir: DirectiveNode
    const { node } = parseWithElementTransform(`<div v-foo:bar="hello" />`, {
      directiveTransforms: {
        foo(dir) {
          _dir = dir
          return {
            props: createObjectProperty(dir.arg!, dir.exp!),
            needRuntime: false
          }
        }
      }
    })
    expect(node.callee).toBe(CREATE_VNODE)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: _dir!.arg,
          value: _dir!.exp
        }
      ]
    })
    // should factor in props returned by custom directive transforms
    // in patchFlag analysis
    expect(node.arguments[3]).toMatch(PatchFlags.PROPS + '')
    expect(node.arguments[4]).toMatch(`"bar"`)
  })

  test('directiveTransform with needRuntime: true', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-foo:bar="hello" />`,
      {
        directiveTransforms: {
          foo() {
            return {
              props: [],
              needRuntime: true
            }
          }
        }
      }
    )
    expect(root.helpers).toContain(RESOLVE_DIRECTIVE)
    expect(root.directives).toContain(`foo`)

    expect(node.callee).toBe(APPLY_DIRECTIVES)
    expect(node.arguments).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          `"div"`,
          `null`,
          `null`,
          `${PatchFlags.NEED_PATCH} /* NEED_PATCH */` // should generate appropriate flag
        ]
      },
      {
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
                isStatic: false
              },
              // arg
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `bar`,
                isStatic: true
              }
            ]
          }
        ]
      }
    ])
  })

  test('runtime directives', () => {
    const { root, node } = parseWithElementTransform(
      `<div v-foo v-bar="x" v-baz:[arg].mod.mad="y" />`
    )
    expect(root.helpers).toContain(RESOLVE_DIRECTIVE)
    expect(root.directives).toContain(`foo`)
    expect(root.directives).toContain(`bar`)
    expect(root.directives).toContain(`baz`)

    expect(node.callee).toBe(APPLY_DIRECTIVES)
    expect(node.arguments).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: [
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [`_directive_foo`]
          },
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              `_directive_bar`,
              // exp
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `x`
              }
            ]
          },
          {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              `_directive_baz`,
              // exp
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `y`,
                isStatic: false
              },
              // arg
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `arg`,
                isStatic: false
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
                      isStatic: true
                    },
                    value: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `true`,
                      isStatic: false
                    }
                  },
                  {
                    type: NodeTypes.JS_PROPERTY,
                    key: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `mad`,
                      isStatic: true
                    },
                    value: {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: `true`,
                      isStatic: false
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ])
  })

  test(`props merging: event handlers`, () => {
    const { node } = parseWithElementTransform(
      `<div @click.foo="a" @click.bar="b" />`,
      {
        directiveTransforms: {
          on: transformOn
        }
      }
    )
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `onClick`,
            isStatic: true
          },
          value: {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `a`,
                isStatic: false
              },
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `b`,
                isStatic: false
              }
            ]
          }
        }
      ]
    })
  })

  test(`props merging: style`, () => {
    const { node } = parseWithElementTransform(
      `<div style="color: red" :style="{ color: 'red' }" />`,
      {
        nodeTransforms: [transformStyle, transformElement],
        directiveTransforms: {
          bind: transformBind
        }
      }
    )
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true
          },
          value: {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `_hoisted_1`,
                isStatic: false
              },
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `{ color: 'red' }`,
                isStatic: false
              }
            ]
          }
        }
      ]
    })
  })

  test(`props merging: class`, () => {
    const { node } = parseWithElementTransform(
      `<div class="foo" :class="{ bar: isBar }" />`,
      {
        directiveTransforms: {
          bind: transformBind
        }
      }
    )
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `class`,
            isStatic: true
          },
          value: {
            type: NodeTypes.JS_ARRAY_EXPRESSION,
            elements: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `foo`,
                isStatic: true
              },
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `{ bar: isBar }`,
                isStatic: false
              }
            ]
          }
        }
      ]
    })
  })

  describe('patchFlag analysis', () => {
    function parseWithBind(template: string) {
      return parseWithElementTransform(template, {
        directiveTransforms: {
          bind: transformBind
        }
      })
    }

    test('TEXT', () => {
      const { node } = parseWithBind(`<div>foo</div>`)
      expect(node.arguments.length).toBe(3)

      const { node: node2 } = parseWithBind(`<div>{{ foo }}</div>`)
      expect(node2.arguments.length).toBe(4)
      expect(node2.arguments[3]).toBe(`${PatchFlags.TEXT} /* TEXT */`)

      // multiple nodes, merged with optimize text
      const { node: node3 } = parseWithBind(`<div>foo {{ bar }} baz</div>`)
      expect(node3.arguments.length).toBe(4)
      expect(node3.arguments[3]).toBe(`${PatchFlags.TEXT} /* TEXT */`)
    })

    test('CLASS', () => {
      const { node } = parseWithBind(`<div :class="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(`${PatchFlags.CLASS} /* CLASS */`)
    })

    test('STYLE', () => {
      const { node } = parseWithBind(`<div :style="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(`${PatchFlags.STYLE} /* STYLE */`)
    })

    test('PROPS', () => {
      const { node } = parseWithBind(`<div id="foo" :foo="bar" :baz="qux" />`)
      expect(node.arguments.length).toBe(5)
      expect(node.arguments[3]).toBe(`${PatchFlags.PROPS} /* PROPS */`)
      expect(node.arguments[4]).toBe(`["foo", "baz"]`)
    })

    test('CLASS + STYLE + PROPS', () => {
      const { node } = parseWithBind(
        `<div id="foo" :class="cls" :style="styl" :foo="bar" :baz="qux"/>`
      )
      expect(node.arguments.length).toBe(5)
      expect(node.arguments[3]).toBe(
        `${PatchFlags.PROPS |
          PatchFlags.CLASS |
          PatchFlags.STYLE} /* CLASS, STYLE, PROPS */`
      )
      expect(node.arguments[4]).toBe(`["foo", "baz"]`)
    })

    test('FULL_PROPS (v-bind)', () => {
      const { node } = parseWithBind(`<div v-bind="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(
        `${PatchFlags.FULL_PROPS} /* FULL_PROPS */`
      )
    })

    test('FULL_PROPS (dynamic key)', () => {
      const { node } = parseWithBind(`<div :[foo]="bar" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(
        `${PatchFlags.FULL_PROPS} /* FULL_PROPS */`
      )
    })

    test('FULL_PROPS (w/ others)', () => {
      const { node } = parseWithBind(
        `<div id="foo" v-bind="bar" :class="cls" />`
      )
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(
        `${PatchFlags.FULL_PROPS} /* FULL_PROPS */`
      )
    })

    test('NEED_PATCH (static ref)', () => {
      const { node } = parseWithBind(`<div ref="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(
        `${PatchFlags.NEED_PATCH} /* NEED_PATCH */`
      )
    })

    test('NEED_PATCH (dynamic ref)', () => {
      const { node } = parseWithBind(`<div :ref="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(
        `${PatchFlags.NEED_PATCH} /* NEED_PATCH */`
      )
    })

    test('NEED_PATCH (custom directives)', () => {
      const { node } = parseWithBind(`<div v-foo />`)
      const vnodeCall = node.arguments[0] as CallExpression
      expect(vnodeCall.arguments.length).toBe(4)
      expect(vnodeCall.arguments[3]).toBe(
        `${PatchFlags.NEED_PATCH} /* NEED_PATCH */`
      )
    })
  })
})
