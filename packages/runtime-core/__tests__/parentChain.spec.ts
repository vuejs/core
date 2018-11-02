import {
  h,
  Component,
  observable,
  nextTick,
  renderInstance
} from '@vue/runtime-test'

describe('Parent chain management', () => {
  it('should have correct $parent / $root / $children', async () => {
    let child: any
    let grandChildren: any[] = []

    const state = observable({ ok: true })

    class Parent extends Component {
      render() {
        return h(Child)
      }
    }

    class Child extends Component {
      created() {
        child = this
      }
      render() {
        return [state.ok ? h(GrandChild) : null, h(GrandChild)]
      }
    }

    class GrandChild extends Component {
      created() {
        grandChildren.push(this)
      }
      unmounted() {
        grandChildren.splice(grandChildren.indexOf(this), 1)
      }
      render() {
        return h('div')
      }
    }

    const parent = await renderInstance(Parent)

    expect(child.$parent).toBe(parent)
    expect(child.$root).toBe(parent)

    grandChildren.forEach(grandChild => {
      expect(grandChild.$parent).toBe(child)
      expect(grandChild.$root).toBe(parent)
    })

    expect(parent.$children).toEqual([child])
    expect(grandChildren.length).toBe(2)
    expect(child.$children).toEqual(grandChildren)

    state.ok = false
    await nextTick()
    expect(grandChildren.length).toBe(1)
    expect(child.$children).toEqual(grandChildren)
  })

  it('should have correct $parent / $root w/ functional component in between', async () => {
    let child: any
    let grandChildren: any[] = []

    const state = observable({ ok: true })

    class Parent extends Component {
      render() {
        return h(FunctionalChild)
      }
    }

    const FunctionalChild = () => h(Child)

    class Child extends Component {
      created() {
        child = this
      }
      render() {
        return [
          state.ok ? h(FunctionalGrandChild) : null,
          h(FunctionalGrandChild)
        ]
      }
    }

    const FunctionalGrandChild = () => h(GrandChild)

    class GrandChild extends Component {
      created() {
        grandChildren.push(this)
      }
      unmounted() {
        grandChildren.splice(grandChildren.indexOf(this), 1)
      }
      render() {}
    }

    const parent = await renderInstance(Parent)

    expect(child.$parent).toBe(parent)
    expect(child.$root).toBe(parent)

    grandChildren.forEach(grandChild => {
      expect(grandChild.$parent).toBe(child)
      expect(grandChild.$root).toBe(parent)
    })

    expect(parent.$children).toEqual([child])
    expect(grandChildren.length).toBe(2)
    expect(child.$children).toEqual(grandChildren)

    state.ok = false
    await nextTick()
    expect(grandChildren.length).toBe(1)
    expect(child.$children).toEqual(grandChildren)
  })
})
