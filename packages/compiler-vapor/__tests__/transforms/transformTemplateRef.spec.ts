import { BindingTypes } from '@vue/compiler-dom'
import {
  DynamicFlag,
  type ForIRNode,
  IRNodeTypes,
  type IfIRNode,
  transformChildren,
  transformElement,
  transformTemplateRef,
  transformVFor,
  transformVIf,
  transformVSlot,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithTransformRef = makeCompile({
  nodeTransforms: [
    transformVIf,
    transformVFor,
    transformTemplateRef,
    transformElement,
    transformVSlot,
    transformChildren,
  ],
})

describe('compiler: template ref transform', () => {
  test('static ref', () => {
    const { ir, code } = compileWithTransformRef(`<div ref="foo" />`)

    expect(ir.block.dynamic.children[0]).toMatchObject({
      id: 0,
      flags: DynamicFlag.REFERENCED,
    })
    expect([...ir.template.keys()]).toEqual(['<div>'])
    expect(ir.block.operation).lengthOf(1)
    expect(ir.block.operation[0]).toMatchObject({
      type: IRNodeTypes.SET_TEMPLATE_REF,
      element: 0,
      value: {
        content: 'foo',
        isStatic: true,
        loc: {
          start: { line: 1, column: 10, offset: 9 },
          end: { line: 1, column: 15, offset: 14 },
        },
      },
    })
    expect(code).matchSnapshot()
    expect(code).contains('_setStaticTemplateRef(n0, "foo")')
    expect(code).not.contains('_createTemplateRefSetter')
  })

  test('static ref (inline mode)', () => {
    const { code } = compileWithTransformRef(`<div ref="foo" />`, {
      inline: true,
      bindingMetadata: { foo: BindingTypes.SETUP_REF },
    })
    expect(code).matchSnapshot()
    // pass the actual ref and ref key
    expect(code).contains('_setStaticTemplateRef(n0, foo, null, "foo")')
    expect(code).not.contains('_createTemplateRefSetter')
  })

  test('multiple static refs', () => {
    const { code } = compileWithTransformRef(
      `<div ref="foo" /><div ref="bar" />`,
    )
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_setTemplateRef(n0, "foo")')
    expect(code).contains('_setTemplateRef(n1, "bar")')
    expect(code).not.contains('_setStaticTemplateRef')
    expect(code).not.contains('_setTemplateRefBinding')
  })

  test('static and dynamic refs', () => {
    const { code } = compileWithTransformRef(
      `<div ref="foo" /><div :ref="bar" />`,
    )
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_setTemplateRef(n0, "foo")')
    expect(code).contains('_setTemplateRefBinding(n1, () => _ctx.bar)')
    expect(code).not.contains('_setTemplateRefBinding(n1, () => _ctx.bar,')
    expect(code).not.contains('_setStaticTemplateRef')
  })

  test('dynamic and static refs', () => {
    const { code } = compileWithTransformRef(
      `<div :ref="bar" /><div ref="foo" />`,
    )
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_setTemplateRefBinding(n0, () => _ctx.bar)')
    expect(code).not.contains('_setTemplateRefBinding(n0, () => _ctx.bar,')
    expect(code).contains('_setTemplateRef(n1, "foo")')
    expect(code).not.contains('_setStaticTemplateRef')
  })

  test('component static ref', () => {
    const { code } = compileWithTransformRef(`<Foo ref="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_setTemplateRef(n0, "foo")')
    expect(code).not.contains('_setTemplateRefBinding')
    expect(code).not.contains('_setStaticTemplateRef')
  })

  test('dynamic ref', () => {
    const { ir, code } = compileWithTransformRef(`<div :ref="foo" />`)

    expect(ir.block.dynamic.children[0]).toMatchObject({
      id: 0,
      flags: DynamicFlag.REFERENCED,
    })
    expect([...ir.template.keys()]).toEqual(['<div>'])
    expect(ir.block.effect).toMatchObject([
      {
        operations: [
          {
            type: IRNodeTypes.SET_TEMPLATE_REF,
            element: 0,
            value: {
              content: 'foo',
              isStatic: false,
            },
          },
        ],
      },
    ])
    expect(code).matchSnapshot()
    expect(code).contains('_setTemplateRefBinding(n0, () => _ctx.foo)')
    expect(code).not.contains('_createTemplateRefSetter')
    expect(code).not.contains('_renderEffect')
  })

  test('dynamic ref (inline mode)', () => {
    const { code } = compileWithTransformRef(`<div :ref="foo" />`, {
      inline: true,
      bindingMetadata: { foo: BindingTypes.SETUP_REF },
    })
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setTemplateRefBinding(n0, () => foo, undefined, undefined, "foo")',
    )
    expect(code).not.contains('_createTemplateRefSetter')
  })

  test('multiple dynamic refs', () => {
    const { code } = compileWithTransformRef(
      `<div :ref="foo" /><div :ref="bar" />`,
    )
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_renderEffect(() => {')
    expect(code).contains('_setTemplateRef(n0, _ctx.foo)')
    expect(code).contains('_setTemplateRef(n1, _ctx.bar)')
    expect(code).not.contains('_setTemplateRefBinding')
  })

  test('dynamic and function refs', () => {
    const { code } = compileWithTransformRef(
      `<div :ref="foo" /><div :ref="bar => { foo.value = bar }" />`,
    )
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_renderEffect(() => {')
    expect(code).contains('_setTemplateRef(n0, _foo)')
    expect(code).contains('_setTemplateRef(n1, bar => { _foo.value = bar })')
    expect(code).not.contains('_setTemplateRefBinding')
  })

  test('dynamic ref in slot uses owner setter', () => {
    const { code } = compileWithTransformRef(
      `<Comp><div :ref="refName" /></Comp>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains(
      '_setTemplateRefBinding(n0, () => _ctx.refName, _setTemplateRef)',
    )
  })

  test('function ref', () => {
    const { ir, code } = compileWithTransformRef(
      `<div :ref="bar => {
        foo.value = bar
        ;({ baz } = bar)
        console.log(foo.value, baz)
      }" />`,
    )
    expect(ir.block.dynamic.children[0]).toMatchObject({
      id: 0,
      flags: DynamicFlag.REFERENCED,
    })
    expect([...ir.template.keys()]).toEqual(['<div>'])
    expect(ir.block.effect).toMatchObject([
      {
        operations: [
          {
            type: IRNodeTypes.SET_TEMPLATE_REF,
            element: 0,
            value: {
              isStatic: false,
            },
          },
        ],
      },
    ])
    expect(code).toMatchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains(`_setTemplateRef(n0, bar => {
        _foo.value = bar
        ;({ baz: _ctx.baz } = bar)
        console.log(_foo.value, _ctx.baz)
      })`)
  })

  test('ref + v-if', () => {
    const { ir, code } = compileWithTransformRef(
      `<div ref="foo" v-if="true" />`,
    )

    const op = ir.block.dynamic.children[0].operation as IfIRNode
    expect(op.type).toBe(IRNodeTypes.IF)

    const { positive } = op
    expect(positive.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_TEMPLATE_REF,
        element: 2,
        value: {
          content: 'foo',
          isStatic: true,
        },
        effect: false,
      },
    ])
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_setTemplateRef(n2, "foo")')
  })

  test('ref + v-for', () => {
    const { ir, code } = compileWithTransformRef(
      `<div ref="foo" v-for="item in [1,2,3]" />`,
    )

    const { render } = ir.block.dynamic.children[0].operation as ForIRNode
    expect(render.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_TEMPLATE_REF,
        element: 2,
        value: {
          content: 'foo',
          isStatic: true,
        },
        refFor: true,
        effect: false,
      },
    ])
    expect(code).matchSnapshot()
    expect(code).contains('const _setTemplateRef = _createTemplateRefSetter()')
    expect(code).contains('_setTemplateRef(n2, "foo", true)')
  })

  test('dynamic ref + v-for', () => {
    const { code } = compileWithTransformRef(
      `<div :ref="foo" v-for="item in [1,2,3]" />`,
    )

    expect(code).matchSnapshot()
    expect(code).contains(
      '_setTemplateRefBinding(n2, () => _ctx.foo, undefined, true)',
    )
    expect(code).not.contains('_createTemplateRefSetter')
    expect(code).not.contains('_renderEffect')
  })
})
