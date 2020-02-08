import {
  createBlock,
  createVNode,
  h,
  nextTick,
  nodeOps,
  openBlock,
  ref,
  render,
  serializeInner,
  TestElement
} from '@vue/runtime-test'
import { PatchFlags } from '@vue/shared'

const inner = (c: TestElement) => serializeInner(c)

describe('renderer: element', () => {
  test('with props', async () => {
    const root = nodeOps.createElement('div')
    const classValue = ref('a1')
    const styleValue = ref('a1')
    const propValue = ref('a1')
    const App = {
      render() {
        return h('div', {
          id: propValue.value,
          class: classValue.value,
          style: styleValue.value
        })
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div id="a1" class="a1" style="a1"></div>')

    propValue.value = 'a2'
    styleValue.value = 'a2'
    classValue.value = 'a2'
    await nextTick()
    expect(inner(root)).toBe('<div id="a2" class="a2" style="a2"></div>')
  })

  test('with props (patchFlags full props)', async () => {
    const root = nodeOps.createElement('div')
    const classValue = ref('a1')
    const styleValue = ref('a1')
    const propValue = ref('a1')
    const App = {
      render() {
        return createVNode(
          'div',
          {
            id: propValue.value,
            class: classValue.value,
            style: styleValue.value
          },
          [],
          PatchFlags.FULL_PROPS
        )
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div id="a1" class="a1" style="a1"></div>')

    propValue.value = 'a2'
    styleValue.value = 'a2'
    classValue.value = 'a2'
    await nextTick()
    expect(inner(root)).toBe('<div id="a2" class="a2" style="a2"></div>')
  })

  test('with props (patchFlags style、class、 props)', async () => {
    const root = nodeOps.createElement('div')
    const classValue = ref('a1')
    const styleValue = ref('a1')
    const propValue = ref('a1')
    const App = {
      render() {
        return createVNode(
          'div',
          {
            id: propValue.value,
            class: classValue.value,
            style: styleValue.value
          },
          [],
          PatchFlags.CLASS + PatchFlags.STYLE + PatchFlags.PROPS,
          ['id']
        )
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div id="a1" class="a1" style="a1"></div>')

    propValue.value = 'a2'
    styleValue.value = 'a2'
    classValue.value = 'a2'
    await nextTick()
    expect(inner(root)).toBe('<div id="a2" class="a2" style="a2"></div>')
  })

  test('with direct text children', async () => {
    const root = nodeOps.createElement('div')
    const value = ref('a')
    const App = {
      render() {
        return h('div', value.value)
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div>a</div>')

    value.value = 'b'
    await nextTick()
    expect(inner(root)).toBe('<div>b</div>')
  })

  test('with direct text children (patchFlags text)', async () => {
    const root = nodeOps.createElement('div')
    const value = ref('a')
    const App = {
      render() {
        return createVNode('div', null, value.value, PatchFlags.TEXT)
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div>a</div>')

    value.value = 'b'
    await nextTick()
    expect(inner(root)).toBe('<div>b</div>')
  })

  test('with node children', async () => {
    const root = nodeOps.createElement('div')
    const value = ref('a')
    const App = {
      render() {
        return h('div', null, [h('span', null, value.value)])
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div><span>a</span></div>')

    value.value = 'b'
    await nextTick()
    expect(inner(root)).toBe('<div><span>b</span></div>')
  })

  test('with node children (dynamic children)', async () => {
    const root = nodeOps.createElement('div')
    const value = ref('a')
    const App = {
      render() {
        return (
          openBlock(),
          createBlock('div', null, [
            createVNode('span', null, value.value, PatchFlags.TEXT)
          ])
        )
      }
    }
    render(h(App), root)
    expect(inner(root)).toBe('<div><span>a</span></div>')

    value.value = 'b'
    await nextTick()
    expect(inner(root)).toBe('<div><span>b</span></div>')
  })

  test.todo('handle already mounted VNode')
})
