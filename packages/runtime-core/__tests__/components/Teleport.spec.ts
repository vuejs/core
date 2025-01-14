/**
 * @vitest-environment jsdom
 */

import {
  Teleport,
  Text,
  createApp,
  defineComponent,
  markRaw,
  nextTick,
  nodeOps,
  h as originalH,
  ref,
  render,
  serializeInner,
  withDirectives,
} from '@vue/runtime-test'
import { Fragment, createCommentVNode, createVNode } from '../../src/vnode'
import { compile, createApp as createDOMApp, render as domRender } from 'vue'

describe('renderer: teleport', () => {
  describe('eager mode', () => {
    runSharedTests(false)
  })

  describe('defer mode', () => {
    runSharedTests(true)

    const h = originalH

    test('should be able to target content appearing later than the teleport with defer', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      createDOMApp({
        render() {
          return [
            h(Teleport, { to: '#target', defer: true }, h('div', 'teleported')),
            h('div', { id: 'target' }),
          ]
        },
      }).mount(root)

      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<!--teleport start--><!--teleport end--><div id="target"><div>teleported</div></div>"`,
      )
    })

    test('defer mode should work inside suspense', async () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      let p: Promise<any>

      const Comp = defineComponent({
        template: `
        <suspense>
          <div>
            <async />
            <teleport defer to="#target-suspense">
              <div>teleported</div>
            </teleport>
            <div id="target-suspense" />
          </div>
        </suspense>`,
        components: {
          async: {
            setup() {
              p = Promise.resolve(() => 'async')
              return p
            },
          },
        },
      })

      domRender(h(Comp), root)
      expect(root.innerHTML).toBe(`<!---->`)

      await p!.then(() => Promise.resolve())
      await nextTick()
      expect(root.innerHTML).toBe(
        `<div>` +
          `async` +
          `<!--teleport start--><!--teleport end-->` +
          `<div id="target-suspense"><div>teleported</div></div>` +
          `</div>`,
      )
    })

    test('update before mounted with defer', async () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      const show = ref(false)
      const foo = ref('foo')
      const Header = {
        props: { foo: String },
        setup(props: any) {
          return () => h('div', props.foo)
        },
      }
      const Footer = {
        setup() {
          foo.value = 'bar'
          return () => h('div', 'Footer')
        },
      }
      createDOMApp({
        render() {
          return show.value
            ? [
                h(
                  Teleport,
                  { to: '#targetId', defer: true },
                  h(Header, { foo: foo.value }),
                ),
                h(Footer),
                h('div', { id: 'targetId' }),
              ]
            : [h('div')]
        },
      }).mount(root)

      expect(root.innerHTML).toMatchInlineSnapshot(`"<div></div>"`)

      show.value = true
      await nextTick()
      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<!--teleport start--><!--teleport end--><div>Footer</div><div id="targetId"><div>bar</div></div>"`,
      )
    })
  })

  function runSharedTests(deferMode: boolean) {
    const h = (deferMode
      ? (type: any, props: any, ...args: any[]) => {
          if (type === Teleport) {
            props.defer = true
          }
          return originalH(type, props, ...args)
        }
      : originalH) as unknown as typeof originalH

    test('should work', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      render(
        h(() => [
          h(Teleport, { to: target }, h('div', 'teleported')),
          h('div', 'root'),
        ]),
        root,
      )

      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)
    })

    test('should work with SVG', async () => {
      const root = document.createElement('div')
      const svg = ref()
      const circle = ref()

      const Comp = defineComponent({
        setup() {
          return {
            svg,
            circle,
          }
        },
        template: `
        <svg ref="svg"></svg>
        <teleport :to="svg" v-if="svg">
        <circle ref="circle"></circle>
        </teleport>`,
      })

      domRender(h(Comp), root)

      await nextTick()

      expect(root.innerHTML).toBe(
        `<svg><circle></circle></svg><!--teleport start--><!--teleport end-->`,
      )

      expect(svg.value.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(circle.value.namespaceURI).toBe('http://www.w3.org/2000/svg')
    })

    test('should update target', async () => {
      const targetA = nodeOps.createElement('div')
      const targetB = nodeOps.createElement('div')
      const target = ref(targetA)
      const root = nodeOps.createElement('div')

      render(
        h(() => [
          h(Teleport, { to: target.value }, h('div', 'teleported')),
          h('div', 'root'),
        ]),
        root,
      )

      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(targetA)).toBe(`<div>teleported</div>`)
      expect(serializeInner(targetB)).toBe(``)

      target.value = targetB
      await nextTick()

      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(targetA)).toBe(``)
      expect(serializeInner(targetB)).toBe(`<div>teleported</div>`)
    })

    test('should update children', async () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')
      const children = ref([h('div', 'teleported')])

      render(
        h(() => h(Teleport, { to: target }, children.value)),
        root,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)

      children.value = []
      await nextTick()

      expect(serializeInner(target)).toBe(``)

      children.value = [createVNode(Text, null, 'teleported')]
      await nextTick()

      expect(serializeInner(target)).toBe(`teleported`)
    })

    test('should remove children when unmounted', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      function testUnmount(props: any) {
        render(
          h(() => [
            h(Teleport, props, h('div', 'teleported')),
            h('div', 'root'),
          ]),
          root,
        )
        expect(serializeInner(target)).toBe(
          props.disabled ? `` : `<div>teleported</div>`,
        )

        render(null, root)
        expect(serializeInner(target)).toBe('')
        expect(target.children.length).toBe(0)
      }

      testUnmount({ to: target, disabled: false })
      testUnmount({ to: target, disabled: true })
      testUnmount({ to: null, disabled: true })
    })

    test('component with multi roots should be removed when unmounted', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      const Comp = {
        render() {
          return [h('p'), h('p')]
        },
      }

      render(
        h(() => [h(Teleport, { to: target }, h(Comp)), h('div', 'root')]),
        root,
      )
      expect(serializeInner(target)).toBe(`<p></p><p></p>`)

      render(null, root)
      expect(serializeInner(target)).toBe('')
    })

    // #6347
    test('descendent component should be unmounted when teleport is disabled and unmounted', () => {
      const root = nodeOps.createElement('div')

      const CompWithHook = {
        render() {
          return [h('p'), h('p')]
        },
        beforeUnmount: vi.fn(),
        unmounted: vi.fn(),
      }

      render(
        h(() => [h(Teleport, { to: null, disabled: true }, h(CompWithHook))]),
        root,
      )
      expect(CompWithHook.beforeUnmount).toBeCalledTimes(0)
      expect(CompWithHook.unmounted).toBeCalledTimes(0)

      render(null, root)

      expect(CompWithHook.beforeUnmount).toBeCalledTimes(1)
      expect(CompWithHook.unmounted).toBeCalledTimes(1)
    })

    test('multiple teleport with same target', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      render(
        h('div', [
          h(Teleport, { to: target }, h('div', 'one')),
          h(Teleport, { to: target }, 'two'),
        ]),
        root,
      )

      expect(serializeInner(root)).toBe(
        `<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>`,
      )
      expect(serializeInner(target)).toBe(`<div>one</div>two`)

      // update existing content
      render(
        h('div', [
          h(Teleport, { to: target }, [h('div', 'one'), h('div', 'two')]),
          h(Teleport, { to: target }, 'three'),
        ]),
        root,
      )
      expect(serializeInner(target)).toBe(`<div>one</div><div>two</div>three`)

      // toggling
      render(h('div', [null, h(Teleport, { to: target }, 'three')]), root)
      expect(serializeInner(root)).toBe(
        `<div><!----><!--teleport start--><!--teleport end--></div>`,
      )
      expect(serializeInner(target)).toBe(`three`)

      // toggle back
      render(
        h('div', [
          h(Teleport, { to: target }, [h('div', 'one'), h('div', 'two')]),
          h(Teleport, { to: target }, 'three'),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>`,
      )
      // should append
      expect(serializeInner(target)).toBe(`three<div>one</div><div>two</div>`)

      // toggle the other teleport
      render(
        h('div', [
          h(Teleport, { to: target }, [h('div', 'one'), h('div', 'two')]),
          null,
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<div><!--teleport start--><!--teleport end--><!----></div>`,
      )
      expect(serializeInner(target)).toBe(`<div>one</div><div>two</div>`)
    })

    test('should work when using template ref as target', async () => {
      const root = nodeOps.createElement('div')
      const target = ref(null)
      const disabled = ref(true)

      const App = {
        setup() {
          return () =>
            h(Fragment, [
              h('div', { ref: target }),
              h(
                Teleport,
                { to: target.value, disabled: disabled.value },
                h('div', 'teleported'),
              ),
            ])
        },
      }
      render(h(App), root)
      expect(serializeInner(root)).toBe(
        `<div></div><!--teleport start--><div>teleported</div><!--teleport end-->`,
      )

      disabled.value = false
      await nextTick()
      expect(serializeInner(root)).toBe(
        `<div><div>teleported</div></div><!--teleport start--><!--teleport end-->`,
      )
    })

    test('disabled', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      const renderWithDisabled = (disabled: boolean) => {
        return h(Fragment, [
          h(Teleport, { to: target, disabled }, h('div', 'teleported')),
          h('div', 'root'),
        ])
      }

      render(renderWithDisabled(false), root)
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)

      render(renderWithDisabled(true), root)
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><div>teleported</div><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(``)

      // toggle back
      render(renderWithDisabled(false), root)
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)
    })

    test('moving teleport while enabled', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      render(
        h(Fragment, [
          h(Teleport, { to: target }, h('div', 'teleported')),
          h('div', 'root'),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)

      render(
        h(Fragment, [
          h('div', 'root'),
          h(Teleport, { to: target }, h('div', 'teleported')),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<div>root</div><!--teleport start--><!--teleport end-->`,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)

      render(
        h(Fragment, [
          h(Teleport, { to: target }, h('div', 'teleported')),
          h('div', 'root'),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(`<div>teleported</div>`)
    })

    test('moving teleport while disabled', () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')

      render(
        h(Fragment, [
          h(Teleport, { to: target, disabled: true }, h('div', 'teleported')),
          h('div', 'root'),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><div>teleported</div><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe('')

      render(
        h(Fragment, [
          h('div', 'root'),
          h(Teleport, { to: target, disabled: true }, h('div', 'teleported')),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<div>root</div><!--teleport start--><div>teleported</div><!--teleport end-->`,
      )
      expect(serializeInner(target)).toBe('')

      render(
        h(Fragment, [
          h(Teleport, { to: target, disabled: true }, h('div', 'teleported')),
          h('div', 'root'),
        ]),
        root,
      )
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><div>teleported</div><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe('')
    })

    test('should work with block tree', async () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')
      const disabled = ref(false)

      const App = {
        setup() {
          return {
            target: markRaw(target),
            disabled,
          }
        },
        render: compile(`
        <teleport :to="target" :disabled="disabled">
          <div>teleported</div><span>{{ disabled }}</span><span v-if="disabled"/>
        </teleport>
        <div>root</div>
        `),
      }
      render(h(App), root)
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(
        `<div>teleported</div><span>false</span><!--v-if-->`,
      )

      disabled.value = true
      await nextTick()
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><div>teleported</div><span>true</span><span></span><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(``)

      // toggle back
      disabled.value = false
      await nextTick()
      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end--><div>root</div>`,
      )
      expect(serializeInner(target)).toBe(
        `<div>teleported</div><span>false</span><!--v-if-->`,
      )
    })

    // #3497
    test(`the dir hooks of the Teleport's children should be called correctly`, async () => {
      const target = nodeOps.createElement('div')
      const root = nodeOps.createElement('div')
      const toggle = ref(true)
      const dir = {
        mounted: vi.fn(),
        unmounted: vi.fn(),
      }

      const app = createApp({
        setup() {
          return () => {
            return toggle.value
              ? h(Teleport, { to: target }, [
                  withDirectives(h('div', ['foo']), [[dir]]),
                ])
              : null
          }
        },
      })
      app.mount(root)

      expect(serializeInner(root)).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(serializeInner(target)).toBe(`<div>foo</div>`)
      await nextTick()
      expect(dir.mounted).toHaveBeenCalledTimes(1)
      expect(dir.unmounted).toHaveBeenCalledTimes(0)

      toggle.value = false
      await nextTick()
      expect(serializeInner(root)).toBe(`<!---->`)
      expect(serializeInner(target)).toBe(``)
      expect(dir.mounted).toHaveBeenCalledTimes(1)
      expect(dir.unmounted).toHaveBeenCalledTimes(1)
    })

    // #7835
    test(`ensure that target changes when disabled are updated correctly when enabled`, async () => {
      const root = nodeOps.createElement('div')
      const target1 = nodeOps.createElement('div')
      const target2 = nodeOps.createElement('div')
      const target3 = nodeOps.createElement('div')
      const target = ref(target1)
      const disabled = ref(true)

      const App = {
        setup() {
          return () =>
            h(Fragment, [
              h(
                Teleport,
                { to: target.value, disabled: disabled.value },
                h('div', 'teleported'),
              ),
            ])
        },
      }
      render(h(App), root)
      disabled.value = false
      await nextTick()
      expect(serializeInner(target1)).toBe(`<div>teleported</div>`)
      expect(serializeInner(target2)).toBe(``)
      expect(serializeInner(target3)).toBe(``)

      disabled.value = true
      await nextTick()
      target.value = target2
      await nextTick()
      expect(serializeInner(target1)).toBe(``)
      expect(serializeInner(target2)).toBe(``)
      expect(serializeInner(target3)).toBe(``)

      target.value = target3
      await nextTick()
      expect(serializeInner(target1)).toBe(``)
      expect(serializeInner(target2)).toBe(``)
      expect(serializeInner(target3)).toBe(``)

      disabled.value = false
      await nextTick()
      expect(serializeInner(target1)).toBe(``)
      expect(serializeInner(target2)).toBe(``)
      expect(serializeInner(target3)).toBe(`<div>teleported</div>`)
    })

    //#9071
    test('toggle sibling node inside target node', async () => {
      const root = document.createElement('div')
      const show = ref(false)
      const App = defineComponent({
        setup() {
          return () => {
            return show.value
              ? h(Teleport, { to: root }, [h('div', 'teleported')])
              : h('div', 'foo')
          }
        },
      })

      domRender(h(App), root)
      expect(root.innerHTML).toBe('<div>foo</div>')

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>teleported</div>',
      )

      show.value = false
      await nextTick()

      expect(root.innerHTML).toBe('<div>foo</div>')
    })

    test('unmount previous sibling node inside target node', async () => {
      const root = document.createElement('div')
      const parentShow = ref(false)
      const childShow = ref(true)

      const Comp = {
        setup() {
          return () => h(Teleport, { to: root }, [h('div', 'foo')])
        },
      }

      const App = defineComponent({
        setup() {
          return () => {
            return parentShow.value
              ? h(Fragment, { key: 0 }, [
                  childShow.value ? h(Comp) : createCommentVNode('v-if'),
                ])
              : createCommentVNode('v-if')
          }
        },
      })

      domRender(h(App), root)
      expect(root.innerHTML).toBe('<!--v-if-->')

      parentShow.value = true
      await nextTick()
      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>foo</div>',
      )

      parentShow.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<!--v-if-->')
    })

    test('accessing template refs inside teleport', async () => {
      const target = nodeOps.createElement('div')
      const tRef = ref()
      let tRefInMounted

      render(
        h({
          render: () => [
            h(Teleport, { to: target }, h('div', { ref: tRef }, 'teleported')),
            h('div', 'root'),
          ],
          mounted() {
            tRefInMounted = tRef.value
          },
        }),
        nodeOps.createElement('div'),
      )

      // children[0] is the start anchor
      expect(tRefInMounted).toBe(target.children[1])
    })
  }
})
