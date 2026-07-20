import { useCssModule } from '@vue/runtime-dom'
import { makeRender } from '../_utils'
import { defineVaporComponent, template } from '@vue/runtime-vapor'

const define = makeRender<any>()

describe('useCssModule', () => {
  function mountWithModule(modules: any, name?: string) {
    let res
    define(
      defineVaporComponent({
        __cssModules: modules,
        setup() {
          res = useCssModule(name)
          const n0 = template('<div></div>')()
          return n0
        },
      }),
    ).render()
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
