import {
  type CallExpression,
  type CompilerOptions,
  type ElementNode,
  ErrorCodes,
  NodeTypes,
  type ObjectExpression,
  type VNodeCall,
  baseParse as parse,
  transform,
} from '../../src'
import { transformBind } from '../../src/transforms/vBind'
import { transformElement } from '../../src/transforms/transformElement'
import {
  CAMELIZE,
  NORMALIZE_PROPS,
  helperNameMap,
} from '../../src/runtimeHelpers'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformVBindShorthand } from '../../src/transforms/transformVBindShorthand'

function parseWithVBind(
  template: string,
  options: CompilerOptions = {},
): ElementNode {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      transformVBindShorthand,
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformElement,
    ],
    directiveTransforms: {
      bind: transformBind,
    },
    ...options,
  })
  return ast.children[0] as ElementNode
}

describe('compiler: transform v-bind', () => {
  test('basic', () => {
    const node = parseWithVBind(`<div v-bind:id="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `id`,
        isStatic: true,
        loc: {
          start: {
            line: 1,
            column: 13,
          },
          end: {
            line: 1,
            column: 15,
          },
        },
      },
      value: {
        content: `id`,
        isStatic: false,
        loc: {
          start: {
            line: 1,
            column: 17,
          },
          end: {
            line: 1,
            column: 19,
          },
        },
      },
    })
  })

  test('no expression', () => {
    const node = parseWithVBind(`<div v-bind:id />`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `id`,
        isStatic: true,
        loc: {
          start: { line: 1, column: 13, offset: 12 },
          end: { line: 1, column: 15, offset: 14 },
        },
      },
      value: {
        content: `id`,
        isStatic: false,
        loc: {
          start: { line: 1, column: 13, offset: 12 },
          end: { line: 1, column: 15, offset: 14 },
        },
      },
    })
  })

  test('no expression (shorthand)', () => {
    const node = parseWithVBind(`<div :id />`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `id`,
        isStatic: true,
      },
      value: {
        content: `id`,
        isStatic: false,
      },
    })
  })

  test('dynamic arg', () => {
    const node = parseWithVBind(`<div v-bind:[id]="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as CallExpression
    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `id || ""`,
                isStatic: false,
              },
              value: {
                content: `id`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('should error if empty expression', () => {
    const onError = vi.fn()
    const node = parseWithVBind(`<div v-bind:arg="" />`, { onError })
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_BIND_NO_EXPRESSION,
      loc: {
        start: {
          line: 1,
          column: 6,
        },
        end: {
          line: 1,
          column: 19,
        },
      },
    })
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `arg`,
        isStatic: true,
      },
      value: {
        content: ``,
        isStatic: true,
      },
    })
  })

  test('.camel modifier', () => {
    const node = parseWithVBind(`<div v-bind:foo-bar.camel="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `fooBar`,
        isStatic: true,
      },
      value: {
        content: `id`,
        isStatic: false,
      },
    })
  })

  test('.camel modifier w/ no expression', () => {
    const node = parseWithVBind(`<div v-bind:foo-bar.camel />`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `fooBar`,
        isStatic: true,
      },
      value: {
        content: `fooBar`,
        isStatic: false,
      },
    })
  })

  test('.camel modifier w/ dynamic arg', () => {
    const node = parseWithVBind(`<div v-bind:[foo].camel="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as CallExpression
    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `_${helperNameMap[CAMELIZE]}(foo || "")`,
                isStatic: false,
              },
              value: {
                content: `id`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('.camel modifier w/ dynamic arg + prefixIdentifiers', () => {
    const node = parseWithVBind(`<div v-bind:[foo(bar)].camel="id"/>`, {
      prefixIdentifiers: true,
    })
    const props = (node.codegenNode as VNodeCall).props as CallExpression
    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                children: [
                  `_${helperNameMap[CAMELIZE]}(`,
                  `(`,
                  { content: `_ctx.foo` },
                  `(`,
                  { content: `_ctx.bar` },
                  `)`,
                  `) || ""`,
                  `)`,
                ],
              },
              value: {
                content: `_ctx.id`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('.prop modifier', () => {
    const node = parseWithVBind(`<div v-bind:fooBar.prop="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `.fooBar`,
        isStatic: true,
      },
      value: {
        content: `id`,
        isStatic: false,
      },
    })
  })

  test('.prop modifier w/ no expression', () => {
    const node = parseWithVBind(`<div v-bind:fooBar.prop />`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `.fooBar`,
        isStatic: true,
      },
      value: {
        content: `fooBar`,
        isStatic: false,
      },
    })
  })

  test('.prop modifier w/ dynamic arg', () => {
    const node = parseWithVBind(`<div v-bind:[fooBar].prop="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as CallExpression
    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: '`.${fooBar || ""}`',
                isStatic: false,
              },
              value: {
                content: `id`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('.prop modifier w/ dynamic arg + prefixIdentifiers', () => {
    const node = parseWithVBind(`<div v-bind:[foo(bar)].prop="id"/>`, {
      prefixIdentifiers: true,
    })
    const props = (node.codegenNode as VNodeCall).props as CallExpression
    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                children: [
                  `'.' + (`,
                  `(`,
                  { content: `_ctx.foo` },
                  `(`,
                  { content: `_ctx.bar` },
                  `)`,
                  `) || ""`,
                  `)`,
                ],
              },
              value: {
                content: `_ctx.id`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('.prop modifier (shorthand)', () => {
    const node = parseWithVBind(`<div .fooBar="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `.fooBar`,
        isStatic: true,
      },
      value: {
        content: `id`,
        isStatic: false,
      },
    })
  })

  test('.prop modifier (shortband) w/ no expression', () => {
    const node = parseWithVBind(`<div .fooBar />`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `.fooBar`,
        isStatic: true,
      },
      value: {
        content: `fooBar`,
        isStatic: false,
      },
    })
  })

  test('.attr modifier', () => {
    const node = parseWithVBind(`<div v-bind:foo-bar.attr="id"/>`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `^foo-bar`,
        isStatic: true,
      },
      value: {
        content: `id`,
        isStatic: false,
      },
    })
  })

  test('.attr modifier w/ no expression', () => {
    const node = parseWithVBind(`<div v-bind:foo-bar.attr />`)
    const props = (node.codegenNode as VNodeCall).props as ObjectExpression
    expect(props.properties[0]).toMatchObject({
      key: {
        content: `^foo-bar`,
        isStatic: true,
      },
      value: {
        content: `fooBar`,
        isStatic: false,
      },
    })
  })

  test('error on invalid argument for same-name shorthand', () => {
    const onError = vi.fn()
    parseWithVBind(`<div v-bind:[arg] />`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_BIND_INVALID_SAME_NAME_ARGUMENT,
      loc: {
        start: {
          line: 1,
          column: 13,
        },
        end: {
          line: 1,
          column: 18,
        },
      },
    })
  })
})
