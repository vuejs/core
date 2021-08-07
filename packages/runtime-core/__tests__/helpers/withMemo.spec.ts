// since v-memo really is a compiler + runtime combo feature, we are performing
// more of an itegration test here.
import { ComponentOptions, createApp, nextTick } from 'vue'

describe('v-memo', () => {
  function mount(options: ComponentOptions): [HTMLElement, any] {
    const app = createApp(options)
    const el = document.createElement('div')
    const vm = app.mount(el)
    return [el, vm]
  }

  test('on normal element', async () => {
    const [el, vm] = mount({
      template: `<div v-memo="[x]">{{ x }} {{ y }}</div>`,
      data: () => ({ x: 0, y: 0 })
    })
    expect(el.innerHTML).toBe(`<div>0 0</div>`)

    vm.x++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 0</div>`)

    vm.y++
    // should not update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 0</div>`)

    vm.x++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>2 1</div>`)
  })

  test('on component', async () => {
    const [el, vm] = mount({
      template: `<Comp v-memo="[x]" :x="x" :y="y"></Comp>`,
      data: () => ({ x: 0, y: 0 }),
      components: {
        Comp: {
          props: ['x', 'y'],
          template: `<div>{{x}} {{y}}</div>`
        }
      }
    })
    expect(el.innerHTML).toBe(`<div>0 0</div>`)

    vm.x++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 0</div>`)

    vm.y++
    // should not update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 0</div>`)

    vm.x++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>2 1</div>`)
  })

  test('on v-if', async () => {
    const [el, vm] = mount({
      template: `<div v-if="ok" v-memo="[x]">{{ x }} {{ y }}</div>
        <div v-else v-memo="[y]">{{ y }} {{ x }}</div>`,
      data: () => ({ ok: true, x: 0, y: 0 })
    })
    expect(el.innerHTML).toBe(`<div>0 0</div>`)

    vm.x++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 0</div>`)

    vm.y++
    // should not update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 0</div>`)

    vm.x++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>2 1</div>`)

    vm.ok = false
    await nextTick()
    expect(el.innerHTML).toBe(`<div>1 2</div>`)

    vm.y++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>2 2</div>`)

    vm.x++
    // should not update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>2 2</div>`)

    vm.y++
    // should update
    await nextTick()
    expect(el.innerHTML).toBe(`<div>3 3</div>`)
  })

  test('on v-for', async () => {
    const [el, vm] = mount({
      template:
        `<div v-for="{ x } in list" :key="x" v-memo="[x, x === y]">` +
        `{{ x }} {{ x === y ? 'yes' : 'no' }} {{ z }}` +
        `</div>`,
      data: () => ({
        list: [{ x: 1 }, { x: 2 }, { x: 3 }],
        y: 1,
        z: 'z'
      })
    })
    expect(el.innerHTML).toBe(
      `<div>1 yes z</div><div>2 no z</div><div>3 no z</div>`
    )

    vm.y = 2
    await nextTick()
    expect(el.innerHTML).toBe(
      `<div>1 no z</div><div>2 yes z</div><div>3 no z</div>`
    )

    vm.list[0].x = 4
    await nextTick()
    expect(el.innerHTML).toBe(
      `<div>4 no z</div><div>2 yes z</div><div>3 no z</div>`
    )

    vm.list[0].x = 5
    vm.y = 5
    await nextTick()
    expect(el.innerHTML).toBe(
      `<div>5 yes z</div><div>2 no z</div><div>3 no z</div>`
    )

    vm.z = 'zz'
    await nextTick()
    // should not update
    expect(el.innerHTML).toBe(
      `<div>5 yes z</div><div>2 no z</div><div>3 no z</div>`
    )
  })

  test('on v-for /w constant expression ', async () => {
    const [el, vm] = mount({
      template: `<div v-for="item in 3"  v-memo="[count < 2 ? true : count]">
          {{count}}
        </div>`,
      data: () => ({
        count: 0
      })
    })
    expect(el.innerHTML).toBe(`<div>0</div><div>0</div><div>0</div>`)

    vm.count = 1
    await nextTick()
    // should not update
    expect(el.innerHTML).toBe(`<div>0</div><div>0</div><div>0</div>`)

    vm.count = 2
    await nextTick()
    // should update
    expect(el.innerHTML).toBe(`<div>2</div><div>2</div><div>2</div>`)
  })
})
