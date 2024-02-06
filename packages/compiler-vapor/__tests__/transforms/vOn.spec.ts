import { BindingTypes, ErrorCodes, NodeTypes } from '@vue/compiler-dom'
import { IRNodeTypes, transformElement, transformVOn } from '../../src'
import { makeCompile } from './_utils'

const compileWithVOn = makeCompile({
  nodeTransforms: [transformElement],
  directiveTransforms: {
    on: transformVOn,
  },
})

describe('v-on', () => {
  test('simple expression', () => {
    const { code, ir, helpers, vaporHelpers } = compileWithVOn(
      `<div @click="handleClick"></div>`,
      {
        bindingMetadata: {
          handleClick: BindingTypes.SETUP_CONST,
        },
      },
    )

    expect(vaporHelpers).contains('on')
    expect(helpers.size).toBe(0)
    expect(ir.effect).toEqual([])

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        element: 1,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'click',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'handleClick',
          isStatic: false,
        },
        modifiers: { keys: [], nonKeys: [], options: [] },
        keyOverride: undefined,
      },
    ])

    expect(code).matchSnapshot()
  })

  test('event modifier', () => {
    const { code } = compileWithVOn(
      `<a @click.stop="handleEvent"></a>
        <form @submit.prevent="handleEvent"></form>
        <a @click.stop.prevent="handleEvent"></a>
        <div @click.self="handleEvent"></div>
        <div @click.capture="handleEvent"></div>
        <a @click.once="handleEvent"></a>
        <div @scroll.passive="handleEvent"></div>
        <input @click.right="handleEvent" />
        <input @click.left="handleEvent" />
        <input @click.middle="handleEvent" />
        <input @click.enter.right="handleEvent" />
        <input @keyup.enter="handleEvent" />
        <input @keyup.tab="handleEvent" />
        <input @keyup.delete="handleEvent" />
        <input @keyup.esc="handleEvent" />
        <input @keyup.space="handleEvent" />
        <input @keyup.up="handleEvent" />
        <input @keyup.down="handleEvent" />
        <input @keyup.left="handleEvent" />
        <input @keyup.middle="submit" />
        <input @keyup.middle.self="submit" />
        <input @keyup.self.enter="handleEvent" />`,
      {
        bindingMetadata: {
          handleEvent: BindingTypes.SETUP_CONST,
        },
      },
    )
    expect(code).matchSnapshot()
  })

  test('dynamic arg', () => {
    const { code, ir, helpers, vaporHelpers } = compileWithVOn(
      `<div v-on:[event]="handler"/>`,
    )

    expect(vaporHelpers).contains('on')
    expect(vaporHelpers).contains('renderEffect')
    expect(helpers.size).toBe(0)
    expect(ir.operation).toEqual([])

    expect(ir.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_EVENT,
      element: 1,
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'event',
        isStatic: false,
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'handler',
        isStatic: false,
      },
    })

    expect(code).matchSnapshot()
  })

  test('dynamic arg with prefixing', () => {
    const { code } = compileWithVOn(`<div v-on:[event]="handler"/>`, {
      prefixIdentifiers: true,
    })

    expect(code).matchSnapshot()
  })

  test('dynamic arg with complex exp prefixing', () => {
    const { ir, code, helpers, vaporHelpers } = compileWithVOn(
      `<div v-on:[event(foo)]="handler"/>`,
      {
        prefixIdentifiers: true,
      },
    )

    expect(vaporHelpers).contains('on')
    expect(vaporHelpers).contains('renderEffect')
    expect(helpers.size).toBe(0)
    expect(ir.operation).toEqual([])

    expect(ir.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_EVENT,
      element: 1,
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'event(foo)',
        isStatic: false,
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'handler',
        isStatic: false,
      },
    })

    expect(code).matchSnapshot()
  })

  test('should wrap as function if expression is inline statement', () => {
    const { code, ir, helpers, vaporHelpers } =
      compileWithVOn(`<div @click="i++"/>`)

    expect(vaporHelpers).contains('on')
    expect(helpers.size).toBe(0)
    expect(ir.effect).toEqual([])

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        element: 1,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'i++',
          isStatic: false,
        },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('_on(n1, "click", () => $event => (_ctx.i++))')
  })

  test('should wrap in unref if identifier is setup-maybe-ref w/ inline: true', () => {
    const { code, helpers, vaporHelpers } = compileWithVOn(
      `<div @click="x=y"/><div @click="x++"/><div @click="{ x } = y"/>`,
      {
        mode: 'module',
        inline: true,
        bindingMetadata: {
          x: BindingTypes.SETUP_MAYBE_REF,
          y: BindingTypes.SETUP_MAYBE_REF,
        },
      },
    )
    expect(code).matchSnapshot()

    expect(vaporHelpers).contains('unref')
    expect(helpers.size).toBe(0)
    expect(code).contains(
      '_on(n1, "click", () => $event => (x.value=_unref(y)))',
    )
    expect(code).contains('_on(n2, "click", () => $event => (x.value++))')
    expect(code).contains(
      '_on(n3, "click", () => $event => ({ x: x.value } = _unref(y)))',
    )
  })

  test('should handle multiple inline statement', () => {
    const { ir, code } = compileWithVOn(`<div @click="foo();bar()"/>`)

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: 'foo();bar()' },
      },
    ])

    expect(code).matchSnapshot()
    // should wrap with `{` for multiple statements
    // in this case the return value is discarded and the behavior is
    // consistent with 2.x
    expect(code).contains(
      '_on(n1, "click", () => $event => {_ctx.foo();_ctx.bar()})',
    )
  })

  test('should handle multi-line statement', () => {
    const { code, ir } = compileWithVOn(`<div @click="\nfoo();\nbar()\n"/>`)

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: '\nfoo();\nbar()\n' },
      },
    ])

    expect(code).matchSnapshot()
    // should wrap with `{` for multiple statements
    // in this case the return value is discarded and the behavior is
    // consistent with 2.x
    expect(code).contains(
      '_on(n1, "click", () => $event => {\n_ctx.foo();\n_ctx.bar()\n})',
    )
  })

  test('inline statement w/ prefixIdentifiers: true', () => {
    const { code, ir } = compileWithVOn(`<div @click="foo($event)"/>`, {
      prefixIdentifiers: true,
    })

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: 'foo($event)' },
      },
    ])

    expect(code).matchSnapshot()
    // should NOT prefix $event
    expect(code).contains(
      '_on(n1, "click", () => $event => (_ctx.foo($event)))',
    )
  })

  test('multiple inline statements w/ prefixIdentifiers: true', () => {
    const { ir, code } = compileWithVOn(`<div @click="foo($event);bar()"/>`, {
      prefixIdentifiers: true,
    })

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: 'foo($event);bar()' },
      },
    ])

    expect(code).matchSnapshot()
    // should NOT prefix $event
    expect(code).contains(
      '_on(n1, "click", () => $event => {_ctx.foo($event);_ctx.bar()})',
    )
  })

  test('should NOT wrap as function if expression is already function expression', () => {
    const { code, ir } = compileWithVOn(`<div @click="$event => foo($event)"/>`)

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: '$event => foo($event)' },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('_on(n1, "click", () => $event => _ctx.foo($event))')
  })

  test('should NOT wrap as function if expression is already function expression (with Typescript)', () => {
    const { ir, code } = compileWithVOn(
      `<div @click="(e: any): any => foo(e)"/>`,
      { expressionPlugins: ['typescript'] },
    )

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: '(e: any): any => foo(e)' },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains(
      '_on(n1, "click", () => (e: any): any => _ctx.foo(e))',
    )
  })

  test('should NOT wrap as function if expression is already function expression (with newlines)', () => {
    const { ir, code } = compileWithVOn(
      `<div @click="
      $event => {
        foo($event)
      }
    "/>`,
    )

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: {
          content: `
      $event => {
        foo($event)
      }
    `,
        },
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should NOT add a prefix to $event if the expression is a function expression', () => {
    const { ir, code } = compileWithVOn(
      `<div @click="$event => {i++;foo($event)}"></div>`,
      {
        prefixIdentifiers: true,
      },
    )

    expect(ir.operation[0]).toMatchObject({
      type: IRNodeTypes.SET_EVENT,
      value: { content: '$event => {i++;foo($event)}' },
    })

    expect(code).matchSnapshot()
  })

  test('should NOT wrap as function if expression is complex member expression', () => {
    const { ir, code } = compileWithVOn(`<div @click="a['b' + c]"/>`)
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: `a['b' + c]` },
      },
    ])

    expect(code).matchSnapshot()
  })

  test('complex member expression w/ prefixIdentifiers: true', () => {
    const { ir, code } = compileWithVOn(`<div @click="a['b' + c]"/>`)
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: `a['b' + c]` },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains(`_on(n1, "click", () => _ctx.a['b' + _ctx.c])`)
  })

  test('function expression w/ prefixIdentifiers: true', () => {
    const { code, ir } = compileWithVOn(`<div @click="e => foo(e)"/>`, {
      prefixIdentifiers: true,
    })

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: { content: `e => foo(e)` },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('_on(n1, "click", () => e => _ctx.foo(e))')
  })

  test('should error if no expression AND no modifier', () => {
    const onError = vi.fn()
    compileWithVOn(`<div v-on:click />`, { onError })
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
    compileWithVOn(`<div v-on:click.prevent />`, { onError })
    expect(onError).not.toHaveBeenCalled()
  })

  test('case conversion for kebab-case events', () => {
    const { ir, code, helpers, vaporHelpers } = compileWithVOn(
      `<div v-on:foo-bar="onMount"/>`,
    )

    expect(vaporHelpers).contains('on')
    expect(helpers.size).toBe(0)
    expect(ir.effect).toEqual([])

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        element: 1,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'fooBar',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'onMount',
          isStatic: false,
        },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('fooBar')
  })

  test('error for vnode hooks', () => {
    const onError = vi.fn()
    compileWithVOn(`<div v-on:vnode-mounted="onMount"/>`, { onError })
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

  test.todo('vue: prefixed events')

  test('should support multiple modifiers and event options w/ prefixIdentifiers: true', () => {
    const { code, ir, vaporHelpers } = compileWithVOn(
      `<div @click.stop.prevent.capture.once="test"/>`,
      {
        prefixIdentifiers: true,
      },
    )

    expect(vaporHelpers).contains('on')
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'test',
          isStatic: false,
        },
        modifiers: {
          keys: [],
          nonKeys: ['stop', 'prevent'],
          options: ['capture', 'once'],
        },
        keyOverride: undefined,
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('modifiers: ["stop", "prevent"]')
    expect(code).contains('{ capture: true, once: true }')
  })

  test('should support multiple events and modifiers options w/ prefixIdentifiers: true', () => {
    const { code, ir } = compileWithVOn(
      `<div @click.stop="test" @keyup.enter="test" />`,
      {
        prefixIdentifiers: true,
      },
    )

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'click',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'test',
          isStatic: false,
        },
        modifiers: {
          keys: [],
          nonKeys: ['stop'],
          options: [],
        },
      },
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'keyup',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'test',
          isStatic: false,
        },
        modifiers: {
          keys: ['enter'],
          nonKeys: [],
          options: [],
        },
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains(`_on(n1, "click", () => _ctx.test, undefined`)
    expect(code).contains(`modifiers: ["stop"]`)

    expect(code).contains(`_on(n1, "keyup", () => _ctx.test, undefined`)
    expect(code).contains(`keys: ["enter"]`)
  })

  test('should wrap keys guard for keyboard events or dynamic events', () => {
    const { code, ir } = compileWithVOn(
      `<div @keydown.stop.capture.ctrl.a="test"/>`,
      {
        prefixIdentifiers: true,
      },
    )

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        element: 1,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'keydown',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'test',
          isStatic: false,
        },
        modifiers: {
          keys: ['a'],
          nonKeys: ['stop', 'ctrl'],
          options: ['capture'],
        },
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should not wrap keys guard if no key modifier is present', () => {
    const { code, ir } = compileWithVOn(`<div @keyup.exact="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        modifiers: { nonKeys: ['exact'] },
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should wrap keys guard for static key event w/ left/right modifiers', () => {
    const { code, ir } = compileWithVOn(`<div @keyup.left="test"/>`, {
      prefixIdentifiers: true,
    })

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        modifiers: {
          keys: ['left'],
          nonKeys: [],
          options: [],
        },
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should wrap both for dynamic key event w/ left/right modifiers', () => {
    const { code, ir } = compileWithVOn(`<div @[e].left="test"/>`, {
      prefixIdentifiers: true,
    })

    expect(ir.effect[0].operations).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'e',
          isStatic: false,
        },
        modifiers: {
          keys: ['left'],
          nonKeys: ['left'],
          options: [],
        },
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should transform click.right', () => {
    const { code, ir } = compileWithVOn(`<div @click.right="test"/>`)
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'contextmenu',
          isStatic: true,
        },
        modifiers: { nonKeys: ['right'] },
        keyOverride: undefined,
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('"contextmenu"')

    // dynamic
    const { code: code2, ir: ir2 } = compileWithVOn(
      `<div @[event].right="test"/>`,
    )
    expect(ir2.effect[0].operations).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'event',
          isStatic: false,
        },
        modifiers: { nonKeys: ['right'] },
        keyOverride: ['click', 'contextmenu'],
      },
    ])

    expect(code2).matchSnapshot()
    expect(code2).contains(
      '(_ctx.event) === "click" ? "contextmenu" : (_ctx.event)',
    )
  })

  test('should transform click.middle', () => {
    const { code, ir } = compileWithVOn(`<div @click.middle="test"/>`)
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'mouseup',
          isStatic: true,
        },
        modifiers: { nonKeys: ['middle'] },
        keyOverride: undefined,
      },
    ])

    expect(code).matchSnapshot()
    expect(code).contains('"mouseup"')

    // dynamic
    const { code: code2, ir: ir2 } = compileWithVOn(
      `<div @[event].middle="test"/>`,
    )

    expect(ir2.effect[0].operations).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'event',
          isStatic: false,
        },
        modifiers: { nonKeys: ['middle'] },
        keyOverride: ['click', 'mouseup'],
      },
    ])

    expect(code2).matchSnapshot()
    expect(code2).contains(
      '(_ctx.event) === "click" ? "mouseup" : (_ctx.event)',
    )
  })

  test('should not prefix member expression', () => {
    const { code } = compileWithVOn(`<div @click="foo.bar"/>`, {
      prefixIdentifiers: true,
    })

    expect(code).matchSnapshot()
    expect(code).contains(`_on(n1, "click", () => _ctx.foo.bar)`)
  })
})
