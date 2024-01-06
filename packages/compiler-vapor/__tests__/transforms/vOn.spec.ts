import { BindingTypes, ErrorCodes, NodeTypes, parse } from '@vue/compiler-dom'
import {
  type CompilerOptions,
  IRNodeTypes,
  type RootIRNode,
  compile as _compile,
  generate,
  transform,
} from '../../src'

import { transformVOn } from '../../src/transforms/vOn'
import { transformElement } from '../../src/transforms/transformElement'

function compileWithVOn(
  template: string,
  options: CompilerOptions = {},
): {
  ir: RootIRNode
  code: string
} {
  const ast = parse(template, { prefixIdentifiers: true, ...options })
  const ir = transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      on: transformVOn,
    },
    prefixIdentifiers: true,
    ...options,
  })
  const { code } = generate(ir, { prefixIdentifiers: true, ...options })
  return { ir, code }
}

describe('v-on', () => {
  test('simple expression', () => {
    const { code, ir } = compileWithVOn(`<div @click="handleClick"></div>`, {
      bindingMetadata: {
        handleClick: BindingTypes.SETUP_CONST,
      },
    })

    expect(ir.vaporHelpers).contains('on')
    expect(ir.helpers.size).toBe(0)
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
    const { code, ir } = compileWithVOn(`<div v-on:[event]="handler"/>`)

    expect(ir.vaporHelpers).contains('on')
    expect(ir.vaporHelpers).contains('renderEffect')
    expect(ir.helpers.size).toBe(0)
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

  test.todo('dynamic arg with prefixing')
  test.todo('dynamic arg with complex exp prefixing')
  test.todo('should wrap as function if expression is inline statement')
  test.todo('should handle multiple inline statement')
  test.todo('should handle multi-line statement')
  test.todo('inline statement w/ prefixIdentifiers: true')
  test.todo('multiple inline statements w/ prefixIdentifiers: true')
  test.todo(
    'should NOT wrap as function if expression is already function expression',
  )
  test.todo(
    'should NOT wrap as function if expression is already function expression (with Typescript)',
  )
  test.todo(
    'should NOT wrap as function if expression is already function expression (with newlines)',
  )
  test.todo(
    'should NOT wrap as function if expression is already function expression (with newlines + function keyword)',
  )
  test.todo(
    'should NOT wrap as function if expression is complex member expression',
  )
  test.todo('complex member expression w/ prefixIdentifiers: true')
  test.todo('function expression w/ prefixIdentifiers: true')

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
    const { ir, code } = compileWithVOn(`<div v-on:foo-bar="onMount"/>`)

    expect(ir.vaporHelpers).contains('on')
    expect(ir.helpers.size).toBe(0)
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
    const { code, ir } = compileWithVOn(
      `<div @click.stop.prevent.capture.once="test"/>`,
      {
        prefixIdentifiers: true,
      },
    )

    expect(ir.vaporHelpers).contains('on')
    expect(ir.vaporHelpers).contains('withModifiers')

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
    expect(code).contains('_withModifiers')
    expect(code).contains('["stop", "prevent"]')
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
    expect(code).contains(
      '_on(n1, "click", _withModifiers((...args) => (_ctx.test && _ctx.test(...args)), ["stop"]))',
    )
    expect(code).contains(
      '_on(n1, "keyup", _withKeys((...args) => (_ctx.test && _ctx.test(...args)), ["enter"]))',
    )
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
        modifiers: { keys: ['left'] },
      },
    ])

    expect(code).matchSnapshot()
  })

  test.todo('should wrap both for dynamic key event w/ left/right modifiers')

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
})
