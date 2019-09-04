import {
  h,
  nodeOps,
  render,
  serializeInner,
  triggerEvent,
  TestElement,
  nextTick,
  renderToString,
  ref
} from '@vue/runtime-test'

describe('api: options', () => {
  test('data', async () => {
    const Comp = {
      data() {
        return {
          foo: 1
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.foo++
            }
          },
          this.foo
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>1</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>2</div>`)
  })

  test('computed', async () => {
    const Comp = {
      data() {
        return {
          foo: 1
        }
      },
      computed: {
        bar() {
          return this.foo + 1
        },
        baz() {
          return this.bar + 1
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.foo++
            }
          },
          this.bar + this.baz
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>5</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>7</div>`)
  })

  test('methods', async () => {
    const Comp = {
      data() {
        return {
          foo: 1
        }
      },
      methods: {
        inc() {
          this.foo++
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: this.inc
          },
          this.foo
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>1</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>2</div>`)
  })

  test('watch', async () => {
    function returnThis() {
      return this
    }
    const spyA = jest.fn(returnThis)
    const spyB = jest.fn(returnThis)
    const spyC = jest.fn(returnThis)

    let ctx: any
    const Comp = {
      data() {
        return {
          foo: 1,
          bar: 2,
          baz: {
            qux: 3
          }
        }
      },
      watch: {
        // string method name
        foo: 'onFooChange',
        // direct function
        bar: spyB,
        baz: {
          handler: spyC,
          deep: true
        }
      },
      methods: {
        onFooChange: spyA
      },
      render() {
        ctx = this
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    function assertCall(spy: jest.Mock, callIndex: number, args: any[]) {
      expect(spy.mock.calls[callIndex].slice(0, 2)).toMatchObject(args)
    }

    assertCall(spyA, 0, [1, undefined])
    assertCall(spyB, 0, [2, undefined])
    assertCall(spyC, 0, [{ qux: 3 }, undefined])
    expect(spyA).toHaveReturnedWith(ctx)
    expect(spyB).toHaveReturnedWith(ctx)
    expect(spyC).toHaveReturnedWith(ctx)

    ctx.foo++
    await nextTick()
    expect(spyA).toHaveBeenCalledTimes(2)
    assertCall(spyA, 1, [2, 1])

    ctx.bar++
    await nextTick()
    expect(spyB).toHaveBeenCalledTimes(2)
    assertCall(spyB, 1, [3, 2])

    ctx.baz.qux++
    await nextTick()
    expect(spyC).toHaveBeenCalledTimes(2)
    // new and old objects have same identity
    assertCall(spyC, 1, [{ qux: 4 }, { qux: 4 }])
  })

  test('provide/inject', () => {
    const Root = {
      data() {
        return {
          a: 1
        }
      },
      provide() {
        return {
          a: this.a
        }
      },
      render() {
        return [h(ChildA), h(ChildB), h(ChildC), h(ChildD)]
      }
    }
    const ChildA = {
      inject: ['a'],
      render() {
        return this.a
      }
    }
    const ChildB = {
      // object alias
      inject: { b: 'a' },
      render() {
        return this.b
      }
    }
    const ChildC = {
      inject: {
        b: {
          from: 'a'
        }
      },
      render() {
        return this.b
      }
    }
    const ChildD = {
      inject: {
        b: {
          from: 'c',
          default: 2
        }
      },
      render() {
        return this.b
      }
    }

    expect(renderToString(h(Root))).toBe(`<!---->1112<!---->`)
  })

  test('lifecycle', () => {})

  test('mixins', () => {
    const calls: string[] = []
    const mixinA = {
      data() {
        return {
          a: 1
        }
      },
      mounted() {
        calls.push('mixinA')
      }
    }
    const mixinB = {
      data() {
        return {
          b: 2
        }
      },
      mounted() {
        calls.push('mixinB')
      }
    }
    const Comp = {
      mixins: [mixinA, mixinB],
      data() {
        return {
          c: 3
        }
      },
      mounted() {
        calls.push('comp')
      },
      render() {
        return `${this.a}${this.b}${this.c}`
      }
    }

    expect(renderToString(h(Comp))).toBe(`123`)
    expect(calls).toEqual(['mixinA', 'mixinB', 'comp'])
  })

  test('extends', () => {
    const calls: string[] = []
    const Base = {
      data() {
        return {
          a: 1
        }
      },
      mounted() {
        calls.push('base')
      }
    }
    const Comp = {
      extends: Base,
      data() {
        return {
          b: 2
        }
      },
      mounted() {
        calls.push('comp')
      },
      render() {
        return `${this.a}${this.b}`
      }
    }

    expect(renderToString(h(Comp))).toBe(`12`)
    expect(calls).toEqual(['base', 'comp'])
  })

  test('accessing setup() state from options', async () => {
    const Comp = {
      setup() {
        return {
          count: ref(0)
        }
      },
      data() {
        return {
          plusOne: this.count + 1
        }
      },
      computed: {
        plusTwo() {
          return this.count + 2
        }
      },
      methods: {
        inc() {
          this.count++
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: this.inc
          },
          `${this.count},${this.plusOne},${this.plusTwo}`
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>0,1,2</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1,1,3</div>`)
  })
})
