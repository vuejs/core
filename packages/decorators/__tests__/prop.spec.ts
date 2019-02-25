import { prop } from '../src/index'
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

  class Foo extends Component<{ p: number }> {
    @prop({
      default: 1
    })
    p: number

    created() {
      capturedThisValue = this.p
      capturedPropsValue = this.$props.p
    }
  }

  // default value
  createInstance(Foo)
  expect(capturedThisValue).toBe(1)
  expect(capturedPropsValue).toBe(1)

  // explicit override
  createInstance(Foo, {
    p: 2
  })
  expect(capturedThisValue).toBe(2)
  expect(capturedPropsValue).toBe(2)
})
