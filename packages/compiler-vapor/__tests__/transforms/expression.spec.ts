import { BindingTypes } from '@vue/compiler-dom'
import { transformChildren, transformText } from '../../src'
import { makeCompile } from './_utils'

const compileWithExpression = makeCompile({
  nodeTransforms: [transformChildren, transformText],
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
})
