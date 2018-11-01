import { withHooks, useState, h, nextTick, useEffect, Component } from '../src'
import { renderInstance, serialize, triggerEvent } from '@vue/runtime-test'

describe('hooks', () => {
  it('useState', async () => {
    const Counter = withHooks(() => {
      const [count, setCount] = useState(0)
      return h(
        'div',
        {
          onClick: () => {
            setCount(count + 1)
          }
        },
        count
      )
    })

    const counter = await renderInstance(Counter)
    expect(serialize(counter.$el)).toBe(`<div>0</div>`)

    triggerEvent(counter.$el, 'click')
    await nextTick()
    expect(serialize(counter.$el)).toBe(`<div>1</div>`)
  })

  it('should be usable inside class', async () => {
    class Counter extends Component {
      render() {
        const [count, setCount] = useState(0)
        return h(
          'div',
          {
            onClick: () => {
              setCount(count + 1)
            }
          },
          count
        )
      }
    }

    const counter = await renderInstance(Counter)
    expect(serialize(counter.$el)).toBe(`<div>0</div>`)

    triggerEvent(counter.$el, 'click')
    await nextTick()
    expect(serialize(counter.$el)).toBe(`<div>1</div>`)
  })

  it('should be usable via hooks() method', async () => {
    class Counter extends Component {
      hooks() {
        const [count, setCount] = useState(0)
        return {
          count,
          setCount
        }
      }
      render() {
        const { count, setCount } = this as any
        return h(
          'div',
          {
            onClick: () => {
              setCount(count + 1)
            }
          },
          count
        )
      }
    }

    const counter = await renderInstance(Counter)
    expect(serialize(counter.$el)).toBe(`<div>0</div>`)

    triggerEvent(counter.$el, 'click')
    await nextTick()
    expect(serialize(counter.$el)).toBe(`<div>1</div>`)
  })

  it('useEffect', async () => {
    let effect = -1

    const Counter = withHooks(() => {
      const [count, setCount] = useState(0)
      useEffect(() => {
        effect = count
      })
      return h(
        'div',
        {
          onClick: () => {
            setCount(count + 1)
          }
        },
        count
      )
    })

    const counter = await renderInstance(Counter)
    expect(effect).toBe(0)
    triggerEvent(counter.$el, 'click')
    await nextTick()
    expect(effect).toBe(1)
  })

  it('useEffect with empty keys', async () => {
    // TODO
  })

  it('useEffect with keys', async () => {
    // TODO
  })

  it('useData', () => {
    // TODO
  })

  it('useMounted/useUnmounted/useUpdated', () => {
    // TODO
  })

  it('useWatch', () => {
    // TODO
  })

  it('useComputed', () => {
    // TODO
  })
})
