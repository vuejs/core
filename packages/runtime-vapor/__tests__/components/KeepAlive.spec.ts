import { type VaporComponent, createComponent } from '../../src/component'
import { makeRender } from '../_utils'
import { VaporKeepAlive } from '../../src/components/KeepAlive'
import { defineVaporComponent } from '../../src/apiDefineComponent'
import { child } from '../../src/dom/node'
import { setText } from '../../src/dom/prop'
import { template } from '../../src/dom/template'
import { renderEffect } from '../../src/renderEffect'
import { createTemplateRefSetter } from '../../src/apiTemplateRef'
import { createDynamicComponent } from '../../src/apiCreateDynamicComponent'
import {
  nextTick,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'

const define = makeRender()

describe('VaporKeepAlive', () => {
  let one: VaporComponent
  let two: VaporComponent
  let oneTest: VaporComponent
  let views: Record<string, VaporComponent>
  let root: HTMLDivElement

  beforeEach(() => {
    root = document.createElement('div')
    one = defineVaporComponent({
      name: 'one',
      setup(_, { expose }) {
        onBeforeMount(vi.fn())
        onMounted(vi.fn())
        onActivated(vi.fn())
        onDeactivated(vi.fn())
        onUnmounted(vi.fn())

        const msg = ref('one')
        expose({ setMsg: (m: string) => (msg.value = m) })

        const n0 = template(`<div> </div>`)() as any
        const x0 = child(n0) as any
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    oneTest = defineVaporComponent({
      name: 'oneTest',
      setup() {
        onBeforeMount(vi.fn())
        onMounted(vi.fn())
        onActivated(vi.fn())
        onDeactivated(vi.fn())
        onUnmounted(vi.fn())

        const msg = ref('oneTest')
        const n0 = template(`<div> </div>`)() as any
        const x0 = child(n0) as any
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    two = defineVaporComponent({
      name: 'two',
      setup() {
        onBeforeMount(vi.fn())
        onMounted(vi.fn())
        onActivated(vi.fn())
        onDeactivated(vi.fn())
        onUnmounted(vi.fn())

        const msg = ref('two')
        const n0 = template(`<div> </div>`)() as any
        const x0 = child(n0) as any
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    views = {
      one,
      oneTest,
      two,
    }
  })

  test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)

    const { mount } = define({
      setup() {
        const setTemplateRef = createTemplateRefSetter()
        const n4 = createComponent(VaporKeepAlive as any, null, {
          default: () => {
            const n0 = createDynamicComponent(() => views[viewRef.value]) as any
            setTemplateRef(n0, instanceRef)
            return n0
          },
        })
        return n4
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe(`<div>one</div><!--dynamic-component-->`)

    instanceRef.value.setMsg('changed')
    await nextTick()
    expect(root.innerHTML).toBe(`<div>changed</div><!--dynamic-component-->`)

    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>two</div><!--dynamic-component-->`)

    viewRef.value = 'one'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>changed</div><!--dynamic-component-->`)
  })
})
