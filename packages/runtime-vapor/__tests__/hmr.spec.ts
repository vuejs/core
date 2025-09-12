// TODO: port tests from packages/runtime-core/__tests__/hmr.spec.ts

import { type HMRRuntime, ref } from '@vue/runtime-dom'
import { makeRender } from './_utils'
import {
  child,
  createComponent,
  renderEffect,
  setText,
  template,
} from '@vue/runtime-vapor'

declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { createRecord, reload } = __VUE_HMR_RUNTIME__

const define = makeRender()

describe('hot module replacement', () => {
  test('child reload + parent reload', async () => {
    const root = document.createElement('div')
    const childId = 'test1-child-reload'
    const parentId = 'test1-parent-reload'

    const { component: Child } = define({
      __hmrId: childId,
      setup() {
        const msg = ref('child')
        return { msg }
      },
      render(ctx) {
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0]
      },
    })
    createRecord(childId, Child as any)

    const { mount, component: Parent } = define({
      __hmrId: parentId,
      setup() {
        const msg = ref('root')
        return { msg }
      },
      render(ctx) {
        const n0 = createComponent(Child)
        const n1 = template(`<div> </div>`)()
        const x0 = child(n1 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0, n1]
      },
    }).create()
    createRecord(parentId, Parent as any)
    mount(root)

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child</div><div>root</div>"`,
    )

    // reload child
    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        const msg = ref('child changed')
        return { msg }
      },
      render(ctx: any) {
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0]
      },
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed</div><div>root</div>"`,
    )

    // reload child again
    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        const msg = ref('child changed2')
        return { msg }
      },
      render(ctx: any) {
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0]
      },
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed2</div><div>root</div>"`,
    )

    // reload parent
    reload(parentId, {
      __hmrId: parentId,
      __vapor: true,
      setup() {
        const msg = ref('root changed')
        return { msg }
      },
      render(ctx: any) {
        const n0 = createComponent(Child)
        const n1 = template(`<div> </div>`)()
        const x0 = child(n1 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0, n1]
      },
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed2</div><div>root changed</div>"`,
    )
  })
})
