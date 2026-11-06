import {
  Comment,
  type Component,
  type Directive,
  type VNode,
  createApp,
  createVNode,
  h,
  nodeOps,
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent,
  serializeInner,
} from '@vue/runtime-test'

describe('resolveAssets', () => {
  test('should work', () => {
    const FooBar = () => null
    const BarBaz = { mounted: () => null }

    let component1: Component | string
    let component2: Component | string
    let component3: Component | string
    let component4: Component | string
    let directive1: Directive
    let directive2: Directive
    let directive3: Directive
    let directive4: Directive

    const Root = {
      components: {
        FooBar: FooBar,
      },
      directives: {
        BarBaz: BarBaz,
      },
      setup() {
        return () => {
          component1 = resolveComponent('FooBar')!
          directive1 = resolveDirective('BarBaz')!
          // camelize
          component2 = resolveComponent('Foo-bar')!
          directive2 = resolveDirective('Bar-baz')!
          // capitalize
          component3 = resolveComponent('fooBar')!
          directive3 = resolveDirective('barBaz')!
          // camelize and capitalize
          component4 = resolveComponent('foo-bar')!
          directive4 = resolveDirective('bar-baz')!
        }
      },
    }

    const app = createApp(Root)
    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(component1!).toBe(FooBar)
    expect(component2!).toBe(FooBar)
    expect(component3!).toBe(FooBar)
    expect(component4!).toBe(FooBar)

    expect(directive1!).toBe(BarBaz)
    expect(directive2!).toBe(BarBaz)
    expect(directive3!).toBe(BarBaz)
    expect(directive4!).toBe(BarBaz)
  })

  test('maybeSelfReference', async () => {
    let component1: Component | string
    let component2: Component | string
    let component3: Component | string

    const Foo = () => null

    const Root = {
      name: 'Root',
      components: {
        Foo,
        Root: Foo,
      },
      setup() {
        return () => {
          component1 = resolveComponent('Root', true)
          component2 = resolveComponent('Foo', true)
          component3 = resolveComponent('Bar', true)
        }
      },
    }

    const app = createApp(Root)
    const root = nodeOps.createElement('div')
    app.mount(root)

    expect(component1!).toMatchObject(Root) // explicit self name reference
    expect(component2!).toBe(Foo) // successful resolve take higher priority
    expect(component3!).toMatchObject(Root) // fallback when resolve fails
  })

  describe('warning', () => {
    test('used outside render() or setup()', () => {
      resolveComponent('foo')
      expect(
        'resolveComponent can only be used in render() or setup().',
      ).toHaveBeenWarned()

      resolveDirective('foo')
      expect(
        'resolveDirective can only be used in render() or setup().',
      ).toHaveBeenWarned()
    })

    test('not exist', () => {
      const Root = {
        setup() {
          resolveComponent('foo')
          resolveDirective('bar')
          return () => null
        },
      }

      const app = createApp(Root)
      const root = nodeOps.createElement('div')
      app.mount(root)
      expect('Failed to resolve component: foo').toHaveBeenWarned()
      expect('Failed to resolve directive: bar').toHaveBeenWarned()
    })

    test('suggests the closest registered component name on typo', () => {
      // "Buttn" is one edit from "Button" (insert 'o') — should
      // qualify via the distance gate.
      const Button = () => null
      const Footer = () => null
      const Root = {
        components: { Button, Footer },
        setup() {
          resolveComponent('Buttn')
          return () => null
        },
      }
      const app = createApp(Root)
      app.mount(nodeOps.createElement('div'))
      expect('Failed to resolve component: Buttn').toHaveBeenWarned()
      // the trailing suggestion argument carries the "Did you mean ..."
      // line followed by the existing native-element hint
      const calls = vi.mocked(console.warn).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[lastCall.length - 1]).toContain('Did you mean `Button`?')
      expect(lastCall[lastCall.length - 1]).toContain(
        'compilerOptions.isCustomElement',
      )
    })

    test('no "Did you mean" suggestion when no registered name is close', () => {
      // "xyz" is far from every candidate by edit distance AND
      // similarity — only the native-element hint should appear.
      const Root = {
        components: { Button: () => null, Footer: () => null },
        setup() {
          resolveComponent('xyz')
          return () => null
        },
      }
      const app = createApp(Root)
      app.mount(nodeOps.createElement('div'))
      expect('Failed to resolve component: xyz').toHaveBeenWarned()
      const calls = vi.mocked(console.warn).mock.calls
      const lastCall = calls[calls.length - 1]
      // suggestion is the native-element hint, NOT a "Did you mean" line
      expect(lastCall[lastCall.length - 1]).not.toContain('Did you mean')
      expect(lastCall[lastCall.length - 1]).toContain(
        'compilerOptions.isCustomElement',
      )
    })

    test('does not add a "Did you mean" suggestion for directives', () => {
      // directives are out of scope for R4c — only components get
      // the closest-match scan
      const Root = {
        directives: { MyDir: () => null },
        setup() {
          resolveDirective('Mydir')
          return () => null
        },
      }
      const app = createApp(Root)
      app.mount(nodeOps.createElement('div'))
      expect('Failed to resolve directive: Mydir').toHaveBeenWarned()
      const calls = vi.mocked(console.warn).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[lastCall.length - 1]).not.toContain('Did you mean')
    })

    test('resolve dynamic component', () => {
      const dynamicComponents = {
        foo: () => 'foo',
        bar: () => 'bar',
        baz: { render: () => 'baz' },
      }
      let foo, bar, baz // dynamic components
      let dynamicVNode: VNode

      const Child = {
        render(this: any) {
          return this.$slots.default()
        },
      }

      const Root = {
        components: { foo: dynamicComponents.foo },
        setup() {
          return () => {
            foo = resolveDynamicComponent('foo') // <component is="foo"/>
            bar = resolveDynamicComponent(dynamicComponents.bar) // <component :is="bar"/>, function
            dynamicVNode = createVNode(resolveDynamicComponent(null)) // <component :is="null"/>
            return h(Child, () => {
              // check inside child slots
              baz = resolveDynamicComponent(dynamicComponents.baz) // <component :is="baz"/>, object
            })
          }
        },
      }

      const app = createApp(Root)
      const root = nodeOps.createElement('div')
      app.mount(root)
      expect(foo).toBe(dynamicComponents.foo)
      expect(bar).toBe(dynamicComponents.bar)
      expect(baz).toBe(dynamicComponents.baz)
      // should allow explicit falsy type to remove the component
      expect(dynamicVNode!.type).toBe(Comment)
    })

    test('resolve dynamic component should fallback to plain element without warning', () => {
      const Root = {
        setup() {
          return () => {
            return createVNode(resolveDynamicComponent('div') as string, null, {
              default: () => 'hello',
            })
          }
        },
      }

      const app = createApp(Root)
      const root = nodeOps.createElement('div')
      app.mount(root)
      expect(serializeInner(root)).toBe('<div>hello</div>')
    })
  })

  test('resolving from mixins & extends', () => {
    const FooBar = () => null
    const BarBaz = { mounted: () => null }

    let component1: Component | string
    let component2: Component | string
    let component3: Component | string
    let component4: Component | string
    let directive1: Directive
    let directive2: Directive
    let directive3: Directive
    let directive4: Directive

    const Base = {
      components: {
        FooBar: FooBar,
      },
    }
    const Mixin = {
      directives: {
        BarBaz: BarBaz,
      },
    }

    const Root = {
      extends: Base,
      mixins: [Mixin],
      setup() {
        return () => {
          component1 = resolveComponent('FooBar')!
          directive1 = resolveDirective('BarBaz')!
          // camelize
          component2 = resolveComponent('Foo-bar')!
          directive2 = resolveDirective('Bar-baz')!
          // capitalize
          component3 = resolveComponent('fooBar')!
          directive3 = resolveDirective('barBaz')!
          // camelize and capitalize
          component4 = resolveComponent('foo-bar')!
          directive4 = resolveDirective('bar-baz')!
        }
      },
    }

    const app = createApp(Root)
    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(component1!).toBe(FooBar)
    expect(component2!).toBe(FooBar)
    expect(component3!).toBe(FooBar)
    expect(component4!).toBe(FooBar)

    expect(directive1!).toBe(BarBaz)
    expect(directive2!).toBe(BarBaz)
    expect(directive3!).toBe(BarBaz)
    expect(directive4!).toBe(BarBaz)
  })
})
