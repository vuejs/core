import { prop } from '../src/optional/propDecorator'
import { Component, createInstance } from '@vue/runtime-test'

test('without options', () => {
  let capturedThisValue
  let capturedPropsValue

  class Foo extends Component<{ p: number }> {
    @prop
    p: number

    created() {
      capturedThisValue = this.p
      capturedPropsValue = this.$props.p
    }
  }

  createInstance(Foo, {
    p: 1
  })
  expect(capturedThisValue).toBe(1)
  expect(capturedPropsValue).toBe(1)

  // explicit override
  createInstance(Foo, {
    p: 2
  })
  expect(capturedThisValue).toBe(2)
  expect(capturedPropsValue).toBe(2)
})

test('with options', () => {
  let capturedThisValue
  let capturedPropsValue
  let capturedDataValue

  class Foo extends Component<{ p: number }> {
    @prop({
      default: 1
    })
    p: number
    // data property should be able to make use of prop
    d: number = this.p + 1

    created() {
      capturedThisValue = this.p
      capturedPropsValue = this.$props.p
      capturedDataValue = this.d
    }
  }

  // default value
  createInstance(Foo)
  expect(capturedThisValue).toBe(1)
  expect(capturedPropsValue).toBe(1)
  expect(capturedDataValue).toBe(2)

  // explicit override
  createInstance(Foo, {
    p: 2
  })
  expect(capturedThisValue).toBe(2)
  expect(capturedPropsValue).toBe(2)
  expect(capturedDataValue).toBe(3)
})
