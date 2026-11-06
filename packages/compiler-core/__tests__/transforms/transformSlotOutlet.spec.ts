import {
  BindingTypes,
  type CompilerOptions,
  type ElementNode,
  ErrorCodes,
  NodeTypes,
  baseCompile,
  baseParse as parse,
  transform,
} from '../../src'
import { transformElement } from '../../src/transforms/transformElement'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { transformExpression } from '../../src/transforms/transformExpression'
import { RENDER_SLOT } from '../../src/runtimeHelpers'
import { transformSlotOutlet } from '../../src/transforms/transformSlotOutlet'

function parseWithSlots(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformSlotOutlet,
      transformElement,
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind,
    },
    ...options,
  })
  return ast
}

describe('compiler: transform <slot> outlets', () => {
  test('default slot outlet', () => {
    const ast = parseWithSlots(`<slot/>`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [`$slots`, `"default"`],
    })
  })

  test('statically named slot outlet', () => {
    const ast = parseWithSlots(`<slot name="foo" />`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [`$slots`, `"foo"`],
    })
  })

  test('dynamically named slot outlet', () => {
    const ast = parseWithSlots(`<slot :name="foo" />`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `foo`,
          isStatic: false,
        },
      ],
    })
  })

  test('dynamically named slot outlet w/ prefixIdentifiers: true', () => {
    const ast = parseWithSlots(`<slot :name="foo + bar" />`, {
      prefixIdentifiers: true,
    })
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `_ctx.$slots`,
        {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `_ctx.foo`,
              isStatic: false,
            },
            ` + `,
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `_ctx.bar`,
              isStatic: false,
            },
          ],
        },
      ],
    })
  })

  test('default slot outlet with props', () => {
    const ast = parseWithSlots(
      `<slot foo="bar" :baz="qux" :foo-bar="foo-bar" />`,
    )
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        `"default"`,
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `foo`,
                isStatic: true,
              },
              value: {
                content: `bar`,
                isStatic: true,
              },
            },
            {
              key: {
                content: `baz`,
                isStatic: true,
              },
              value: {
                content: `qux`,
                isStatic: false,
              },
            },
            {
              key: {
                content: `fooBar`,
                isStatic: true,
              },
              value: {
                content: `foo-bar`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('statically named slot outlet with props', () => {
    const ast = parseWithSlots(`<slot name="foo" foo="bar" :baz="qux" />`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        `"foo"`,
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          // props should not include name
          properties: [
            {
              key: {
                content: `foo`,
                isStatic: true,
              },
              value: {
                content: `bar`,
                isStatic: true,
              },
            },
            {
              key: {
                content: `baz`,
                isStatic: true,
              },
              value: {
                content: `qux`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('dynamically named slot outlet with props', () => {
    const ast = parseWithSlots(`<slot :name="foo" foo="bar" :baz="qux" />`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        { content: `foo`, isStatic: false },
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          // props should not include name
          properties: [
            {
              key: {
                content: `foo`,
                isStatic: true,
              },
              value: {
                content: `bar`,
                isStatic: true,
              },
            },
            {
              key: {
                content: `baz`,
                isStatic: true,
              },
              value: {
                content: `qux`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
  })

  test('default slot outlet with fallback', () => {
    const ast = parseWithSlots(`<slot><div/></slot>`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        `"default"`,
        `{}`,
        {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: [],
          returns: [
            {
              type: NodeTypes.ELEMENT,
              tag: `div`,
            },
          ],
        },
      ],
    })
  })

  test('named slot outlet with fallback', () => {
    const ast = parseWithSlots(`<slot name="foo"><div/></slot>`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        `"foo"`,
        `{}`,
        {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: [],
          returns: [
            {
              type: NodeTypes.ELEMENT,
              tag: `div`,
            },
          ],
        },
      ],
    })
  })

  test('default slot outlet with props & fallback', () => {
    const ast = parseWithSlots(`<slot :foo="bar"><div/></slot>`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        `"default"`,
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `foo`,
                isStatic: true,
              },
              value: {
                content: `bar`,
                isStatic: false,
              },
            },
          ],
        },
        {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: [],
          returns: [
            {
              type: NodeTypes.ELEMENT,
              tag: `div`,
            },
          ],
        },
      ],
    })
  })

  test('named slot outlet with props & fallback', () => {
    const ast = parseWithSlots(`<slot name="foo" :foo="bar"><div/></slot>`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        `"foo"`,
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: `foo`,
                isStatic: true,
              },
              value: {
                content: `bar`,
                isStatic: false,
              },
            },
          ],
        },
        {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: [],
          returns: [
            {
              type: NodeTypes.ELEMENT,
              tag: `div`,
            },
          ],
        },
      ],
    })
  })

  test('slot with slotted: false', async () => {
    const ast = parseWithSlots(`<slot/>`, { slotted: false, scopeId: 'foo' })
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [`$slots`, `"default"`, `{}`, `undefined`, `true`],
    })
    const fallback = parseWithSlots(`<slot>fallback</slot>`, {
      slotted: false,
      scopeId: 'foo',
    })

    const child = {
      type: NodeTypes.JS_FUNCTION_EXPRESSION,
      params: [],
      returns: [
        {
          type: NodeTypes.TEXT,
          content: `fallback`,
        },
      ],
    }
    expect((fallback.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [`$slots`, `"default"`, `{}`, child, `true`],
    })
  })

  test(`error on unexpected custom directive on <slot>`, () => {
    const onError = vi.fn()
    const source = `<slot v-foo />`
    parseWithSlots(source, { onError })
    const index = source.indexOf('v-foo')
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
      loc: {
        start: {
          offset: index,
          line: 1,
          column: index + 1,
        },
        end: {
          offset: index + 5,
          line: 1,
          column: index + 6,
        },
      },
    })
  })

  test('dynamically named slot outlet with v-bind shorthand', () => {
    const ast = parseWithSlots(`<slot :name />`)
    expect((ast.children[0] as ElementNode).codegenNode).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: RENDER_SLOT,
      arguments: [
        `$slots`,
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `name`,
          isStatic: false,
        },
      ],
    })
  })

  describe('lazy slot props (getter) for setup ref bindings', () => {
    test('setup-ref prop does NOT become a getter in non-inline mode', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_REF },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0]).toMatchObject({
        key: { content: 'title', isStatic: true },
        value: { content: '$setup.title' },
      })
      expect(props.properties[0].isGetter).toBeUndefined()
    })

    test('setup-maybe-ref prop becomes a getter', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_MAYBE_REF },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBe(true)
    })

    test('setup-let prop becomes a getter', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_LET },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBe(true)
    })

    test('setup-const prop does NOT become a getter', () => {
      const ast = parseWithSlots(`<slot :count="count" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { count: BindingTypes.SETUP_CONST },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBeUndefined()
    })

    test('mixed: only setup-computed prop gets getter, non-ref prop does not', () => {
      const ast = parseWithSlots(`<slot :title="title" :count="count" />`, {
        prefixIdentifiers: true,
        bindingMetadata: {
          title: BindingTypes.SETUP_COMPUTED,
          count: BindingTypes.SETUP_CONST,
        },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      const titleProp = props.properties.find(
        (p: any) => p.key.content === 'title',
      )
      const countProp = props.properties.find(
        (p: any) => p.key.content === 'count',
      )
      expect(titleProp.isGetter).toBe(true)
      expect(countProp.isGetter).toBeUndefined()
    })

    test('non-simple-identifier expression is not made a getter', () => {
      const ast = parseWithSlots(`<slot :title="title.toUpperCase()" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_REF },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBeUndefined()
    })

    test('no bindingMetadata: no getter applied', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBeUndefined()
    })

    test('codegen: setup-ref slot prop does NOT emit getter syntax', () => {
      const { code } = baseCompile(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_REF },
      })
      expect(code).toContain('{ title: $setup.title }')
    })

    test('setup-computed prop becomes a getter', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_COMPUTED },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBe(true)
    })

    test('setup-ref prop does NOT become a getter in inline mode', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        inline: true,
        bindingMetadata: { title: BindingTypes.SETUP_REF },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBe(undefined)
    })

    test('setup-computed prop becomes a getter in inline mode', () => {
      const ast = parseWithSlots(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        inline: true,
        bindingMetadata: { title: BindingTypes.SETUP_COMPUTED },
      })
      const props = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(props.properties[0].isGetter).toBe(true)
    })

    test('codegen: setup-computed slot prop emits getter syntax', () => {
      const { code } = baseCompile(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: { title: BindingTypes.SETUP_COMPUTED },
      })
      expect(code).toContain('get title() { return $setup.title }')
    })

    test('codegen: setup-ref slot prop does NOT emit getter syntax in inline mode', () => {
      const { code } = baseCompile(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        inline: true,
        bindingMetadata: { title: BindingTypes.SETUP_REF },
      })
      expect(code).toContain('{ title: title.value }')
    })

    test('codegen: setup-computed slot prop emits getter syntax in inline mode', () => {
      const { code } = baseCompile(`<slot :title="title" />`, {
        prefixIdentifiers: true,
        inline: true,
        bindingMetadata: { title: BindingTypes.SETUP_COMPUTED },
      })
      expect(code).toContain('get title() { return title.value }')
    })

    test('dynamic key: setup-computed prop becomes a getter', () => {
      const ast = parseWithSlots(`<slot :[key]="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: {
          key: BindingTypes.SETUP_REF,
          title: BindingTypes.SETUP_COMPUTED,
        },
      })
      // dynamic key wraps with normalizeProps
      const slotProps = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(slotProps.type).toBe(NodeTypes.JS_CALL_EXPRESSION)
      // unwrap normalizeProps to get the inner ObjectExpression
      const innerObj = slotProps.arguments[0]
      expect(innerObj.type).toBe(NodeTypes.JS_OBJECT_EXPRESSION)
      expect(innerObj.properties[0].isGetter).toBe(true)
    })

    test('dynamic key: setup-ref prop does NOT become a getter', () => {
      const ast = parseWithSlots(`<slot :[key]="name" />`, {
        prefixIdentifiers: true,
        bindingMetadata: {
          key: BindingTypes.SETUP_REF,
          name: BindingTypes.SETUP_REF,
        },
      })
      const slotProps = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      const innerObj = slotProps.arguments[0]
      expect(innerObj.properties[0].isGetter).toBeUndefined()
    })

    test('dynamic key: mixed static and dynamic keys', () => {
      const ast = parseWithSlots(
        `<slot :[key]="title" :count="count" :label="label" />`,
        {
          prefixIdentifiers: true,
          bindingMetadata: {
            key: BindingTypes.SETUP_REF,
            title: BindingTypes.SETUP_COMPUTED,
            count: BindingTypes.SETUP_CONST,
            label: BindingTypes.SETUP_MAYBE_REF,
          },
        },
      )
      const slotProps = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      // dynamic key present → normalizeProps wrapping
      const innerObj = slotProps.arguments[0]
      const titleProp = innerObj.properties.find(
        (p: any) => p.value.loc.source.trim() === 'title',
      )
      const countProp = innerObj.properties.find(
        (p: any) => p.value.loc.source.trim() === 'count',
      )
      const labelProp = innerObj.properties.find(
        (p: any) => p.value.loc.source.trim() === 'label',
      )
      expect(titleProp.isGetter).toBe(true)
      expect(countProp.isGetter).toBeUndefined()
      expect(labelProp.isGetter).toBe(true)
    })

    test('codegen: dynamic key with setup-computed emits getter syntax', () => {
      const { code } = baseCompile(`<slot :[key]="title" :b="b" />`, {
        prefixIdentifiers: true,
        bindingMetadata: {
          key: BindingTypes.SETUP_REF,
          title: BindingTypes.SETUP_COMPUTED,
          b: BindingTypes.SETUP_CONST,
        },
      })
      expect(code).toContain('get [$setup.key || ""]() { return $setup.title }')
      expect(code).toContain('b: $setup.b')
    })

    test('codegen: dynamic key with setup-computed in inline mode', () => {
      const { code } = baseCompile(`<slot :[key]="title" :b="b" />`, {
        prefixIdentifiers: true,
        inline: true,
        bindingMetadata: {
          key: BindingTypes.SETUP_REF,
          title: BindingTypes.SETUP_COMPUTED,
          b: BindingTypes.SETUP_CONST,
        },
      })
      expect(code).toContain('get [key.value || ""]() { return title.value }')
    })

    test('mergeProps: setup-computed prop becomes a getter', () => {
      const ast = parseWithSlots(`<slot v-bind="{ a: 0 }" :title="title" />`, {
        prefixIdentifiers: true,
        bindingMetadata: {
          title: BindingTypes.SETUP_COMPUTED,
        },
      })
      // v-bind="obj" + named prop → mergeProps(obj, { title: ... })
      const slotProps = ((ast.children[0] as ElementNode).codegenNode as any)
        .arguments[2]
      expect(slotProps.type).toBe(NodeTypes.JS_CALL_EXPRESSION)
      // the title prop is in the second argument of mergeProps
      const secondArg = slotProps.arguments[1]
      expect(secondArg.type).toBe(NodeTypes.JS_OBJECT_EXPRESSION)
      const titleProp = secondArg.properties.find(
        (p: any) => p.value.loc.source.trim() === 'title',
      )
      expect(titleProp.isGetter).toBe(true)
    })

    test('codegen: mergeProps with setup-computed emits getter syntax', () => {
      const { code } = baseCompile(
        `<slot v-bind="{ a: 0 }" :title="title" />`,
        {
          prefixIdentifiers: true,
          bindingMetadata: {
            title: BindingTypes.SETUP_COMPUTED,
          },
        },
      )
      expect(code).toContain('get title() { return $setup.title }')
      expect(code).toContain('{ a: 0 }')
    })
  })
})
