import {
  type CompilerOptions,
  type ElementNode,
  ErrorCodes,
  NodeTypes,
  type ObjectExpression,
  TO_HANDLER_KEY,
  type VNodeCall,
  helperNameMap,
  baseParse as parse,
  transform,
} from '../../src'
import { transformFor } from '../../src/transforms/vFor'
import { transformOn } from '../../src/transforms/vOn'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'

function parseWithVOn(template: string, options: CompilerOptions = {}) {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [transformExpression, transformElement, transformFor],
    directiveTransforms: {
      on: transformOn,
    },
    ...options,
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode,
  }
}

describe('compiler: transform v-on', () => {
  test('basic', () => {
    const { node } = parseWithVOn(`<div v-on:click="onClick"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: {
            content: `onClick`,
            isStatic: true,
            loc: {
              start: {
                line: 1,
                column: 11,
              },
              end: {
                line: 1,
                column: 16,
              },
            },
          },
          value: {
            content: `onClick`,
            isStatic: false,
            loc: {
              start: {
                line: 1,
                column: 18,
              },
              end: {
                line: 1,
                column: 25,
              },
            },
          },
        },
      ],
    })
  })

  test('dynamic arg', () => {
    const { node } = parseWithVOn(`<div v-on:[event]="handler"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              `_${helperNameMap[TO_HANDLER_KEY]}(`,
              { content: `event` },
              `)`,
            ],
          },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `handler`,
            isStatic: false,
          },
        },
      ],
    })
  })

  test('dynamic arg with prefixing', () => {
    const { node } = parseWithVOn(`<div v-on:[event]="handler"/>`, {
      prefixIdentifiers: true,
    })
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              `_${helperNameMap[TO_HANDLER_KEY]}(`,
              { content: `_ctx.event` },
              `)`,
            ],
          },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_ctx.handler`,
            isStatic: false,
          },
        },
      ],
    })
  })

  test('dynamic arg with complex exp prefixing', () => {
    const { node } = parseWithVOn(`<div v-on:[event(foo)]="handler"/>`, {
      prefixIdentifiers: true,
    })
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              `_${helperNameMap[TO_HANDLER_KEY]}(`,
              { content: `_ctx.event` },
              `(`,
              { content: `_ctx.foo` },
              `)`,
              `)`,
            ],
          },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_ctx.handler`,
            isStatic: false,
          },
        },
      ],
    })
  })

  test('should wrap as function if expression is inline statement', () => {
    const { node } = parseWithVOn(`<div @click="i++"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`$event => (`, { content: `i++` }, `)`],
          },
        },
      ],
    })
  })

  test('should handle multiple inline statement', () => {
    const { node } = parseWithVOn(`<div @click="foo();bar()"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            // should wrap with `{` for multiple statements
            // in this case the return value is discarded and the behavior is
            // consistent with 2.x
            children: [`$event => {`, { content: `foo();bar()` }, `}`],
          },
        },
      ],
    })
  })

  test('should handle multi-line statement', () => {
    const { node } = parseWithVOn(`<div @click="\nfoo();\nbar()\n"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            // should wrap with `{` for multiple statements
            // in this case the return value is discarded and the behavior is
            // consistent with 2.x
            children: [`$event => {`, { content: `\nfoo();\nbar()\n` }, `}`],
          },
        },
      ],
    })
  })

  test('inline statement w/ prefixIdentifiers: true', () => {
    const { node } = parseWithVOn(`<div @click="foo($event)"/>`, {
      prefixIdentifiers: true,
    })
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              `$event => (`,
              {
                type: NodeTypes.COMPOUND_EXPRESSION,
                children: [
                  { content: `_ctx.foo` },
                  `(`,
                  // should NOT prefix $event
                  { content: `$event` },
                  `)`,
                ],
              },
              `)`,
            ],
          },
        },
      ],
    })
  })

  test('multiple inline statements w/ prefixIdentifiers: true', () => {
    const { node } = parseWithVOn(`<div @click="foo($event);bar()"/>`, {
      prefixIdentifiers: true,
    })
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              `$event => {`,
              {
                children: [
                  { content: `_ctx.foo` },
                  `(`,
                  // should NOT prefix $event
                  { content: `$event` },
                  `);`,
                  { content: `_ctx.bar` },
                  `()`,
                ],
              },
              `}`,
            ],
          },
        },
      ],
    })
  })

  test('should NOT wrap as function if expression is already function expression', () => {
    const { node } = parseWithVOn(`<div @click="$event => foo($event)"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `$event => foo($event)`,
          },
        },
      ],
    })
  })

  test('should NOT wrap as function if expression is already function expression (with TypeScript)', () => {
    const { node } = parseWithVOn(`<div @click="(e: any): any => foo(e)"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `(e: any): any => foo(e)`,
          },
        },
      ],
    })

    const { node: node2 } = parseWithVOn(
      `<div @click="(e: (number | string)[]) => foo(e)"/>`,
    )
    expect((node2.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `(e: (number | string)[]) => foo(e)`,
          },
        },
      ],
    })
  })

  test('should NOT wrap as function if expression is already function expression (async)', () => {
    const { node } = parseWithVOn(
      `<div @click="async $event => await foo($event)"/>`,
    )
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `async $event => await foo($event)`,
          },
        },
      ],
    })
  })

  test('should NOT wrap as function if expression is already function expression (with newlines)', () => {
    const { node } = parseWithVOn(
      `<div @click="
      $event => {
        foo($event)
      }
    "/>`,
    )
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `
      $event => {
        foo($event)
      }
    `,
          },
        },
      ],
    })
  })

  test('should NOT wrap as function if expression is already function expression (with newlines + function keyword)', () => {
    const { node } = parseWithVOn(
      `<div @click="
      function($event) {
        foo($event)
      }
    "/>`,
    )
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `
      function($event) {
        foo($event)
      }
    `,
          },
        },
      ],
    })
  })

  test('should NOT wrap as function if expression is complex member expression', () => {
    const { node } = parseWithVOn(`<div @click="a['b' + c]"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `a['b' + c]`,
          },
        },
      ],
    })
  })

  test('complex member expression w/ prefixIdentifiers: true', () => {
    const { node } = parseWithVOn(`<div @click="a['b' + c]"/>`, {
      prefixIdentifiers: true,
    })
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              { content: `_ctx.a` },
              `['b' + `,
              { content: `_ctx.c` },
              `]`,
            ],
          },
        },
      ],
    })
  })

  test('function expression w/ prefixIdentifiers: true', () => {
    const { node } = parseWithVOn(`<div @click="e => foo(e)"/>`, {
      prefixIdentifiers: true,
    })
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: { content: `onClick` },
          value: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              { content: `e` },
              ` => `,
              { content: `_ctx.foo` },
              `(`,
              { content: `e` },
              `)`,
            ],
          },
        },
      ],
    })
  })

  test('should error if no expression AND no modifier', () => {
    const onError = vi.fn()
    parseWithVOn(`<div v-on:click />`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_ON_NO_EXPRESSION,
      loc: {
        start: {
          line: 1,
          column: 6,
        },
        end: {
          line: 1,
          column: 16,
        },
      },
    })
  })

  test('should NOT error if no expression but has modifier', () => {
    const onError = vi.fn()
    parseWithVOn(`<div v-on:click.prevent />`, { onError })
    expect(onError).not.toHaveBeenCalled()
  })

  test('case conversion for kebab-case events', () => {
    const { node } = parseWithVOn(`<div v-on:foo-bar="onMount"/>`)
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: {
            content: `onFooBar`,
          },
          value: {
            content: `onMount`,
          },
        },
      ],
    })
  })

  test('error for vnode hooks', () => {
    const onError = vi.fn()
    parseWithVOn(`<div v-on:vnode-mounted="onMount"/>`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_VNODE_HOOKS,
      loc: {
        start: {
          line: 1,
          column: 11,
        },
        end: {
          line: 1,
          column: 24,
        },
      },
    })
  })

  test('vue: prefixed events', () => {
    const { node } = parseWithVOn(
      `<div v-on:vue:mounted="onMount" @vue:before-update="onBeforeUpdate" />`,
    )
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      properties: [
        {
          key: {
            content: `onVnodeMounted`,
          },
          value: {
            content: `onMount`,
          },
        },
        {
          key: {
            content: `onVnodeBeforeUpdate`,
          },
          value: {
            content: `onBeforeUpdate`,
          },
        },
      ],
    })
  })

  describe('cacheHandler', () => {
    test('empty handler', () => {
      const { root, node } = parseWithVOn(`<div v-on:click.prevent />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
      })
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `() => {}`,
        },
      })
    })

    test('member expression handler', () => {
      const { root, node } = parseWithVOn(`<div v-on:click="foo" />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
      })
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [
            `(...args) => (`,
            { content: `_ctx.foo && _ctx.foo(...args)` },
            `)`,
          ],
        },
      })
    })

    test('compound member expression handler', () => {
      const { root, node } = parseWithVOn(`<div v-on:click="foo.bar" />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
      })
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [
            `(...args) => (`,
            {
              children: [
                { content: `_ctx.foo` },
                `.`,
                { content: `bar` },
                ` && `,
                { content: `_ctx.foo` },
                `.`,
                { content: `bar` },
                `(...args)`,
              ],
            },
            `)`,
          ],
        },
      })
    })

    test('bail on component member expression handler', () => {
      const { root } = parseWithVOn(`<comp v-on:click="foo" />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
        isNativeTag: tag => tag === 'div',
      })
      expect(root.cached.length).toBe(0)
    })

    test('should not be cached inside v-once', () => {
      const { root } = parseWithVOn(
        `<div v-once><div v-on:click="foo"/></div>`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )
      expect(root.cached.length).not.toBe(2)
      expect(root.cached.length).toBe(1)
    })

    test('unicode identifier should not be cached (v-for)', () => {
      const { root } = parseWithVOn(
        `<div v-for="项 in items" :key="value"><div v-on:click="foo(项)"/></div>`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )
      expect(root.cached.length).toBe(0)
    })

    test('inline function expression handler', () => {
      const { root, node } = parseWithVOn(`<div v-on:click="() => foo()" />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
      })
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [`() => `, { content: `_ctx.foo` }, `()`],
        },
      })
    })

    test('inline async arrow function expression handler', () => {
      const { root, node } = parseWithVOn(
        `<div v-on:click="async () => await foo()" />`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [`async () => await `, { content: `_ctx.foo` }, `()`],
        },
      })
    })

    test('inline async arrow function with no bracket expression handler', () => {
      const { root, node } = parseWithVOn(
        `<div v-on:click="async e => await foo(e)" />`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )

      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [
            `async `,
            { content: `e` },
            ` => await `,
            { content: `_ctx.foo` },
            `(`,
            { content: `e` },
            `)`,
          ],
        },
      })
    })

    test('inline async function expression handler', () => {
      const { root, node } = parseWithVOn(
        `<div v-on:click="async function () { await foo() } " />`,
        {
          prefixIdentifiers: true,
          cacheHandlers: true,
        },
      )
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [
            `async function () { await `,
            { content: `_ctx.foo` },
            `() } `,
          ],
        },
      })
    })

    test('inline statement handler', () => {
      const { root, node } = parseWithVOn(`<div v-on:click="foo++" />`, {
        prefixIdentifiers: true,
        cacheHandlers: true,
      })
      expect(root.cached.length).toBe(1)
      expect(root.cached.length).toBe(1)
      const vnodeCall = node.codegenNode as VNodeCall
      // should not treat cached handler as dynamicProp, so no flags
      expect(vnodeCall.patchFlag).toBeUndefined()
      expect(
        (vnodeCall.props as ObjectExpression).properties[0].value,
      ).toMatchObject({
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.COMPOUND_EXPRESSION,
          children: [
            `$event => (`,
            { children: [{ content: `_ctx.foo` }, `++`] },
            `)`,
          ],
        },
      })
    })
  })
})
