import { test } from '../../../scripts/bench'
import * as reactivity from '../dist/reactivity.esm-browser.prod'

const { effect, reactive, shallowReadArray } = reactivity

for (let amount = 1e1; amount < 1e4; amount *= 10) {
  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    const name = `track for loop, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        let sum = 0
        effect(() => {
          for (let i = 0; i < arr.length; i++) {
            sum += arr[i]
          }
        })
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    const name = `track manual reactiveReadArray, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        let sum = 0
        effect(() => {
          const raw = shallowReadArray(arr)
          for (let i = 0; i < raw.length; i++) {
            sum += raw[i]
          }
        })
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    const name = `track iteration, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        let sum = 0
        effect(() => {
          for (let x of arr) {
            sum += x
          }
        })
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    const name = `track forEach, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        let sum = 0
        effect(() => {
          arr.forEach(x => (sum += x))
        })
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    const name = `track reduce, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        let sum = 0
        effect(() => {
          sum = arr.reduce((v, a) => a + v, 0)
        })
      })
    })
  }

  {
    const rawArray: any[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    effect(() => r.reduce((v, a) => a + v, 0))

    const name = `trigger index mutation (1st only), tracked with reduce, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        r[0]++
      })
    })
  }

  {
    const rawArray: any[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    effect(() => r.reduce((v, a) => a + v, 0))

    const name = `trigger index mutation (all), tracked with reduce, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        for (let i = 0, n = r.length; i < n; i++) {
          r[i]++
        }
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)
    let sum = 0
    effect(() => {
      for (let x of arr) {
        sum += x
      }
    })

    const name = `push() trigger, tracked via iteration, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        arr.push(1)
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)
    let sum = 0
    effect(() => {
      arr.forEach(x => (sum += x))
    })

    const name = `push() trigger, tracked via forEach, ${amount} elements`
    test(name, async ({ benchmark }) => {
      await benchmark(() => {
        arr.push(1)
      })
    })
  }
}
