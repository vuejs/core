import { h, nodeOps, render } from '@vue/runtime-test'
import { useCssModule } from '../../src/helpers/useCssModule'

describe('useCssModule', () => {
  function mountWithModule(modules: any, name?: string) {
    let res
    render(
      h({
        render() {},
        __cssModules: modules,
        setup() {
          res = useCssModule(name)
        },
      }),
      nodeOps.createElement('div'),
    )
    return res
  }

  test('basic usage', () => {
    const modules = {
      $style: {
        red: 'red',
      },
    }
    expect(mountWithModule(modules)).toMatchObject(modules.$style)
  })

  test('basic usage', () => {
    const modules = {
      foo: {
        red: 'red',
      },
    }
    expect(mountWithModule(modules, 'foo')).toMatchObject(modules.foo)
  })

  test('warn out of setup usage', () => {
    useCssModule()
    expect('must be called inside setup').toHaveBeenWarned()
  })

  test('warn missing injection', () => {
    mountWithModule(undefined)
    expect('instance does not have CSS modules').toHaveBeenWarned()
  })

  test('warn missing injection', () => {
    mountWithModule({ $style: { red: 'red' } }, 'foo')
    expect('instance does not have CSS module named "foo"').toHaveBeenWarned()
  })
})
