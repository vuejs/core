import { Component, ComponentClass, mixins } from '@vue/runtime-core'
import { createInstance } from '@vue/runtime-test'
import { prop } from '@vue/decorators'

const calls: string[] = []

beforeEach(() => {
  calls.length = 0
})

class ClassMixinA extends Component<{ p1: string }, { d11: number }> {
  // props
  @prop
  p1: string
  // data
  d1 = 1
  data() {
    return {
      d11: 2
    }
  }

  // computed
  get c1() {
    return this.d1 + this.$data.d11
  }

  // lifecycle
  created() {
    calls.push('created from mixin A')
  }

  // methods
  foo() {
    return this.d1
  }
}

class ClassMixinB extends Component<{ p2: string }, { d21: number }> {
  // props
  static props = {
    p2: String
  }

  // data
  d2 = 1
  data() {
    return {
      d21: 2
    }
  }

  get c2() {
    return this.d2 + this.$data.d21
  }

  // lifecycle
  created() {
    calls.push('created from mixin B')
  }

  // methods
  bar() {
    return this.d2
  }
}

const ObjectMixinA = {
  props: {
    p1: String
  },
  data() {
    return {
      d1: 1,
      d11: 2
    }
  },
  computed: {
    c1() {
      return this.d1 + this.d11
    }
  },
  created() {
    calls.push('created from mixin A')
  },
  methods: {
    foo() {
      return this.d1
    }
  }
}

const ObjectMixinB = {
  props: {
    p2: String
  },
  data() {
    return {
      d2: 1,
      d21: 2
    }
  },
  computed: {
    c2() {
      return this.d2 + this.d21
    }
  },
  created() {
    calls.push('created from mixin B')
  },
  methods: {
    bar() {
      return this.d2
    }
  }
}

function assertMixins(Test: any) {
  const instance = createInstance(Test, {
    p1: '1',
    p2: '2',
    p3: '3'
  }) as any

  // data
  expect(instance.d1).toBe(1)
  expect(instance.d11).toBe(2)
  expect(instance.d2).toBe(1)
  expect(instance.d21).toBe(2)
  expect(instance.d3).toBe(1)
  expect(instance.d31).toBe(2)

  // props
  expect(instance.p1).toBe('1')
  expect(instance.p2).toBe('2')
  expect(instance.p3).toBe('3')
  expect(instance.$props.p1).toBe('1')
  expect(instance.$props.p2).toBe('2')
  expect(instance.$props.p3).toBe('3')

  // computed
  expect(instance.c1).toBe(3)
  expect(instance.c2).toBe(3)
  expect(instance.c3).toBe(3)

  // lifecycle
  expect(calls).toEqual([
    'created from mixin A',
    'created from mixin B',
    'created from Test'
  ])

  // methods
  expect(instance.foo()).toBe(1)
  expect(instance.bar()).toBe(1)
  expect(instance.baz()).toBe(1)
}

describe('mixins', () => {
  it('should work with classes', () => {
    class Test extends mixins(ClassMixinA, ClassMixinB)<
      { p3: string },
      { d31: number }
    > {
      static props = {
        p3: String
      }

      d3 = 1
      data(): any {
        return {
          d31: 2
        }
      }

      get c3() {
        return this.d3 + this.d31
      }

      created() {
        calls.push('created from Test')
      }

      baz() {
        return this.d3
      }
    }

    const instance = createInstance(Test, {
      p1: '1',
      p2: '2',
      p3: '3'
    })

    // we duplicate the assertions because they serve as type tests as well

    // data
    expect(instance.d1).toBe(1)
    expect(instance.$data.d11).toBe(2)
    expect(instance.d2).toBe(1)
    expect(instance.$data.d21).toBe(2)
    expect(instance.d3).toBe(1)
    expect(instance.d31).toBe(2)

    // props
    expect(instance.p1).toBe('1')
    expect(instance.$props.p2).toBe('2')
    expect(instance.p3).toBe('3')
    expect(instance.$props.p1).toBe('1')
    expect(instance.$props.p2).toBe('2')
    expect(instance.$props.p3).toBe('3')

    // computed
    expect(instance.c1).toBe(3)
    expect(instance.c2).toBe(3)
    expect(instance.c3).toBe(3)

    // lifecycle
    expect(calls).toEqual([
      'created from mixin A',
      'created from mixin B',
      'created from Test'
    ])

    // methods
    expect(instance.foo()).toBe(1)
    expect(instance.bar()).toBe(1)
    expect(instance.baz()).toBe(1)
  })

  it('should work with objects', () => {
    class Test extends ((mixins as any)(
      ObjectMixinA,
      ObjectMixinB
    ) as ComponentClass)<{ p3: string }, { d31: number }> {
      static props = {
        p3: String
      }

      d3 = 1
      data(): any {
        return {
          d31: 2
        }
      }

      get c3() {
        return this.d3 + this.$data.d31
      }

      created() {
        calls.push('created from Test')
      }

      baz() {
        return this.d3
      }
    }

    assertMixins(Test)
  })

  it('should work with a mix of objects and classes', () => {
    class Test extends ((mixins as any)(
      ClassMixinA,
      ObjectMixinB
    ) as ComponentClass)<{ p3: string }, { d31: number }> {
      static props = {
        p3: String
      }

      d3 = 1
      data(): any {
        return {
          d31: 2
        }
      }

      get c3() {
        return this.d3 + this.$data.d31
      }

      created() {
        calls.push('created from Test')
      }

      baz() {
        return this.d3
      }
    }

    assertMixins(Test)
  })
})
