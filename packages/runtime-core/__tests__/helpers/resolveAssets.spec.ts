import {
  mockWarn,
  createApp,
  nodeOps,
  resolveComponent,
  resolveDirective,
  Component,
  Directive
} from '@vue/runtime-test'

describe('resolveAssets', () => {
  test('should work', () => {
    const app = createApp()
    const FooBar = () => null
    const BarBaz = { mounted: () => null }

    let component1: Component
    let component2: Component
    let component3: Component
    let directive1: Directive
    let directive2: Directive
    let directive3: Directive

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
        }
      }
    }

    const root = nodeOps.createElement('div')
    app.mount(Root, root)
    expect(component1!).toBe(FooBar)
    expect(component2!).toBe(FooBar)
    expect(component3!).toBe(FooBar)

    expect(directive1!).toBe(BarBaz)
    expect(directive2!).toBe(BarBaz)
    expect(directive3!).toBe(BarBaz)
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
  })
})
