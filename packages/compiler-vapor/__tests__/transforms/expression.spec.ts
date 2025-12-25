import { BindingTypes } from '@vue/compiler-dom'
import {
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithExpression = makeCompile({
  nodeTransforms: [transformElement, transformChildren, transformText],
  directiveTransforms: { bind: transformVBind },
})

describe('compiler: expression', () => {
  test('basic', () => {
    const { code } = compileWithExpression(`{{ a }}`)
    expect(code).toMatchSnapshot()
    expect(code).contains(`ctx.a`)
  })

  test('props', () => {
    const { code } = compileWithExpression(`{{ foo }}`, {
      bindingMetadata: { foo: BindingTypes.PROPS },
    })
    expect(code).toMatchSnapshot()
    expect(code).contains(`$props.foo`)
  })

  test('props aliased', () => {
    const { code } = compileWithExpression(`{{ foo }}`, {
      bindingMetadata: {
        foo: BindingTypes.PROPS_ALIASED,
        __propsAliases: { foo: 'bar' } as any,
      },
    })
    expect(code).toMatchSnapshot()
    expect(code).contains(`$props['bar']`)
  })

  test('update expression', () => {
    const { code } = compileWithExpression(`
      <div :id="String(foo.id++)" :foo="foo" :bar="bar++">
        {{ String(foo.id++) }} {{ foo }} {{ bar }}
      </div>
    `)
    expect(code).toMatchSnapshot()
    expect(code).contains(`_String(_foo.id++)`)
  })

  test('empty interpolation', () => {
    const { code } = compileWithExpression(`{{}}`)
    const { code: code2 } = compileWithExpression(`{{ }}`)
    const { code: code3 } = compileWithExpression(`<div>{{ }}</div>`)
    const { code: code4 } = compileWithExpression(`<div>{{ foo }}{{ }}</div>`)

    expect(code).toMatchSnapshot()
    expect(code).not.toContain(`_toDisplayString`)
    expect(code).not.toContain(`_setText`)

    expect(code2).toMatchSnapshot()
    expect(code2).not.toContain(`_toDisplayString`)
    expect(code2).not.toContain(`_setText`)

    expect(code3).toMatchSnapshot()
    expect(code3).not.toContain(`_toDisplayString`)
    expect(code3).not.toContain(`_setText`)

    expect(code4).toMatchSnapshot()
  })
})
