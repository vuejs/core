import { App } from '../../runtime-core/src/apiApp'
import { createApp } from '@vue/runtime-dom'
import { nodeOps } from '../src/nodeOps'

const app: App = createApp()

describe('createApp', () => {
  it('div is HTMLTag', () => {
    if (app.config.isNativeTag) {
      expect(app.config.isNativeTag('div')).toBe(true)
    }
  })

  it('svg is SVGTag', () => {
    if (app.config.isNativeTag) {
      expect(app.config.isNativeTag('svg')).toBe(true)
    }
  })

  it('vue is neither HTMLTag nor SVGTag', () => {
    if (app.config.isNativeTag) {
      expect(app.config.isNativeTag('vue')).toBe(false)
    }
  })
})

describe('nodeOps', () => {
  it('remove', () => {
    const el = document.createElement('div')
    const child = document.createTextNode('vue')

    el.appendChild(child)
    expect(el.childNodes.length).toBe(1)

    nodeOps.remove(child)
    expect(el.childNodes.length).toBe(0)
  })

  it('setText', () => {
    const el = document.createTextNode('vue')

    nodeOps.setText(el, 'iview')
    expect(el.nodeValue).toBe('iview')
  })

  it('querySelector', () => {
    const el = document.createElement('div')
    el.setAttribute('id', 'vue')
    document.documentElement.appendChild(el)

    expect(nodeOps.querySelector('#vue')).toStrictEqual(el)
    expect(nodeOps.querySelector('#iview')).toBeNull()
  })
})
