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
} from '../../src/runtimeConstants'
import {
  CallExpression,
  NodeTypes,
  createObjectProperty,
  DirectiveNode,
  RootNode
} from '../../src/ast'
import { transformElement } from '../../src/transforms/transformElement'
import { transformOn } from '../../src/transforms/vOn'
import { transformStyle } from '../../src/transforms/transformStyle'
import { transformBind } from '../../src/transforms/vBind'
import { PatchFlags } from '@vue/shared'
import { createObjectMatcher } from '../testUtils'

function parseWithElementTransform(
  template: string,
  options: CompilerOptions = {}
): {
  root: RootNode
  node: CallExpression
} {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [transformElement],
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
  test('import + resovle component', () => {
    const { root } = parseWithElementTransform(`<Foo/>`)
    expect(root.imports).toContain(RESOLVE_COMPONENT)
    expect(root.statements[0]).toMatch(`${RESOLVE_COMPONENT}("Foo")`)
  })

  test('static props', () => {
    const { node } = parseWithElementTransform(`<div id="foo" class="bar" />`)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
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
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
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
            callee: `_${CREATE_VNODE}`,
            arguments: [`"span"`]
          }
        }
      ]
    ])
  })

  test('0 placeholder for children with no props', () => {
    const { node } = parseWithElementTransform(`<div><span/></div>`)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
    expect(node.arguments).toMatchObject([
      `"div"`,
      `null`,
      [
        {
          type: NodeTypes.ELEMENT,
          tag: 'span',
          codegenNode: {
            callee: `_${CREATE_VNODE}`,
            arguments: [`"span"`]
          }
        }
      ]
    ])
  })

  test('v-bind="obj"', () => {
    const { root, node } = parseWithElementTransform(`<div v-bind="obj" />`)
    // single v-bind doesn't need mergeProps
    expect(root.imports).not.toContain(MERGE_PROPS)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
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
    expect(root.imports).toContain(MERGE_PROPS)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: `_${MERGE_PROPS}`,
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
    expect(root.imports).toContain(MERGE_PROPS)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: `_${MERGE_PROPS}`,
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
    expect(root.imports).toContain(MERGE_PROPS)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: `_${MERGE_PROPS}`,
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
    expect(root.imports).toContain(MERGE_PROPS)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: `_${MERGE_PROPS}`,
      arguments: [
        createObjectMatcher({
          id: 'foo'
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: `_${TO_HANDLERS}`,
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
    expect(root.imports).toContain(MERGE_PROPS)
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
    expect(node.arguments[1]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: `_${MERGE_PROPS}`,
      arguments: [
        createObjectMatcher({
          id: 'foo'
        }),
        {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: `_${TO_HANDLERS}`,
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
    expect(node.callee).toBe(`_${CREATE_VNODE}`)
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
  })

  test('directiveTransform with needRuntime: true', () => {
    let _dir: DirectiveNode
    const { root, node } = parseWithElementTransform(
      `<div v-foo:bar="hello" />`,
      {
        directiveTransforms: {
          foo(dir) {
            _dir = dir
            return {
              props: [createObjectProperty(dir.arg!, dir.exp!)],
              needRuntime: true
            }
          }
        }
      }
    )
    expect(root.imports).toContain(RESOLVE_DIRECTIVE)
    expect(root.statements[0]).toMatch(`${RESOLVE_DIRECTIVE}("foo")`)

    expect(node.callee).toBe(`_${APPLY_DIRECTIVES}`)
    expect(node.arguments).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: `_${CREATE_VNODE}`,
        arguments: [
          `"div"`,
          {
            type: NodeTypes.JS_OBJECT_EXPRESSION,
            properties: [
              {
                type: NodeTypes.JS_PROPERTY,
                key: _dir!.arg,
                value: _dir!.exp
              }
            ]
          },
          `null`,
          String(PatchFlags.NEED_PATCH) // should generate appropriate flag
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
    expect(root.imports).toContain(RESOLVE_DIRECTIVE)
    expect(root.statements[0]).toMatch(`${RESOLVE_DIRECTIVE}("foo")`)
    expect(root.statements[1]).toMatch(`${RESOLVE_DIRECTIVE}("bar")`)
    expect(root.statements[2]).toMatch(`${RESOLVE_DIRECTIVE}("baz")`)

    expect(node.callee).toBe(`_${APPLY_DIRECTIVES}`)
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

    test('CLASS', () => {
      const { node } = parseWithBind(`<div :class="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.CLASS))
    })

    test('STYLE', () => {
      const { node } = parseWithBind(`<div :style="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.STYLE))
    })

    test('PROPS', () => {
      const { node } = parseWithBind(`<div id="foo" :foo="bar" :baz="qux" />`)
      expect(node.arguments.length).toBe(5)
      expect(node.arguments[3]).toBe(String(PatchFlags.PROPS))
      expect(node.arguments[4]).toBe(`["foo", "baz"]`)
    })

    test('CLASS + STYLE + PROPS', () => {
      const { node } = parseWithBind(
        `<div id="foo" :class="cls" :style="styl" :foo="bar" :baz="qux"/>`
      )
      expect(node.arguments.length).toBe(5)
      expect(node.arguments[3]).toBe(
        String(PatchFlags.PROPS | PatchFlags.CLASS | PatchFlags.STYLE)
      )
      expect(node.arguments[4]).toBe(`["foo", "baz"]`)
    })

    test('FULL_PROPS (v-bind)', () => {
      const { node } = parseWithBind(`<div v-bind="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.FULL_PROPS))
    })

    test('FULL_PROPS (dynamic key)', () => {
      const { node } = parseWithBind(`<div :[foo]="bar" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.FULL_PROPS))
    })

    test('FULL_PROPS (w/ others)', () => {
      const { node } = parseWithBind(
        `<div id="foo" v-bind="bar" :class="cls" />`
      )
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.FULL_PROPS))
    })

    test('NEED_PATCH (static ref)', () => {
      const { node } = parseWithBind(`<div ref="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.NEED_PATCH))
    })

    test('NEED_PATCH (dynamic ref)', () => {
      const { node } = parseWithBind(`<div :ref="foo" />`)
      expect(node.arguments.length).toBe(4)
      expect(node.arguments[3]).toBe(String(PatchFlags.NEED_PATCH))
    })

    test('NEED_PATCH (custom directives)', () => {
      const { node } = parseWithBind(`<div v-foo />`)
      const vnodeCall = node.arguments[0] as CallExpression
      expect(vnodeCall.arguments.length).toBe(4)
      expect(vnodeCall.arguments[3]).toBe(String(PatchFlags.NEED_PATCH))
    })
  })
})
