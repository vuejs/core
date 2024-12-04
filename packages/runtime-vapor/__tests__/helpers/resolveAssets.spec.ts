import {
  type Component,
  type Directive,
  createVaporApp,
  resolveComponent,
  resolveDirective,
} from 'packages/runtime-vapor/src/_old'
import { makeRender } from '../_utils'

const define = makeRender()

describe('resolveAssets', () => {
  test('should work', () => {
    const FooBar = () => []
    const BarBaz = () => undefined
    let component1: Component | string
    let component2: Component | string
    let component3: Component | string
    let component4: Component | string
    let directive1: Directive
    let directive2: Directive
    let directive3: Directive
    let directive4: Directive
    const Root = define({
      render() {
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
        return []
      },
    })
    const app = createVaporApp(Root.component)
    app.component('FooBar', FooBar)
    app.directive('BarBaz', BarBaz)
    const root = document.createElement('div')
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

  describe('warning', () => {
    test('used outside render() or setup()', () => {
      resolveComponent('foo')
      expect(
        '[Vue warn]: resolveComponent can only be used in render() or setup().',
      ).toHaveBeenWarned()
      resolveDirective('foo')
      expect(
        '[Vue warn]: resolveDirective can only be used in render() or setup().',
      ).toHaveBeenWarned()
    })
    test('not exist', () => {
      const Root = define({
        setup() {
          resolveComponent('foo')
          resolveDirective('bar')
        },
      })
      const app = createVaporApp(Root.component)
      const root = document.createElement('div')
      app.mount(root)
      expect('Failed to resolve component: foo').toHaveBeenWarned()
      expect('Failed to resolve directive: bar').toHaveBeenWarned()
    })
  })
})
