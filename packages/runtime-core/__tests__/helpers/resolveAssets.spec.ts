import {
  mockWarn,
  createApp,
  nodeOps,
  resolveComponent,
  resolveDirective,
  Component,
  Directive,
  resolveDynamicComponent
} from '@vue/runtime-test'

describe('resolveAssets', () => {
  test('should work', () => {
    const app = createApp()
    const FooBar = () => null
    const BarBaz = { mounted: () => null }

    let component1: Component
    let component2: Component
    let component3: Component
    let component4: Component
    let directive1: Directive
    let directive2: Directive
    let directive3: Directive
    let directive4: Directive

    const Root = {
      components: {
        FooBar: FooBar
      },
      directives: {
        BarBaz: BarBaz
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
      }
    }

    const root = nodeOps.createElement('div')
    app.mount(Root, root)
    expect(component1!).toBe(FooBar)
    expect(component2!).toBe(FooBar)
    expect(component3!).toBe(FooBar)
    expect(component4!).toBe(FooBar)

    expect(directive1!).toBe(BarBaz)
    expect(directive2!).toBe(BarBaz)
    expect(directive3!).toBe(BarBaz)
    expect(directive4!).toBe(BarBaz)
  })

  describe('warning', () => {
    mockWarn()

    test('used outside render() or setup()', () => {
      resolveComponent('foo')
      expect(
        'resolveComponent can only be used in render() or setup().'
      ).toHaveBeenWarned()

      resolveDirective('foo')
      expect(
        'resolveDirective can only be used in render() or setup().'
      ).toHaveBeenWarned()
    })

    test('not exist', () => {
      const app = createApp()
      const Root = {
        setup() {
          resolveComponent('foo')
          resolveDirective('bar')
          return () => null
        }
      }

      const root = nodeOps.createElement('div')
      app.mount(Root, root)
      expect('Failed to resolve component: foo').toHaveBeenWarned()
      expect('Failed to resolve directive: bar').toHaveBeenWarned()
    })

    test('resolve dynamic component', () => {
      const app = createApp()
      const dynamicComponents = {
        foo: () => 'foo',
        bar: () => 'bar',
        baz: { render: () => 'baz' }
      }
      let foo, bar, baz // dynamic components
      const Root = {
        components: { foo: dynamicComponents.foo },
        setup() {
          return () => {
            foo = resolveDynamicComponent('foo') // <component is="foo"/>
            bar = resolveDynamicComponent(dynamicComponents.bar) // <component :is="bar"/>, function
            baz = resolveDynamicComponent(dynamicComponents.baz) // <component :is="baz"/>, object
          }
        }
      }
      const root = nodeOps.createElement('div')
      app.mount(Root, root)
      expect(foo).toBe(dynamicComponents.foo)
      expect(bar).toBe(dynamicComponents.bar)
      expect(baz).toBe(dynamicComponents.baz)
    })
  })
})
