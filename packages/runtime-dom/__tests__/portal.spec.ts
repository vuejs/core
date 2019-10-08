import { mockWarn } from '@vue/runtime-test'
import { h, Portal, render, ref, nextTick } from '@vue/runtime-dom'

describe('renderer: portal', () => {
  mockWarn()

  test('portals warn when their selector does not exist', async () => {
    document.documentElement.innerHTML = `<div><div id="app"></div><div id="target"></div></div>`

    const PortalContent = () => h('div', 'portal content')
    const Comp = () => [
      h(Portal, { target: '#idonotexist' }, [h(PortalContent)])
    ]

    const appDiv = document.querySelector('#app')!
    const targetDiv = document.querySelector('#target')!

    render(h(Comp), appDiv)

    expect(appDiv.innerHTML).toBe(`<!----><!--[object Object]--><!---->`)
    expect(targetDiv.innerHTML).toBe(``)

    expect('Invalid Portal target on mount:').toHaveBeenWarned()
  })

  test('portals can render to an element by its selector', async () => {
    document.documentElement.innerHTML = `<div><div id="app"></div><div id="target"></div></div>`

    const PortalContent = () => h('div', 'portal content')
    const Comp = () => [h(Portal, { target: '#target' }, [h(PortalContent)])]

    const appDiv = document.querySelector('#app')!
    const targetDiv = document.querySelector('#target')!

    render(h(Comp), appDiv)

    expect(appDiv.innerHTML).toBe(`<!----><!--[object Object]--><!---->`)
    expect(targetDiv.innerHTML).toBe(`<div>portal content</div>`)
  })

  test('portals can render different elements by its selector', async () => {
    document.documentElement.innerHTML = `<div><div id="app"></div><div id="target1"></div><div id="target2"></div></div>`

    const whichTarget = ref('#target1')

    const PortalContent = () => h('div', 'portal content')
    const Comp = () => [
      h(Portal, { target: whichTarget.value }, [h(PortalContent)])
    ]

    const appDiv = document.querySelector('#app')!
    const target1Div = document.querySelector('#target1')!
    const target2Div = document.querySelector('#target2')!

    render(h(Comp), appDiv)
    await nextTick()

    expect(appDiv.innerHTML).toBe(`<!----><!--[object Object]--><!---->`)
    expect(target1Div.innerHTML).toBe(`<div>portal content</div>`)
    expect(target2Div.innerHTML).toBe(``)

    // Move to a new portal target
    whichTarget.value = '#target2'

    await nextTick()

    expect(appDiv.innerHTML).toBe(`<!----><!--[object Object]--><!---->`)
    expect(target1Div.innerHTML).toBe(``)
    expect(target2Div.innerHTML).toBe(`<div>portal content</div>`)
  })
})
