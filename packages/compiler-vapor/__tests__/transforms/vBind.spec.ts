import {
  type RootNode,
  ErrorCodes,
  NodeTypes,
  BindingTypes,
} from '@vue/compiler-dom'
import {
  type RootIRNode,
  type CompilerOptions,
  parse,
  transform,
  transformVBind,
  transformElement,
  IRNodeTypes,
  compile as _compile,
} from '../../src'

function parseWithVBind(
  template: string,
  options: CompilerOptions = {},
): RootIRNode {
  const ast = parse(template)
  const ir = transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      bind: transformVBind,
    },
    ...options,
  })
  return ir
}

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

describe('compiler: transform v-bind', () => {
  test('basic', () => {
    const node = parseWithVBind(`<div v-bind:id="id"/>`)

    expect(node.dynamic.children[0]).toMatchObject({
      id: 1,
      referenced: true,
    })
    expect(node.template[0]).toMatchObject({
      type: IRNodeTypes.TEMPLATE_FACTORY,
      template: '<div></div>',
    })
    expect(node.effect).lengthOf(1)
    expect(node.effect[0].expressions).lengthOf(1)
    expect(node.effect[0].operations).lengthOf(1)
    expect(node.effect[0]).toMatchObject({
      expressions: [
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'id',
          isStatic: false,
        },
      ],
      operations: [
        {
          type: IRNodeTypes.SET_PROP,
          element: 1,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'id',
            isStatic: true,
            loc: {
              start: { line: 1, column: 13, offset: 12 },
              end: { line: 1, column: 15, offset: 14 },
              source: 'id',
            },
          },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'id',
            isStatic: false,
            loc: {
              source: 'id',
              start: { line: 1, column: 17, offset: 16 },
              end: { line: 1, column: 19, offset: 18 },
            },
          },
        },
      ],
    })
  })

  test('no expression', () => {
    const node = parseWithVBind(`<div v-bind:id />`)

    expect(node.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_PROP,
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

    expect(node.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_PROP,
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
    expect(node.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_PROP,
      element: 1,
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'id',
        isStatic: false,
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'id',
        isStatic: false,
      },
    })
  })

  test('should error if empty expression', () => {
    const onError = vi.fn()
    const node = parseWithVBind(`<div v-bind:arg="" />`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_BIND_NO_EXPRESSION,
      loc: {
        start: { line: 1, column: 6 },
        end: { line: 1, column: 19 },
      },
    })
    expect(node.template[0]).toMatchObject({
      type: IRNodeTypes.TEMPLATE_FACTORY,
      template: '<div arg=""></div>',
    })
  })

  test.fails('.camel modifier', () => {
    const node = parseWithVBind(`<div v-bind:foo-bar.camel="id"/>`)
    expect(node.effect[0].operations[0]).toMatchObject({
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

  test.fails('.camel modifier w/ no expression', () => {
    const node = parseWithVBind(`<div v-bind:foo-bar.camel />`)
    expect(node.effect[0].operations[0]).toMatchObject({
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

  test.fails('.camel modifier w/ dynamic arg', () => {
    const node = parseWithVBind(`<div v-bind:[foo].camel="id"/>`)
    expect(node.effect[0].operations[0]).toMatchObject({
      key: {
        content: `foo`,
        isStatic: false,
        somethingShouldBeTrue: true,
      },
      value: {
        content: `id`,
        isStatic: false,
      },
    })
  })

  test.todo('.camel modifier w/ dynamic arg + prefixIdentifiers')

  test.todo('.prop modifier')
  test.todo('.prop modifier w/ no expression')
  test.todo('.prop modifier w/ dynamic arg')
  test.todo('.prop modifier w/ dynamic arg + prefixIdentifiers')
  test.todo('.prop modifier (shorthand)')
  test.todo('.prop modifier (shortband) w/ no expression')
  test.todo('.attr modifier')
  test.todo('.attr modifier w/ no expression')
})

// TODO: combine with above
describe('compiler: codegen v-bind', () => {
  test('simple expression', () => {
    const code = compile(`<div :id="id"></div>`, {
      bindingMetadata: {
        id: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  test('should error if no expression', () => {
    const onError = vi.fn()
    const code = compile(`<div v-bind:arg="" />`, { onError })

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

    expect(code).matchSnapshot()
    // the arg is static
    expect(code).contains(JSON.stringify('<div arg=""></div>'))
  })

  test('no expression', () => {
    const code = compile('<div v-bind:id />', {
      bindingMetadata: {
        id: BindingTypes.SETUP_REF,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n1, "id", undefined, _ctx.id)')
  })

  test('no expression (shorthand)', () => {
    const code = compile('<div :camel-case />', {
      bindingMetadata: {
        camelCase: BindingTypes.SETUP_REF,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains(
      '_setAttr(n1, "camel-case", undefined, _ctx.camelCase)',
    )
  })

  test('dynamic arg', () => {
    const code = compile('<div v-bind:[id]="id"/>', {
      bindingMetadata: {
        id: BindingTypes.SETUP_REF,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n1, _ctx.id, undefined, _ctx.id)')
  })

  // TODO: camel modifier for v-bind
  test.fails('.camel modifier', () => {
    const code = compile(`<div v-bind:foo-bar.camel="id"/>`)

    expect(code).matchSnapshot()
    expect(code).contains('fooBar')
  })
})
