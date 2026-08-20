import { createVaporSSRApp, defineVaporAsyncComponent } from '../../src'
import { defineComponent, h, markRaw, nextTick, ref } from '@vue/runtime-dom'
import type { VaporComponentInstance } from '../../src/component'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'
import { normalizeBlock } from '../../src/block'
import {
  compileVaporComponent,
  formatHtml,
  formatNodeList,
  setupHydrationTest,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('async component', async () => {
    describe('suspense', () => {
      describe('VDOM suspense', () => {
        test('updates an earlier branch from sibling beforeMount during async setup hydration', async () => {
          const childCode = `
            <script vapor>
              const data = _data
              const components = _components
              await data.value.wait
            </script>
            <template>
              <div v-if="data.show">A</div>
              <components.Mutator />
            </template>
          `
          const mutatorCode = `
            <script vapor>
              import { onBeforeMount } from 'vue'
              const data = _data
              onBeforeMount(() => {
                data.value.show = false
              })
            </script>
            <template><span>tail</span></template>
          `
          const appCode = `
            <script setup>
              const components = _components
            </script>
            <template>
              <Suspense>
                <components.VaporChild />
              </Suspense>
            </template>
          `

          const data = ref({
            show: true,
            wait: Promise.resolve(),
          })
          const serverMutator = compileVaporComponent(
            mutatorCode,
            data,
            undefined,
            true,
          )
          const serverChild = compileVaporComponent(
            childCode,
            data,
            { Mutator: serverMutator },
            true,
          )
          const serverApp = compile(
            appCode,
            data,
            { VaporChild: serverChild },
            { vapor: false, ssr: true },
          )
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(serverApp),
          )

          let resolve: () => void
          data.value = {
            show: true,
            wait: new Promise<void>(r => {
              resolve = r
            }),
          }
          const clientMutator = compileVaporComponent(mutatorCode, data)
          const clientChild = compileVaporComponent(childCode, data, {
            Mutator: clientMutator,
          })
          const clientApp = compile(
            appCode,
            data,
            { VaporChild: clientChild },
            { vapor: false },
          )
          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)
          const errorHandler = vi.fn()
          const app = runtimeDom.createSSRApp(clientApp)
          app.config.errorHandler = errorHandler
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)

          resolve!()
          await new Promise(r => setTimeout(r))
          await nextTick()

          expect(errorHandler).not.toHaveBeenCalled()
          expect(container.textContent).toBe('tail')

          data.value.show = true
          await nextTick()
          expect(errorHandler).not.toHaveBeenCalled()
          expect(container.textContent).toBe('Atail')
        })

        test('hydrate VDOM Suspense vapor async setup updates empty v-for before trailing sibling', async () => {
          const data = ref({
            items: [] as string[],
            tail: 'tail',
          })
          const vaporChildCode = `
            <script vapor>
              import { onMounted } from 'vue'
              const data = _data
              onMounted(() => {
                data.value.items = ['foo', 'bar']
              })
              await new Promise(r => setTimeout(r, 10))
            </script>
            <template>
              <div>
                <span v-for="item in data.items" :key="item">{{ item }}</span>
                <i>{{ data.tail }}</i>
              </div>
            </template>
          `
          const appCode = `
            <script setup>
              const components = _components
            </script>
            <template>
              <Suspense>
                <components.VaporChild />
              </Suspense>
            </template>
          `

          const serverComponents: any = {}
          const clientComponents: any = {}
          serverComponents.VaporChild = compile(
            vaporChildCode,
            data,
            serverComponents,
            {
              vapor: true,
              ssr: true,
            },
          )
          clientComponents.VaporChild = compile(
            vaporChildCode,
            data,
            clientComponents,
            {
              vapor: true,
              ssr: false,
            },
          )
          const serverComp = compile(appCode, data, serverComponents, {
            vapor: false,
            ssr: true,
          })

          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(serverComp),
          )
          expect(formatHtml(html)).toMatchInlineSnapshot(`
          	"<div>
          	<!--[--><!--]-->
          	<i>tail</i></div>"
          `)

          const container = document.createElement('div')
          document.body.appendChild(container)
          container.innerHTML = html

          const clientComp = compile(appCode, data, clientComponents, {
            vapor: false,
            ssr: false,
          })
          const app = runtimeDom.createSSRApp(clientComp)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)

          await new Promise(r => setTimeout(r, 20))
          await nextTick()

          expect(`Hydration node mismatch`).not.toHaveBeenWarned()
          expect(`Hydration text mismatch`).not.toHaveBeenWarned()
          expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
          	"<div>
          	<!--[--><span>foo</span><span>bar</span><!--]-->
          	<i>tail</i></div>"
          `)
        })

        test('hydrate VDOM Suspense vapor async setup should not enter mount hooks twice', async () => {
          const beforeMount = vi.fn()
          const data = ref({ beforeMount })
          const vaporChildCode = `
            <script vapor>
              import { onBeforeMount } from 'vue'
              const data = _data
              onBeforeMount(() => data.value.beforeMount())
              await new Promise(r => setTimeout(r, 10))
            </script>
            <template><h1>Async component</h1></template>
          `
          const appCode = `
            <script setup>
              const components = _components
            </script>
            <template>
              <Suspense>
                <components.VaporChild />
              </Suspense>
            </template>
          `

          const serverComponents: any = {}
          const clientComponents: any = {}
          serverComponents.VaporChild = compile(
            vaporChildCode,
            data,
            serverComponents,
            {
              vapor: true,
              ssr: true,
            },
          )
          clientComponents.VaporChild = compile(
            vaporChildCode,
            data,
            clientComponents,
            {
              vapor: true,
              ssr: false,
            },
          )

          const serverApp = compile(appCode, data, serverComponents, {
            vapor: false,
            ssr: true,
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(serverApp),
          )

          const clientApp = compile(appCode, data, clientComponents, {
            vapor: false,
            ssr: false,
          })

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)

          const app = runtimeDom.createSSRApp(clientApp)
          app.use(runtimeVapor.vaporInteropPlugin)

          app.mount(container)
          await new Promise(r => setTimeout(r, 10))
          await nextTick()

          // beforeMount should only be called once during hydration
          expect(beforeMount).toHaveBeenCalledTimes(1)
        })

        test('hydrate VDOM Suspense vapor async setup can unmount before resolve', async () => {
          let resolveClient!: () => void
          let instance!: VaporComponentInstance
          const data = ref({
            showSuspense: true,
            tail: 'tail',
          })
          const serverData = ref({
            wait: Promise.resolve(),
          })
          const clientData = ref({
            wait: new Promise<void>(r => {
              resolveClient = r
            }),
          })
          const leaveHtml: string[] = []
          const transition = {
            persisted: false,
            beforeEnter() {},
            enter() {},
            leave(el: Element, done: () => void) {
              leaveHtml.push(el.innerHTML)
              done()
            },
            clone() {
              return this
            },
          }
          const vaporChildCode = `
            <script vapor>
              const data = _data
              await data.value.wait
            </script>
            <template><div>async resolved</div></template>
          `

          let VaporChild = compile(
            vaporChildCode,
            serverData,
            {},
            {
              vapor: true,
              ssr: true,
            },
          )

          const App = {
            setup() {
              return () => [
                data.value.showSuspense
                  ? h(
                      runtimeDom.Suspense,
                      { timeout: 0 },
                      {
                        default: () => {
                          const owner = h('section', [h(VaporChild)])
                          owner.transition = transition as any
                          return owner
                        },
                        fallback: () => h('div', 'pending'),
                      },
                    )
                  : h('p', 'fallback'),
                h('span', data.value.tail),
              ]
            },
          }

          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(App),
          )
          expect(formatHtml(html)).toMatchInlineSnapshot(`
            "
            <!--[--><section><div>async resolved</div></section><span>tail</span><!--]-->
            "
          `)

          VaporChild = compile(
            vaporChildCode,
            clientData,
            {},
            {
              vapor: true,
              ssr: false,
            },
          )
          const setup = VaporChild.setup
          VaporChild.setup = (props: any, child: VaporComponentInstance) => {
            instance = child
            return setup(props, child)
          }

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)

          const app = runtimeDom.createSSRApp(App)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)
          const pendingNodes = normalizeBlock(instance.pendingBlock!)
          expect(instance.block).toBeNull()
          expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
            "
            <!--[--><section><div>async resolved</div></section><span>tail</span><!--]-->
            "
          `)

          data.value.showSuspense = false
          await nextTick()
          expect(leaveHtml).toEqual(['<div>async resolved</div>'])
          expect(instance.pendingBlock).toBeUndefined()
          expect(pendingNodes.every(node => !node.isConnected)).toBe(true)
          expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
            "
            <!--[--><p>fallback</p><span>tail</span><!--]-->
            "
          `)

          resolveClient()
          await new Promise(r => setTimeout(r))
          expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
            "
            <!--[--><p>fallback</p><span>tail</span><!--]-->
            "
          `)
        })

        test('defers direct KeepAlive updates while hydrating async setup', async () => {
          let resolveClient!: () => void
          const asyncSetup = vi.fn()
          const syncSetup = vi.fn()
          const serverData = ref({
            wait: Promise.resolve(),
            asyncSetup: () => {},
            syncSetup: () => {},
            current: null as any,
          })
          const clientData = ref({
            wait: new Promise<void>(resolve => {
              resolveClient = resolve
            }),
            asyncSetup,
            syncSetup,
            current: null as any,
          })
          const asyncCode = `
            <script vapor>
              const data = _data
              data.value.asyncSetup()
              await data.value.wait
            </script>
            <template><span>async</span></template>
          `
          const syncCode = `
            <script vapor>
              const data = _data
              data.value.syncSetup()
            </script>
            <template><span>sync</span></template>
          `
          const parentCode = `
            <script setup vapor>
              const data = _data
            </script>
            <template>
              <KeepAlive>
                <component :is="data.current" />
              </KeepAlive>
            </template>
          `

          const serverChild = compileVaporComponent(
            asyncCode,
            serverData,
            undefined,
            true,
          )
          serverData.value.current = markRaw(serverChild)
          let Parent = compileVaporComponent(
            parentCode,
            serverData,
            undefined,
            true,
          )
          const App = defineComponent({
            setup() {
              return () =>
                h(runtimeDom.Suspense, null, {
                  default: () => h(Parent),
                  fallback: () => h('p', 'pending'),
                })
            },
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(App),
          )

          const asyncChild = compileVaporComponent(asyncCode, clientData)
          const syncChild = compileVaporComponent(syncCode, clientData)
          clientData.value.current = markRaw(asyncChild)
          Parent = compileVaporComponent(parentCode, clientData)

          const container = document.createElement('div')
          container.innerHTML = html
          const serverRoot = container.firstChild
          document.body.appendChild(container)
          const app = runtimeDom.createSSRApp(App)
          app.use(runtimeVapor.vaporInteropPlugin)

          try {
            app.mount(container)

            clientData.value.current = markRaw(syncChild)
            await nextTick()
            clientData.value.current = markRaw(asyncChild)
            await nextTick()

            expect(asyncSetup).toHaveBeenCalledOnce()
            expect(syncSetup).not.toHaveBeenCalled()
            expect(container.firstChild).toBe(serverRoot)
            expect(container.textContent).toBe('async')

            resolveClient()
            await new Promise(resolve => setTimeout(resolve))

            expect(asyncSetup).toHaveBeenCalledOnce()
            expect(syncSetup).not.toHaveBeenCalled()
            expect(container.firstChild).toBe(serverRoot)
            expect(container.textContent).toBe('async')
          } finally {
            resolveClient()
            app.unmount()
            container.remove()
          }
        })

        test('preserves nested pending SSR range until parent transition leave', async () => {
          let resolveClient!: () => void
          let instance!: VaporComponentInstance
          const data = ref({ show: true })
          const serverData = ref({ wait: Promise.resolve() })
          const clientData = ref({
            wait: new Promise<void>(resolve => {
              resolveClient = resolve
            }),
          })
          const leaveHtml: string[] = []
          let finishLeave!: () => void
          let leavingElement!: Element
          const transition = {
            persisted: false,
            beforeEnter() {},
            enter() {},
            leave(el: Element, done: () => void) {
              leaveHtml.push(el.innerHTML)
              leavingElement = el
              finishLeave = done
            },
            clone() {
              return this
            },
          }
          const childCode = `
            <script vapor>
              const data = _data
              await data.value.wait
            </script>
            <template><div>async resolved</div></template>
          `
          const parentCode = `
            <script vapor>
              const components = _components
            </script>
            <template><section><components.AsyncChild /></section></template>
          `

          const serverChild = compileVaporComponent(
            childCode,
            serverData,
            undefined,
            true,
          )
          let Parent = compileVaporComponent(
            parentCode,
            serverData,
            { AsyncChild: serverChild },
            true,
          )
          const App = defineComponent({
            setup() {
              return () =>
                data.value.show
                  ? h(
                      runtimeDom.Suspense,
                      { timeout: 0 },
                      {
                        default: () => {
                          const owner = h(Parent)
                          owner.transition = transition as any
                          return owner
                        },
                      },
                    )
                  : h('p', 'fallback')
            },
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(App),
          )

          const clientChild = compileVaporComponent(childCode, clientData)
          const setup = clientChild.setup
          clientChild.setup = (
            props: any,
            childInstance: VaporComponentInstance,
          ) => {
            instance = childInstance
            return setup(props, childInstance)
          }
          Parent = compileVaporComponent(parentCode, clientData, {
            AsyncChild: clientChild,
          })

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)
          const app = runtimeDom.createSSRApp(App)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)

          data.value.show = false
          await nextTick()

          expect(leaveHtml).toEqual(['<div>async resolved</div>'])
          expect(instance.isUnmounted).toBe(true)
          expect(instance.scope.active).toBe(false)
          expect(leavingElement.isConnected).toBe(true)
          expect(leavingElement.innerHTML).toBe('<div>async resolved</div>')

          finishLeave()
          expect(leavingElement.isConnected).toBe(false)
          resolveClient()
          await new Promise(resolve => setTimeout(resolve))
        })

        test('removes a pending SSR range through a vapor parent root', async () => {
          let resolveClient!: () => void
          let instance!: VaporComponentInstance
          const data = ref({ show: true })
          const serverData = ref({ wait: Promise.resolve() })
          const clientData = ref({
            wait: new Promise<void>(resolve => {
              resolveClient = resolve
            }),
          })
          const childCode = `
            <script vapor>
              const data = _data
              await data.value.wait
            </script>
            <template><div>async resolved</div></template>
          `
          const parentCode = `
            <script vapor>
              const components = _components
            </script>
            <template><components.AsyncChild /></template>
          `

          const serverChild = compileVaporComponent(
            childCode,
            serverData,
            undefined,
            true,
          )
          let Parent = compileVaporComponent(
            parentCode,
            serverData,
            { AsyncChild: serverChild },
            true,
          )
          const App = defineComponent({
            setup() {
              return () =>
                data.value.show
                  ? h(runtimeDom.Suspense, null, {
                      default: () => h(Parent),
                    })
                  : h('p', 'fallback')
            },
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(App),
          )

          const clientChild = compileVaporComponent(childCode, clientData)
          const setup = clientChild.setup
          clientChild.setup = (
            props: any,
            childInstance: VaporComponentInstance,
          ) => {
            instance = childInstance
            return setup(props, childInstance)
          }
          Parent = compileVaporComponent(parentCode, clientData, {
            AsyncChild: clientChild,
          })

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)
          const app = runtimeDom.createSSRApp(App)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)

          const pendingNodes = normalizeBlock(instance.pendingBlock!)
          data.value.show = false
          await nextTick()

          expect(instance.pendingBlock).toBeUndefined()
          expect(pendingNodes.every(node => !node.isConnected)).toBe(true)
          expect(container.innerHTML).toBe('<p>fallback</p>')

          resolveClient()
          await new Promise(resolve => setTimeout(resolve))
          expect(container.innerHTML).toBe('<p>fallback</p>')
        })

        test.each([
          ['single root', '<span>async</span>', ['<span>async</span>']],
          [
            'multi-root range',
            '<span>async</span><b>range</b>',
            ['<!--[-->', '<span>async</span>', '<b>range</b>', '<!--]-->'],
          ],
        ] as const)(
          'moves pending hydrated async setup before resolving (%s)',
          async (_, childTemplate, expectedPendingNodes) => {
            let resolveClient!: () => void
            const childData = ref({ wait: Promise.resolve() })
            const items = ref(['sync', 'async'])
            const vaporChildCode = `
            <script vapor>
              const data = _data
              await data.value.wait
            </script>
            <template>${childTemplate}</template>
          `
            let VaporChild = compile(
              vaporChildCode,
              childData,
              {},
              {
                vapor: true,
                ssr: true,
              },
            )
            const App = defineComponent({
              setup() {
                return () =>
                  h(runtimeDom.Suspense, null, {
                    default: () =>
                      h(
                        'div',
                        items.value.map(id =>
                          id === 'async'
                            ? h(VaporChild, { key: id })
                            : h('i', { key: id }, 'sync'),
                        ),
                      ),
                  })
              },
            })
            const html = await VueServerRenderer.renderToString(
              runtimeDom.createSSRApp(App),
            )

            childData.value.wait = new Promise<void>(resolve => {
              resolveClient = resolve
            })
            let instance!: VaporComponentInstance
            VaporChild = compile(
              vaporChildCode,
              childData,
              {},
              {
                vapor: true,
                ssr: false,
              },
            )
            const setup = VaporChild.setup
            VaporChild.setup = (props: any, child: VaporComponentInstance) => {
              instance = child
              return setup(props, child)
            }

            const container = document.createElement('div')
            container.innerHTML = html
            document.body.appendChild(container)
            const app = runtimeDom.createSSRApp(App)
            app.use(runtimeVapor.vaporInteropPlugin)
            app.mount(container)
            const childNodes = container.querySelector('div')!.childNodes
            const pendingNodes = normalizeBlock(instance.pendingBlock!)
            const syncNode = childNodes[0]
            const selfAnchor =
              pendingNodes[pendingNodes.length - 1].nextSibling!
            expect(formatNodeList(pendingNodes)).toEqual(expectedPendingNodes)
            expect(formatNodeList(childNodes)).toEqual([
              '<i>sync</i>',
              ...expectedPendingNodes,
              'text("")',
            ])
            expect(instance.block).toBeNull()

            const registerDep = vi.spyOn(instance.suspense!, 'registerDep')
            try {
              items.value = ['async', 'sync']
              await nextTick()

              expect(registerDep).not.toHaveBeenCalled()
              expect(instance.block).toBeNull()
              expect(normalizeBlock(instance.pendingBlock!)).toEqual(
                pendingNodes,
              )
              expect(Array.from(childNodes)).toEqual([
                ...pendingNodes,
                selfAnchor,
                syncNode,
              ])

              resolveClient()
              await new Promise(resolve => setTimeout(resolve))
              expect(instance.pendingBlock).toBeUndefined()
              expect(instance.block).not.toBeNull()
              expect(Array.from(childNodes)).toEqual([
                ...pendingNodes,
                selfAnchor,
                syncNode,
              ])
            } finally {
              registerDep.mockRestore()
              app.unmount()
              resolveClient()
              await new Promise(resolve => setTimeout(resolve))
              container.remove()
            }
          },
        )

        test('moves and removes pending hydrated ranges through Vapor v-for', async () => {
          const serverData = ref({
            items: [1, 2],
            wait: Promise.resolve(),
          })
          const clientData = ref({
            items: [1, 2],
            wait: new Promise<void>(() => {}),
          })
          const childCode = `
            <script vapor>
              const data = _data
              const props = defineProps(['id'])
              await data.value.wait
            </script>
            <template>
              <template v-if="true">
                <span>{{ props.id }}-one</span>
                <span>{{ props.id }}-two</span>
              </template>
            </template>
          `
          const parentCode = `
            <script vapor>
              const data = _data
              const components = _components
            </script>
            <template>
              <div>
                <components.AsyncChild
                  v-for="id in data.items"
                  :key="id"
                  :id="id"
                />
                <i>tail</i>
              </div>
            </template>
          `
          const serverChild = compileVaporComponent(
            childCode,
            serverData,
            {},
            true,
          )
          let Parent = compileVaporComponent(
            parentCode,
            serverData,
            { AsyncChild: serverChild },
            true,
          )
          const App = defineComponent({
            setup: () => () =>
              h(runtimeDom.Suspense, null, {
                default: () => h(Parent),
              }),
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(App),
          )

          const instances: VaporComponentInstance[] = []
          const clientChild = compileVaporComponent(childCode, clientData)
          const setup = clientChild.setup
          clientChild.setup = (
            props: any,
            instance: VaporComponentInstance,
          ) => {
            instances.push(instance)
            return setup(props, instance)
          }
          Parent = compileVaporComponent(parentCode, clientData, {
            AsyncChild: clientChild,
          })

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)
          const app = runtimeDom.createSSRApp(App)
          app.use(runtimeVapor.vaporInteropPlugin)

          try {
            app.mount(container)

            expect(instances).toHaveLength(2)
            expect(instances[0].block).toBeNull()
            expect(instances[1].block).toBeNull()
            const firstRange = normalizeBlock(instances[0].pendingBlock!)
            const secondRange = normalizeBlock(instances[1].pendingBlock!)
            expect(formatNodeList(firstRange)).toEqual([
              '<!--[-->',
              '<span>1-one</span>',
              '<span>1-two</span>',
              '<!--]-->',
            ])
            expect(formatNodeList(secondRange)).toEqual([
              '<!--[-->',
              '<span>2-one</span>',
              '<span>2-two</span>',
              '<!--]-->',
            ])

            const parent = container.querySelector('div')!
            const tail = parent.querySelector('i')!
            const expectRangesInOrder = (...ranges: Node[][]) => {
              const nodes: Node[] = Array.from(parent.childNodes)
              let previousEnd = -1
              for (const range of ranges) {
                const start = nodes.indexOf(range[0])
                expect(start).toBeGreaterThan(previousEnd)
                expect(nodes.slice(start, start + range.length)).toEqual(range)
                previousEnd = start + range.length - 1
              }
              expect(parent.lastElementChild).toBe(tail)
            }

            expectRangesInOrder(firstRange, secondRange)

            clientData.value.items = [2, 1]
            await nextTick()

            expect(instances).toHaveLength(2)
            expect(normalizeBlock(instances[0].pendingBlock!)).toEqual(
              firstRange,
            )
            expect(normalizeBlock(instances[1].pendingBlock!)).toEqual(
              secondRange,
            )
            expectRangesInOrder(secondRange, firstRange)

            clientData.value.items = [2]
            await nextTick()
            expect(instances[0].pendingBlock).toBeUndefined()
            expect(firstRange.every(node => node.parentNode === null)).toBe(
              true,
            )
            expect(normalizeBlock(instances[1].pendingBlock!)).toEqual(
              secondRange,
            )
            expectRangesInOrder(secondRange)

            expect(`Hydration node mismatch`).not.toHaveBeenWarned()
            expect(`Hydration children mismatch`).not.toHaveBeenWarned()
          } finally {
            app.unmount()
            container.remove()
          }
        })

        test('hydrate VDOM Suspense vapor async multi-root setup should preserve SSR range before resolve', async () => {
          let resolveClient!: () => void
          const serverData = ref({
            wait: Promise.resolve(),
            msg: 'one',
          })
          const clientData = ref({
            wait: new Promise<void>(r => {
              resolveClient = r
            }),
            msg: 'one',
          })
          const vaporChildCode = `
            <script vapor>
              const data = _data
              await data.value.wait
            </script>
            <template>
              <span>{{ data.msg }}</span>
              <span>two</span>
            </template>
          `
          const appCode = `
            <script setup>
              const components = _components
            </script>
            <template>
              <Suspense>
                <div>
                  <components.VaporChild />
                  <i>after</i>
                </div>
              </Suspense>
            </template>
          `

          const serverComponents: any = {}
          const clientComponents: any = {}
          serverComponents.VaporChild = compile(
            vaporChildCode,
            serverData,
            serverComponents,
            {
              vapor: true,
              ssr: true,
            },
          )
          clientComponents.VaporChild = compile(
            vaporChildCode,
            clientData,
            clientComponents,
            {
              vapor: true,
              ssr: false,
            },
          )
          const serverApp = compile(appCode, serverData, serverComponents, {
            vapor: false,
            ssr: true,
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(serverApp),
          )

          const clientApp = compile(appCode, clientData, clientComponents, {
            vapor: false,
            ssr: false,
          })
          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)

          const app = runtimeDom.createSSRApp(clientApp)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)

          expect(container.querySelectorAll('span')).toHaveLength(2)
          expect(container.textContent).toBe('onetwoafter')
          expect(`Hydration node mismatch`).not.toHaveBeenWarned()
          expect(`Hydration children mismatch`).not.toHaveBeenWarned()

          resolveClient()
          await new Promise(r => setTimeout(r))
          await nextTick()

          expect(`Hydration node mismatch`).not.toHaveBeenWarned()
          expect(`Hydration children mismatch`).not.toHaveBeenWarned()
          expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
            "<div>
            <!--[--><span>one</span><span>two</span><!--]-->
            <i>after</i></div>"
          `)
        })

        test('hydrate safely when property used by async setup changed before render', async () => {
          const data = ref({ toggle: true })
          const vaporChildCode = `
            <script vapor>
              defineProps(['prop'])
              await new Promise(r => setTimeout(r, 10))
            </script>
            <template><h1>{{ prop }}</h1></template>
          `
          const wrapperCode = `
            <script setup>
              const props = defineProps(['prop'])
              const components = _components
            </script>
            <template>
              <components.VaporChild :prop="props.prop" />
            </template>
          `
          const siblingCode = `
            <script setup>
              const data = _data
              data.value.toggle = false
            </script>
            <template><span/></template>
          `
          const appCode = `
            <script setup>
              const data = _data
              const components = _components
            </script>
            <template>
              <Suspense>
                <main>
                  <components.AsyncWrapper :prop="data.toggle ? 'hello' : 'world'" />
                  <components.SiblingComp />
                </main>
              </Suspense>
            </template>
          `

          const serverComponents: any = {}
          const clientComponents: any = {}
          serverComponents.VaporChild = compile(
            vaporChildCode,
            data,
            serverComponents,
            {
              vapor: true,
              ssr: true,
            },
          )
          clientComponents.VaporChild = compile(
            vaporChildCode,
            data,
            clientComponents,
            {
              vapor: true,
              ssr: false,
            },
          )
          serverComponents.AsyncWrapper = compile(
            wrapperCode,
            data,
            serverComponents,
            {
              vapor: false,
              ssr: true,
            },
          )
          clientComponents.AsyncWrapper = compile(
            wrapperCode,
            data,
            clientComponents,
            {
              vapor: false,
              ssr: false,
            },
          )
          serverComponents.SiblingComp = compile(
            siblingCode,
            data,
            serverComponents,
            {
              vapor: false,
              ssr: true,
            },
          )
          clientComponents.SiblingComp = compile(
            siblingCode,
            data,
            clientComponents,
            {
              vapor: false,
              ssr: false,
            },
          )

          const serverApp = compile(appCode, data, serverComponents, {
            vapor: false,
            ssr: true,
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(serverApp),
          )

          expect(html).toBe('<main><h1>hello</h1><span></span></main>')
          expect(data.value.toggle).toBe(false)

          data.value.toggle = true

          const clientApp = compile(appCode, data, clientComponents, {
            vapor: false,
            ssr: false,
          })

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)

          const app = runtimeDom.createSSRApp(clientApp)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)
          expect(container.innerHTML).toBe(html)

          await new Promise(r => setTimeout(r, 10))
          await nextTick()

          expect(data.value.toggle).toBe(false)
          expect(`Hydration node mismatch`).not.toHaveBeenWarned()
          expect(`Hydration children mismatch`).not.toHaveBeenWarned()
          expect(container.innerHTML).toBe(
            '<main><h1>world</h1><span></span></main>',
          )
        })

        test('hydrate safely when property used by deep nested async setup changed before render', async () => {
          const data = ref({ toggle: true })
          const vaporChildCode = `
            <script vapor>
              defineProps(['prop'])
              await new Promise(r => setTimeout(r, 10))
            </script>
            <template><h1>{{ prop }}</h1></template>
          `
          const wrapperCode = `
            <script setup>
              const components = _components
            </script>
            <template>
              <components.VaporChild v-bind="$attrs" />
            </template>
          `
          const wrapperWrapperCode = `
            <script setup>
              const components = _components
            </script>
            <template>
              <components.AsyncWrapper v-bind="$attrs" />
            </template>
          `
          const siblingCode = `
            <script setup>
              const data = _data
              data.value.toggle = false
            </script>
            <template><span/></template>
          `
          const appCode = `
            <script setup>
              const data = _data
              const components = _components
            </script>
            <template>
              <Suspense>
                <main>
                  <components.AsyncWrapperWrapper :prop="data.toggle ? 'hello' : 'world'" />
                  <components.SiblingComp />
                </main>
              </Suspense>
            </template>
          `

          const serverComponents: any = {}
          const clientComponents: any = {}
          serverComponents.VaporChild = compile(
            vaporChildCode,
            data,
            serverComponents,
            {
              vapor: true,
              ssr: true,
            },
          )
          clientComponents.VaporChild = compile(
            vaporChildCode,
            data,
            clientComponents,
            {
              vapor: true,
              ssr: false,
            },
          )
          serverComponents.AsyncWrapper = compile(
            wrapperCode,
            data,
            serverComponents,
            {
              vapor: false,
              ssr: true,
            },
          )
          clientComponents.AsyncWrapper = compile(
            wrapperCode,
            data,
            clientComponents,
            {
              vapor: false,
              ssr: false,
            },
          )
          serverComponents.AsyncWrapperWrapper = compile(
            wrapperWrapperCode,
            data,
            serverComponents,
            {
              vapor: false,
              ssr: true,
            },
          )
          clientComponents.AsyncWrapperWrapper = compile(
            wrapperWrapperCode,
            data,
            clientComponents,
            {
              vapor: false,
              ssr: false,
            },
          )
          serverComponents.SiblingComp = compile(
            siblingCode,
            data,
            serverComponents,
            {
              vapor: false,
              ssr: true,
            },
          )
          clientComponents.SiblingComp = compile(
            siblingCode,
            data,
            clientComponents,
            {
              vapor: false,
              ssr: false,
            },
          )

          const serverApp = compile(appCode, data, serverComponents, {
            vapor: false,
            ssr: true,
          })
          const html = await VueServerRenderer.renderToString(
            runtimeDom.createSSRApp(serverApp),
          )

          expect(html).toBe('<main><h1>hello</h1><span></span></main>')
          expect(data.value.toggle).toBe(false)

          data.value.toggle = true

          const clientApp = compile(appCode, data, clientComponents, {
            vapor: false,
            ssr: false,
          })

          const container = document.createElement('div')
          container.innerHTML = html
          document.body.appendChild(container)

          const app = runtimeDom.createSSRApp(clientApp)
          app.use(runtimeVapor.vaporInteropPlugin)
          app.mount(container)
          expect(container.innerHTML).toBe(html)

          await new Promise(r => setTimeout(r, 10))
          await nextTick()

          expect(data.value.toggle).toBe(false)
          expect(`Hydration node mismatch`).not.toHaveBeenWarned()
          expect(`Hydration children mismatch`).not.toHaveBeenWarned()
          expect(container.innerHTML).toBe(
            '<main><h1>world</h1><span></span></main>',
          )
        })
      })

      // required vapor Suspense
      describe.todo('vapor suspense', () => {
        test.todo('hydrate safely when property used by async setup changed before render', async () => {})
        test.todo('hydrate safely when property used by deep nested async setup changed before render', async () => {})
        test.todo('hydrate vapor async setup can unmount before resolve', async () => {})
      })
    })

    test('unmount async wrapper before load', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `<div>async</div>`
      const appCode = `
        <div>
          <components.AsyncComp v-if="data.toggle"/>
          <div v-else>hi</div>
        </div>
      `

      // hydration
      let clientResolve: any
      const AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      )

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, {
        AsyncComp,
      })

      const container = document.createElement('div')
      container.innerHTML = '<div><div>async</div></div>'
      createVaporSSRApp(App).mount(container)

      // unmount before resolve
      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))
      // should remain unmounted
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)
    })

    test('unmount async wrapper before load (fragment)', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `<div>async</div><div>fragment</div>`
      const appCode = `
        <div>
          <components.AsyncComp v-if="data.toggle"/>
          <div v-else>hi</div>
        </div>
      `

      // hydration
      let clientResolve: any
      const AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      )

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, {
        AsyncComp,
      })

      const container = document.createElement('div')
      container.innerHTML =
        '<div><!--[--><div>async</div><div>fragment</div><!--]--></div>'
      createVaporSSRApp(App).mount(container)

      // unmount before resolve
      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))
      // should remain unmounted
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)
    })

    test('nested async wrapper', async () => {
      const toggleCode = `
      <script vapor>
        import { onMounted, ref, nextTick } from 'vue'
        const show = ref(false)
        onMounted(() => {
          nextTick(() => {
            show.value = true
          })
        })
      </script>
      <template>
        <div v-show="show">
          <slot />
        </div>
      </template>
      `

      const SSRToggle = compileVaporComponent(
        toggleCode,
        undefined,
        undefined,
        true,
      )

      const wrapperCode = `<slot/>`
      const SSRWrapper = compileVaporComponent(
        wrapperCode,
        undefined,
        undefined,
        true,
      )

      const data = ref({
        count: 0,
        fn: vi.fn(),
      })

      const childCode = `
        <script vapor>
          import { onMounted } from 'vue'
          const data = _data; const components = _components;
          onMounted(() => {
            data.value.fn()
            data.value.count++
          })
        </script>
        <template>
          <div>{{data.count}}</div>
        </template>
      `

      const SSRChild = compileVaporComponent(childCode, data, undefined, true)

      const appCode = `
      <components.Toggle>
        <components.Wrapper>
          <components.Wrapper>
            <components.Child/>
          </components.Wrapper>
        </components.Wrapper>
      </components.Toggle>
      `

      const SSRApp = compileVaporComponent(
        appCode,
        undefined,
        {
          Toggle: SSRToggle,
          Wrapper: SSRWrapper,
          Child: SSRChild,
        },
        true,
      )

      const root = document.createElement('div')

      // server render
      root.innerHTML = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<div style="display:none;"><!--[--><!--[--><!--[--><div>0</div><!--]--><!--]--><!--]--></div>"`,
      )

      const Toggle = compileVaporComponent(toggleCode)
      const Wrapper = compileVaporComponent(wrapperCode)
      const Child = compileVaporComponent(childCode, data)

      const App = compileVaporComponent(appCode, undefined, {
        Toggle,
        Wrapper,
        Child,
      })

      // hydration
      createVaporSSRApp(App).mount(root)
      await nextTick()
      await nextTick()
      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<div style=""><!--[--><!--[--><!--[--><div>1</div><!--]--><!--]--><!--]--></div>"`,
      )
      expect(data.value.fn).toBeCalledTimes(1)
    })
  })

  describe.todo('Suspense')
})
