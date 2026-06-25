import { bench } from 'vitest'
import {
  effect,
  reactive,
  shallowReadArray,
} from '../dist/reactivity.esm-browser.prod'

for (let amount = 1e1; amount < 1e4; amount *= 10) {
  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    bench(`track for loop, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i]
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

    bench(`track manual reactiveReadArray, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        const raw = shallowReadArray(arr)
        for (let i = 0; i < raw.length; i++) {
          sum += raw[i]
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

    bench(`track iteration, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        for (let x of arr) {
          sum += x
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

    bench(`track forEach, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        arr.forEach(x => (sum += x))
      })
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const arr = reactive(rawArray)

    bench(`track reduce, ${amount} elements`, () => {
      let sum = 0
      effect(() => {
        sum = arr.reduce((v, a) => a + v, 0)
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

    bench(
      `trigger index mutation (1st only), tracked with reduce, ${amount} elements`,
      () => {
        r[0]++
      },
    )
  }

  {
    const rawArray: any[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    effect(() => r.reduce((v, a) => a + v, 0))

    bench(
      `trigger index mutation (all), tracked with reduce, ${amount} elements`,
      () => {
        for (let i = 0, n = r.length; i < n; i++) {
          r[i]++
        }
      },
    )
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

    bench(`push() trigger, tracked via iteration, ${amount} elements`, () => {
      arr.push(1)
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

    bench(`push() trigger, tracked via forEach, ${amount} elements`, () => {
      arr.push(1)
    })
  }
}
