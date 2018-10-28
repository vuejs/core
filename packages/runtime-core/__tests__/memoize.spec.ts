import { h, Component, memoize, nextTick } from '../src'
import { renderIntsance, serialize } from '@vue/runtime-test'

describe('memoize', () => {
  it('should work', async () => {
    class App extends Component {
      count = 1
      render() {
        return h('div', [
          this.count,
          this.count % 2
            ? memoize(() => h('div', `A` + this.count), this, 0)
            : null,
          memoize(() => h('div', `B` + this.count), this, 1)
        ])
      }
    }

    const app = renderIntsance(App)
    expect(serialize(app.$el)).toBe(`<div>1<div>A1</div><div>B1</div></div>`)

    app.count++
    await nextTick()
    expect(serialize(app.$el)).toBe(`<div>2<div>B1</div></div>`)

    app.count++
    await nextTick()
    // test remounting a memoized tree
    expect(serialize(app.$el)).toBe(`<div>3<div>A1</div><div>B1</div></div>`)
  })

  it('should invalidate based on keys', async () => {
    class App extends Component {
      foo = 1
      bar = 1
      render() {
        return memoize(() => h('div', this.foo + this.bar), this, 0, [this.bar])
      }
    }

    const app = renderIntsance(App)
    expect(serialize(app.$el)).toBe(`<div>2</div>`)

    app.foo++
    await nextTick()
    // should not update
    expect(serialize(app.$el)).toBe(`<div>2</div>`)

    app.bar++
    await nextTick()
    // should update now
    expect(serialize(app.$el)).toBe(`<div>4</div>`)
  })
})
