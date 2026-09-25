import { ref, useCssModule } from '@vue/runtime-dom'
import { compile, compileToVaporRender, makeRender } from '../_utils'
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

  test('<style module> names used in a <script setup> template', () => {
    const Comp = compile(
      `<script setup>const data = _data</script>` +
        `<template><div :class="$style.red">{{ classes.blue }}</div></template>` +
        `<style module>.red { color: red }</style>` +
        `<style module="classes">.blue { color: blue }</style>`,
      ref(),
    )
    Comp.__cssModules = {
      $style: { red: 'red_hash' },
      classes: { blue: 'blue_hash' },
    }
    const { html } = define(Comp).render()
    expect(html()).toBe(`<div class="red_hash">blue_hash</div>`)
  })

  test('<style module> names used in a template-only component', () => {
    const { html } = define({
      __cssModules: {
        $style: { red: 'red_hash' },
        classes: { blue: 'blue_hash' },
      },
      render: compileToVaporRender(
        `<div :class="$style.red">{{ classes.blue }}</div>`,
      ),
    }).render()
    expect(html()).toBe(`<div class="red_hash">blue_hash</div>`)
  })
})
