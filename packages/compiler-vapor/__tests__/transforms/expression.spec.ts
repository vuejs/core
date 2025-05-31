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
})
