import {
  BindingTypes,
  type CompilerOptions,
  type ElementNode,
  NodeTypes,
  type ObjectExpression,
  TO_HANDLER_KEY,
  type VNodeCall,
  helperNameMap,
  baseParse as parse,
  transform,
} from '@vue/compiler-core'
import { transformOn } from '../../src/transforms/vOn'
import { V_ON_WITH_KEYS, V_ON_WITH_MODIFIERS } from '../../src/runtimeHelpers'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { transformExpression } from '../../../compiler-core/src/transforms/transformExpression'
import { genFlagText } from '../../../compiler-core/__tests__/testUtils'
import { PatchFlags } from '@vue/shared'

function parseWithVOn(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformExpression, transformElement],
    directiveTransforms: {
      on: transformOn,
    },
    ...options,
  })
  const node = (ast.children[0] as ElementNode).codegenNode as VNodeCall
  return {
    root: ast,
    node,
    props: (node.props as ObjectExpression).properties,
  }
}

describe('compiler-dom: transform v-on', () => {
  it('should support multiple modifiers w/ prefixIdentifiers: true', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @click.stop.prevent="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_MODIFIERS,
        arguments: [{ content: '_ctx.test' }, '["stop","prevent"]'],
      },
    })
  })

  it('should support multiple events and modifiers options w/ prefixIdentifiers: true', () => {
    const { props } = parseWithVOn(
      `<div @click.stop="test" @keyup.enter="test" />`,
      {
        prefixIdentifiers: true,
      },
    )
    const [clickProp, keyUpProp] = props

    expect(props).toHaveLength(2)
    expect(clickProp).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_MODIFIERS,
        arguments: [{ content: '_ctx.test' }, '["stop"]'],
      },
    })
    expect(keyUpProp).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_KEYS,
        arguments: [{ content: '_ctx.test' }, '["enter"]'],
      },
    })
  })

  it('should support multiple modifiers and event options w/ prefixIdentifiers: true', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @click.stop.capture.once="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      key: {
        content: `onClickCaptureOnce`,
      },
      value: {
        callee: V_ON_WITH_MODIFIERS,
        arguments: [{ content: '_ctx.test' }, '["stop"]'],
      },
    })
  })

  it('should wrap keys guard for keyboard events or dynamic events', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @keydown.stop.capture.ctrl.a="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      key: {
        content: `onKeydownCapture`,
      },
      value: {
        callee: V_ON_WITH_KEYS,
        arguments: [
          {
            callee: V_ON_WITH_MODIFIERS,
            arguments: [{ content: '_ctx.test' }, '["stop","ctrl"]'],
          },
          '["a"]',
        ],
      },
    })
  })

  it('should not wrap keys guard if no key modifier is present', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @keyup.exact="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_MODIFIERS,
        arguments: [{ content: '_ctx.test' }, '["exact"]'],
      },
    })
  })

  it('should wrap keys guard for static key event w/ left/right modifiers', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @keyup.left="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_KEYS,
        arguments: [{ content: '_ctx.test' }, '["left"]'],
      },
    })
  })

  it('should wrap both for dynamic key event w/ left/right modifiers', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @[e].left="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_KEYS,
        arguments: [
          {
            callee: V_ON_WITH_MODIFIERS,
            arguments: [{ content: `_ctx.test` }, `["left"]`],
          },
          '["left"]',
        ],
      },
    })
  })

  it('should not wrap normal guard if there is only keys guard', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @keyup.enter="test"/>`, {
      prefixIdentifiers: true,
    })
    expect(prop).toMatchObject({
      type: NodeTypes.JS_PROPERTY,
      value: {
        callee: V_ON_WITH_KEYS,
        arguments: [{ content: '_ctx.test' }, '["enter"]'],
      },
    })
  })

  test('should transform click.right', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @click.right="test"/>`)
    expect(prop.key).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `onContextmenu`,
    })

    // dynamic
    const {
      props: [prop2],
    } = parseWithVOn(`<div @[event].right="test"/>`)
    // (_toHandlerKey(event)).toLowerCase() === "onclick" ? "onContextmenu" : (_toHandlerKey(event))
    expect(prop2.key).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `(`,
        {
          children: [
            `_${helperNameMap[TO_HANDLER_KEY]}(`,
            { content: 'event' },
            `)`,
          ],
        },
        `) === "onClick" ? "onContextmenu" : (`,
        {
          children: [
            `_${helperNameMap[TO_HANDLER_KEY]}(`,
            { content: 'event' },
            `)`,
          ],
        },
        `)`,
      ],
    })
  })

  test('should transform click.middle', () => {
    const {
      props: [prop],
    } = parseWithVOn(`<div @click.middle="test"/>`)
    expect(prop.key).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `onMouseup`,
    })

    // dynamic
    const {
      props: [prop2],
    } = parseWithVOn(`<div @[event].middle="test"/>`)
    // (_eventNaming(event)).toLowerCase() === "onclick" ? "onMouseup" : (_eventNaming(event))
    expect(prop2.key).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `(`,
        {
          children: [
            `_${helperNameMap[TO_HANDLER_KEY]}(`,
            { content: 'event' },
            `)`,
          ],
        },
        `) === "onClick" ? "onMouseup" : (`,
        {
          children: [
            `_${helperNameMap[TO_HANDLER_KEY]}(`,
            { content: 'event' },
            `)`,
          ],
        },
        `)`,
      ],
    })
  })

  test('cache handler w/ modifiers', () => {
    const {
      root,
      props: [prop],
    } = parseWithVOn(`<div @keyup.enter.capture="foo" />`, {
      prefixIdentifiers: true,
      cacheHandlers: true,
    })
    expect(root.cached).toBe(1)
    // should not treat cached handler as dynamicProp, so it should have no
    // dynamicProps flags and only the hydration flag
    expect((root as any).children[0].codegenNode.patchFlag).toBe(
      genFlagText(PatchFlags.NEED_HYDRATION),
    )
    expect(prop).toMatchObject({
      key: {
        content: `onKeyupCapture`,
      },
      value: {
        type: NodeTypes.JS_CACHE_EXPRESSION,
        index: 0,
        value: {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: V_ON_WITH_KEYS,
        },
      },
    })
  })

  test('should not have PROPS patchFlag for constant v-on handlers with modifiers', () => {
    const { node } = parseWithVOn(`<div @keydown.up="foo" />`, {
      prefixIdentifiers: true,
      bindingMetadata: {
        foo: BindingTypes.SETUP_CONST,
      },
      directiveTransforms: {
        on: transformOn,
      },
    })
    // should only have hydration flag
    expect(node.patchFlag).toBe(genFlagText(PatchFlags.NEED_HYDRATION))
  })
})
