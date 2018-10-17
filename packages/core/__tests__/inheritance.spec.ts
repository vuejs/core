import { Component, createInstance } from '@vue/renderer-test'

describe('class inheritance', () => {
  it('should merge data', () => {
    class Base extends Component {
      foo = 1
      data() {
        return {
          bar: 2
        }
      }
    }

    class Child extends Base {
      foo: number
      bar: number
      baz: number
      qux: number = 4

      data(): any {
        return {
          baz: 3
        }
      }
    }

    const child = createInstance(Child)

    expect(child.foo).toBe(1)
    expect(child.bar).toBe(2)
    expect(child.baz).toBe(3)
    expect(child.qux).toBe(4)
  })

  it('should merge props', () => {})

  it('should merge lifecycle hooks', () => {})

  it('should merge watchers', () => {})

  it('should inherit methods', () => {})

  it('should inherit computed properties', () => {})
})
